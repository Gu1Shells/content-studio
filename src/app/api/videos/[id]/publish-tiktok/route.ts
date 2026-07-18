import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadToTikTokInbox } from "@/lib/tiktok";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id },
    include: { assets: true },
  });
  if (!video) return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 });
  if (!["ready", "scheduled", "paused", "published"].includes(video.status)) {
    return NextResponse.json(
      { error: `Status ${video.status} não permite publicar no TikTok.` },
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
          "Nenhum final.mp4 encontrado. Gere o vídeo com FFmpeg antes de enviar ao TikTok.",
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
      log: "Enviando rascunho para TikTok...",
    },
  });

  try {
    const uploaded = await uploadToTikTokInbox(path.resolve(mp4.localPath));

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        progress: 100,
        finishedAt: new Date(),
        log: `${uploaded.publishId} · ${uploaded.status} · ${uploaded.note}`,
      },
    });

    const updated = await prisma.video.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        tiktokUrl: `tiktok:inbox:${uploaded.publishId}`,
        errorMessage: null,
      },
      include: { assets: true, jobs: true, costEntries: true },
    });

    return NextResponse.json({
      ...updated,
      tiktok: uploaded,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no upload TikTok";
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
