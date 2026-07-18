import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { ensureVideoDir, publicStorageUrl } from "@/lib/storage";
import type { ScriptSection } from "@/lib/types";

export type SceneClip = {
  section: ScriptSection;
  imageUrl: string;
  localImagePath?: string;
};

export type RenderResult = {
  localPath: string;
  url: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  provider: "ffmpeg" | "manifest";
  note: string;
};

/**
 * Render sincronizado: 1 imagem por seção do roteiro (duração = section.durationSec)
 * + legendas ASS queimadas + thumbnail.
 */
export async function renderVideo(
  videoId: string,
  input: {
    title: string;
    scenes: SceneClip[];
    audioPath?: string | null;
    assPath?: string | null;
    srtPath?: string | null;
    durationSec: number;
  }
): Promise<RenderResult> {
  const dir = await ensureVideoDir(videoId);
  const manifestPath = path.join(dir, "timeline.json");
  const outMp4 = path.join(dir, "final.mp4");
  const thumbPath = path.join(dir, "thumbnail.jpg");

  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        title: input.title,
        durationSec: input.durationSec,
        scenes: input.scenes.map((s) => ({
          role: s.section.role,
          title: s.section.title,
          durationSec: s.section.durationSec,
          visualQuery: s.section.visualQuery,
          imageUrl: s.imageUrl,
        })),
        audio: input.audioPath,
        captions: input.assPath || input.srtPath,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const hasFfmpeg = await commandExists("ffmpeg");
  if (!hasFfmpeg || input.scenes.length === 0) {
    return {
      localPath: manifestPath,
      url: publicStorageUrl(videoId, "timeline.json"),
      provider: "manifest",
      note: hasFfmpeg
        ? "Sem cenas para montar. Manifesto salvo."
        : "FFmpeg não encontrado. Manifesto salvo.",
    };
  }

  // Baixa imagem de cada cena (sincronizada 1:1 com o roteiro)
  const prepared: { path: string; duration: number }[] = [];
  for (let i = 0; i < input.scenes.length; i++) {
    const scene = input.scenes[i];
    const imgPath = path.join(dir, `scene-${String(i).padStart(3, "0")}.jpg`);
    try {
      const res = await fetch(scene.imageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fs.writeFile(imgPath, Buffer.from(await res.arrayBuffer()));
      prepared.push({
        path: imgPath,
        duration: Math.max(scene.section.durationSec, 2),
      });
    } catch {
      // reutiliza última imagem válida
      if (prepared.length) {
        prepared.push({
          path: prepared[prepared.length - 1].path,
          duration: Math.max(scene.section.durationSec, 2),
        });
      }
    }
  }

  if (!prepared.length) {
    return {
      localPath: manifestPath,
      url: publicStorageUrl(videoId, "timeline.json"),
      provider: "manifest",
      note: "Falha ao baixar imagens das cenas.",
    };
  }

  const listFile = path.join(dir, "images.txt");
  const lines: string[] = [];
  for (const clip of prepared) {
    lines.push(`file ${ffmpegConcatPath(clip.path)}`);
    lines.push(`duration ${clip.duration}`);
  }
  lines.push(`file ${ffmpegConcatPath(prepared[prepared.length - 1].path)}`);
  await fs.writeFile(listFile, `${lines.join("\n")}\n`);

  const totalDur = prepared.reduce((a, c) => a + c.duration, 0);
  const baseVf =
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black";

  let vf = baseVf;
  if (input.assPath) {
    // Escapa path para filtro subtitles/ass do ffmpeg
    const assEscaped = escapeFfPath(input.assPath);
    vf = `${baseVf},ass=${assEscaped}`;
  } else if (input.srtPath) {
    const srtEscaped = escapeFfPath(input.srtPath);
    vf = `${baseVf},subtitles=${srtEscaped}:force_style='FontName=DejaVu Sans,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=40'`;
  }

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
      : ["-t", String(totalDur)]),
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outMp4,
  ];

  await run("ffmpeg", args);

  // Thumbnail 1280x720 com título
  try {
    await generateThumbnail({
      imagePath: prepared[0].path,
      outPath: thumbPath,
      title: input.title,
    });
  } catch (e) {
    console.error("thumbnail failed", e);
  }

  const thumbExists = await fs
    .access(thumbPath)
    .then(() => true)
    .catch(() => false);

  return {
    localPath: outMp4,
    url: publicStorageUrl(videoId, "final.mp4"),
    thumbnailPath: thumbExists ? thumbPath : undefined,
    thumbnailUrl: thumbExists ? publicStorageUrl(videoId, "thumbnail.jpg") : undefined,
    provider: "ffmpeg",
    note: "Vídeo sincronizado por cena + legendas + thumbnail",
  };
}

async function generateThumbnail(input: {
  imagePath: string;
  outPath: string;
  title: string;
}) {
  const safeTitle = input.title
    .replace(/:/g, " - ")
    .replace(/['\\]/g, "")
    .slice(0, 70);

  // Caixa escura + texto grande (leitura fácil no YouTube)
  const draw =
    `drawbox=x=0:y=ih*0.62:w=iw:h=ih*0.38:color=black@0.55:t=fill,` +
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
    `text='${escapeDrawText(safeTitle)}':fontcolor=white:fontsize=48:` +
    `x=(w-text_w)/2:y=h*0.72:line_spacing=8`;

  await run("ffmpeg", [
    "-y",
    "-i",
    input.imagePath,
    "-vf",
    `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,${draw}`,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    input.outPath,
  ]);
}

function escapeDrawText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’");
}

function escapeFfPath(p: string): string {
  // Para filtros ass=/subtitles=: escapa : \ ' e usa forward slashes
  return p
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function ffmpegConcatPath(p: string): string {
  const normalized = p.replace(/\\/g, "/").replace(/'/g, "'\\''");
  return `'${normalized}'`;
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, ["-version"], { stdio: "ignore", shell: false });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "pipe", shell: false });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`));
    });
  });
}
