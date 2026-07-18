import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { uploadToYoutube } from "@/lib/youtube";
import path from "path";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  privacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
  asShorts: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
    include: { assets: true },
  });
  if (!video) return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 });
  if (!["ready", "scheduled", "paused"].includes(video.status)) {
    return NextResponse.json(
      { error: `Status ${video.status} não permite publicar. Gere o vídeo antes.` },
      { status: 400 }
    );
  }

  const mp4 = video.assets.find(
    (a) => a.label === "final.mp4" || (a.type === "video" && a.localPath?.endsWith(".mp4"))
  );
  if (!mp4?.localPath) {
    return NextResponse.json(
      {
        error:
          "Nenhum final.mp4 encontrado. Instale FFmpeg na VPS, aprove de novo o vídeo, ou faça upload manual do manifesto.",
      },
      { status: 400 }
    );
  }

  const job = await prisma.job.create({
    data: {
      videoId: id,
      type: "publish",
      status: "running",
      progress: 10,
      startedAt: new Date(),
      log: "Enviando para YouTube...",
    },
  });

  try {
    const isShort =
      parsed.data.asShorts ??
      (video.format === "shorts" || (video.durationSec != null && video.durationSec <= 60));

    const description = [
      video.prompt,
      "",
      "👉 Se inscreva para mais curiosidades!",
      "👍 Deixe o like se gostou",
      "💬 Comenta qual item foi o seu favorito",
      "",
      "#curiosidades #top10 #fatos",
    ].join("\n");

    const uploaded = await uploadToYoutube({
      filePath: path.resolve(mp4.localPath),
      title: video.title || "Curiosidades",
      description,
      privacyStatus: parsed.data.privacyStatus || "private",
      isShort,
      tags: ["curiosidades", "top10", "fatos", "viral"],
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        progress: 100,
        finishedAt: new Date(),
        log: uploaded.url,
      },
    });

    const updated = await prisma.video.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        youtubeUrl: uploaded.url,
        shortsUrl: uploaded.shortsUrl,
      },
      include: { assets: true, jobs: true, costEntries: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no upload";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", log: message, finishedAt: new Date() },
    });
    await prisma.video.update({
      where: { id },
      data: { errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
