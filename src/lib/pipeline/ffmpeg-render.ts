import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { ensureVideoDir, publicStorageUrl } from "@/lib/storage";

export type RenderResult = {
  localPath: string;
  url: string;
  provider: "ffmpeg" | "manifest";
  note: string;
};

/**
 * Render na VPS via FFmpeg quando disponível.
 * Sem FFmpeg, grava um manifesto JSON com a timeline para render posterior.
 */
export async function renderVideo(
  videoId: string,
  input: {
    title: string;
    imageUrls: string[];
    audioPath?: string | null;
    srtPath?: string | null;
    durationSec: number;
  }
): Promise<RenderResult> {
  const dir = await ensureVideoDir(videoId);
  const manifestPath = path.join(dir, "timeline.json");
  const outMp4 = path.join(dir, "final.mp4");

  const manifest = {
    title: input.title,
    durationSec: input.durationSec,
    images: input.imageUrls,
    audio: input.audioPath,
    subtitles: input.srtPath,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const hasFfmpeg = await commandExists("ffmpeg");
  if (!hasFfmpeg || input.imageUrls.length === 0) {
    return {
      localPath: manifestPath,
      url: publicStorageUrl(videoId, "timeline.json"),
      provider: "manifest",
      note: hasFfmpeg
        ? "Sem imagens para montar. Manifesto salvo."
        : "FFmpeg não encontrado na VPS. Manifesto salvo — instale ffmpeg e re-renderize.",
    };
  }

  // Slideshow simples: primeira imagem estendida + áudio opcional
  const listFile = path.join(dir, "images.txt");
  const perImage = Math.max(input.durationSec / input.imageUrls.length, 3);
  // Baixa primeiras N imagens localmente
  const localImages: string[] = [];
  for (let i = 0; i < Math.min(input.imageUrls.length, 12); i++) {
    const url = input.imageUrls[i];
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const imgPath = path.join(dir, `frame-${i}.jpg`);
      await fs.writeFile(imgPath, buf);
      localImages.push(imgPath);
    } catch {
      // skip
    }
  }

  if (!localImages.length) {
    return {
      localPath: manifestPath,
      url: publicStorageUrl(videoId, "timeline.json"),
      provider: "manifest",
      note: "Falha ao baixar frames. Manifesto salvo.",
    };
  }

  const concat = localImages
    .map((p) => `file '${p.replace(/\\/g, "/")}'\nduration ${perImage}`)
    .join("\n");
  await fs.writeFile(listFile, `${concat}\nfile '${localImages[localImages.length - 1].replace(/\\/g, "/")}'\n`);

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    ...(input.audioPath && input.audioPath.endsWith(".mp3")
      ? ["-i", input.audioPath, "-c:a", "aac", "-shortest"]
      : ["-t", String(input.durationSec)]),
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outMp4,
  ];

  await run("ffmpeg", args);

  return {
    localPath: outMp4,
    url: publicStorageUrl(videoId, "final.mp4"),
    provider: "ffmpeg",
    note: "Render slideshow 720p gerado na VPS",
  };
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, ["-version"], { stdio: "ignore", shell: true });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "pipe", shell: true });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`));
    });
  });
}
