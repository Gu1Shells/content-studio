import fs from "fs/promises";
import path from "path";
import { ensureVideoDir, publicStorageUrl } from "@/lib/storage";
import type { ScriptSection } from "@/lib/types";

export type CaptionCue = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  role: string;
};

export type CaptionsResult = {
  localPath: string;
  srtPath: string;
  assPath: string;
  url: string;
  srtUrl: string;
  assUrl: string;
  cues: CaptionCue[];
};

/** Legendas sincronizadas por seção — chunks curtos para leitura fácil. */
export async function generateCaptions(
  videoId: string,
  script: ScriptSection[]
): Promise<CaptionsResult> {
  const cues: CaptionCue[] = [];
  let t = 0;
  let index = 1;

  for (const section of script) {
    const words = section.narration.split(/\s+/).filter(Boolean);
    const chunkSize = 5; // legenda curta = melhor leitura
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }
    const slice = section.durationSec / Math.max(chunks.length, 1);
    for (const text of chunks) {
      const startSec = t;
      const endSec = t + slice;
      cues.push({
        index,
        startSec,
        endSec,
        text: text.toUpperCase(), // estilo viral / leitura fácil
        role: section.role,
      });
      index++;
      t = endSec;
    }
  }

  const dir = await ensureVideoDir(videoId);
  const jsonPath = path.join(dir, "captions.json");
  const srtPath = path.join(dir, "captions.srt");
  const assPath = path.join(dir, "captions.ass");

  await fs.writeFile(
    jsonPath,
    JSON.stringify({ style: "bottom-bold", language: "pt-BR", cues }, null, 2)
  );
  await fs.writeFile(srtPath, toSrt(cues), "utf8");
  await fs.writeFile(assPath, toAss(cues), "utf8");

  return {
    localPath: jsonPath,
    srtPath,
    assPath,
    url: publicStorageUrl(videoId, "captions.json"),
    srtUrl: publicStorageUrl(videoId, "captions.srt"),
    assUrl: publicStorageUrl(videoId, "captions.ass"),
    cues,
  };
}

function toSrt(cues: CaptionCue[]): string {
  return cues
    .map((c) => `${c.index}\n${fmt(c.startSec)} --> ${fmt(c.endSec)}\n${c.text}\n`)
    .join("\n");
}

function toAss(cues: CaptionCue[]): string {
  const header = `[Script Info]
Title: Content Studio Captions
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,2,60,60,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues
    .map((c) => {
      const text = c.text.replace(/[{}\\]/g, "").replace(/\n/g, "\\N");
      return `Dialogue: 0,${assTime(c.startSec)},${assTime(c.endSec)},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return `${header}${events}\n`;
}

function assTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${h}:${pad(m)}:${pad(s)}.${String(cs).padStart(2, "0")}`;
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
