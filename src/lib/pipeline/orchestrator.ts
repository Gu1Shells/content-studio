import { prisma } from "@/lib/db";
import { buildSuggestion } from "@/lib/pipeline/suggest";
import { searchMedia, extractTopicQuery, buildImageSearchQuery, IP_RISK } from "@/lib/pipeline/media";
import { generateVoiceover } from "@/lib/pipeline/tts";
import { generateCaptions } from "@/lib/pipeline/captions";
import { renderVideo, type SceneClip } from "@/lib/pipeline/ffmpeg-render";
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

/** Aprova e dispara: imagens (1 por cena) → TTS → legendas → render sync + thumb. */
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
  const scenes: SceneClip[] = [];
  let audioPath: string | null = null;
  let srtPath: string | null = null;
  let assPath: string | null = null;
  let copyrightWarnings = 0;

  try {
    await runJob(videoId, "images", async (update) => {
      const topic = extractTopicQuery(video.prompt);
      const preferWeb = IP_RISK.test(video.prompt) || IP_RISK.test(topic);
      let i = 0;
      for (const section of script) {
        const imageQuery = buildImageSearchQuery(topic, section);
        let hits = await searchMedia(imageQuery, {
          video: false,
          allowWeb: true,
          preferWeb,
        });
        // Fallback: só o tema (ex.: "GTA 6")
        if (!hits.length || hits[0].source === "demo" || hits[0].source === "pexels" && preferWeb) {
          const webHits = await searchMedia(topic, { allowWeb: true, preferWeb: true });
          if (webHits.length && webHits[0].source === "serper") {
            hits = webHits;
          } else if (!hits.length) {
            hits = webHits;
          }
        }
        if ((!hits.length || hits[0].source === "demo") && section.title) {
          hits = await searchMedia(`${topic} ${section.title}`, {
            allowWeb: true,
            preferWeb: true,
          });
        }
        const hit = hits[0];
        if (hit) {
          if (hit.copyrightRisk || preferWeb) copyrightWarnings++;
          scenes.push({ section, imageUrl: hit.url });
          await prisma.asset.create({
            data: {
              videoId,
              type: hit.type === "video" ? "video" : "image",
              label: `${section.id}:${imageQuery}`,
              source: hit.source,
              url: hit.url,
              metaJson: JSON.stringify({
                ...hit,
                sectionId: section.id,
                sectionRole: section.role,
                durationSec: section.durationSec,
                imageQuery,
                topic,
              }),
            },
          });
        }
        i++;
        await update(Math.round((i / script.length) * 100), `${section.title} · ${imageQuery}`);
      }
      if (!scenes.length) {
        throw new Error(
          preferWeb
            ? "Nenhuma imagem encontrada. Configure SERPER_API_KEY em /settings para buscar no Google Images."
            : "Nenhuma imagem encontrada para as cenas"
        );
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
      assPath = caps.assPath;
      await prisma.asset.create({
        data: {
          videoId,
          type: "caption",
          label: "captions.ass",
          source: "local",
          url: caps.assUrl,
          localPath: caps.assPath,
          metaJson: JSON.stringify({
            cues: caps.cues.length,
            srtUrl: caps.srtUrl,
            style: "DejaVu Sans bold bottom",
          }),
        },
      });
      await update(100);
    });

    await runJob(videoId, "render", async (update) => {
      await update(10, "Montando vídeo sincronizado...");
      const rendered = await renderVideo(videoId, {
        title: video.title || "video",
        scenes,
        audioPath,
        assPath,
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
          metaJson: JSON.stringify({
            note: rendered.note,
            copyrightWarnings,
          }),
        },
      });
      if (rendered.thumbnailPath && rendered.thumbnailUrl) {
        await prisma.asset.create({
          data: {
            videoId,
            type: "thumbnail",
            label: "thumbnail.jpg",
            source: "ffmpeg",
            url: rendered.thumbnailUrl,
            localPath: rendered.thumbnailPath,
            metaJson: JSON.stringify({ title: video.title }),
          },
        });
      }
      const warn =
        copyrightWarnings > 0
          ? ` · ${copyrightWarnings} cena(s) com possível risco de copyright (web/IP)`
          : "";
      await update(100, `${rendered.note}${warn}`);
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
        errorMessage:
          copyrightWarnings > 0
            ? `Aviso: ${copyrightWarnings} imagem(ns) da web/IP — risco de claim no YouTube.`
            : null,
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
