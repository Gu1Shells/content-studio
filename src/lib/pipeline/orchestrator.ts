import { prisma } from "@/lib/db";
import { buildSuggestion } from "@/lib/pipeline/suggest";
import { searchMedia } from "@/lib/pipeline/media";
import { generateVoiceover } from "@/lib/pipeline/tts";
import { generateCaptions } from "@/lib/pipeline/captions";
import { renderVideo } from "@/lib/pipeline/ffmpeg-render";
import { getSetting } from "@/lib/settings";
import type { ScriptSection, SuggestionPayload, VideoFormat } from "@/lib/types";

export async function createVideoFromPrompt(input: {
  prompt: string;
  format?: VideoFormat;
  niche?: string;
}) {
  const format = input.format || "long";
  const video = await prisma.video.create({
    data: {
      prompt: input.prompt,
      format,
      niche: input.niche || "curiosidades",
      status: "estimating",
      title: "Gerando sugestão...",
    },
  });

  await prisma.job.create({
    data: { videoId: video.id, type: "estimate", status: "running", progress: 10 },
  });

  const suggestion = await buildSuggestion(input.prompt, format);

  await prisma.video.update({
    where: { id: video.id },
    data: {
      status: "estimated",
      title: suggestion.plan.title,
      suggestionJson: JSON.stringify(suggestion.plan),
      scriptJson: JSON.stringify(suggestion.script),
      estimateJson: JSON.stringify(suggestion.estimate),
      estimatedCostUsd: suggestion.estimate.totalUsd,
      durationSec: suggestion.plan.estimatedDurationSec,
    },
  });

  await prisma.job.updateMany({
    where: { videoId: video.id, type: "estimate" },
    data: { status: "done", progress: 100, finishedAt: new Date() },
  });

  return prisma.video.findUniqueOrThrow({ where: { id: video.id } });
}

export function parseSuggestion(video: {
  suggestionJson: string | null;
  scriptJson: string | null;
  estimateJson: string | null;
}): SuggestionPayload | null {
  if (!video.suggestionJson || !video.scriptJson || !video.estimateJson) return null;
  return {
    plan: JSON.parse(video.suggestionJson),
    script: JSON.parse(video.scriptJson),
    estimate: JSON.parse(video.estimateJson),
  };
}

async function runJob(
  videoId: string,
  type: string,
  fn: (update: (progress: number, log?: string) => Promise<void>) => Promise<void>
) {
  const job = await prisma.job.create({
    data: { videoId, type, status: "running", progress: 0, startedAt: new Date() },
  });
  const update = async (progress: number, log?: string) => {
    await prisma.job.update({
      where: { id: job.id },
      data: { progress, ...(log ? { log } : {}) },
    });
  };
  try {
    await fn(update);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "done", progress: 100, finishedAt: new Date() },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", log: message, finishedAt: new Date() },
    });
    throw e;
  }
}

/** Aprova e dispara: imagens → TTS → legendas → render. */
export async function approveAndGenerate(videoId: string) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (!["estimated", "draft", "paused"].includes(video.status)) {
    throw new Error(`Status inválido para aprovar: ${video.status}`);
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "generating", errorMessage: null },
  });

  const script = JSON.parse(video.scriptJson || "[]") as ScriptSection[];
  const imageUrls: string[] = [];
  let audioPath: string | null = null;
  let srtPath: string | null = null;

  try {
    await runJob(videoId, "images", async (update) => {
      const queries = script.map((s) => s.visualQuery).slice(0, 14);
      let i = 0;
      for (const query of queries) {
        const preferVideo = /lugar|place|world|viagem|travel|natureza|nature/i.test(query);
        let hits = await searchMedia(query, { video: preferVideo });
        if (!hits.length) hits = await searchMedia(query, { video: false });
        const hit = hits[0];
        if (hit) {
          imageUrls.push(hit.url);
          await prisma.asset.create({
            data: {
              videoId,
              type: hit.type === "video" ? "video" : "image",
              label: query,
              source: hit.source,
              url: hit.url,
              metaJson: JSON.stringify(hit),
            },
          });
        }
        i++;
        await update(Math.round((i / queries.length) * 100));
      }
    });

    await runJob(videoId, "tts", async (update) => {
      await update(20, "Gerando narração...");
      const tts = await generateVoiceover(videoId, script);
      audioPath = tts.localPath;
      await prisma.asset.create({
        data: {
          videoId,
          type: "audio",
          label: "voiceover",
          source: tts.provider,
          url: tts.url,
          localPath: tts.localPath,
          metaJson: JSON.stringify({
            chars: tts.chars,
            voiceId: tts.voiceId,
            provider: tts.provider,
          }),
        },
      });
      await update(100, tts.provider === "elevenlabs" ? "MP3 gerado" : "Demo texto (sem ElevenLabs key)");
    });

    await runJob(videoId, "captions", async (update) => {
      await update(30);
      const caps = await generateCaptions(videoId, script);
      srtPath = caps.srtPath;
      await prisma.asset.create({
        data: {
          videoId,
          type: "caption",
          label: "captions.srt",
          source: "local",
          url: caps.srtUrl,
          localPath: caps.srtPath,
          metaJson: JSON.stringify({ cues: caps.cues.length, jsonUrl: caps.url }),
        },
      });
      await update(100);
    });

    await runJob(videoId, "render", async (update) => {
      await update(10, "Montando vídeo...");
      const rendered = await renderVideo(videoId, {
        title: video.title || "video",
        imageUrls,
        audioPath,
        srtPath,
        durationSec: video.durationSec || script.reduce((a, s) => a + s.durationSec, 0),
      });
      await prisma.asset.create({
        data: {
          videoId,
          type: "video",
          label: rendered.provider === "ffmpeg" ? "final.mp4" : "timeline.json",
          source: rendered.provider,
          url: rendered.url,
          localPath: rendered.localPath,
          metaJson: JSON.stringify({ note: rendered.note }),
        },
      });
      await update(100, rendered.note);
    });

    const estimate = video.estimateJson ? JSON.parse(video.estimateJson) : null;
    const hasEleven = Boolean(await getSetting("ELEVENLABS_API_KEY"));
    if (estimate?.breakdown) {
      for (const row of estimate.breakdown) {
        if (row.provider === "elevenlabs" && !hasEleven) {
          await prisma.costEntry.create({
            data: {
              videoId,
              provider: "local",
              kind: "tts_chars",
              units: row.units,
              unitCostUsd: 0,
              totalUsd: 0,
              note: "TTS demo (sem key ElevenLabs)",
            },
          });
          continue;
        }
        await prisma.costEntry.create({
          data: {
            videoId,
            provider: row.provider,
            kind: row.kind,
            units: row.units,
            unitCostUsd: row.unitCostUsd,
            totalUsd: row.provider === "elevenlabs" && !hasEleven ? 0 : row.totalUsd,
            note: row.note,
          },
        });
      }
    }

    const actual = await prisma.costEntry.aggregate({
      where: { videoId },
      _sum: { totalUsd: true },
    });

    return prisma.video.update({
      where: { id: videoId },
      data: {
        status: "ready",
        actualCostUsd: actual._sum.totalUsd || 0,
      },
      include: { assets: true, jobs: true, costEntries: true },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na geração";
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "failed", errorMessage: message },
    });
    throw e;
  }
}
