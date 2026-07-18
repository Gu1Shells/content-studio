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
  url: string;
  srtUrl: string;
  cues: CaptionCue[];
};

/** Monta legendas a partir das durações do roteiro (alinhamento por seção). */
export async function generateCaptions(
  videoId: string,
  script: ScriptSection[]
): Promise<CaptionsResult> {
  const cues: CaptionCue[] = [];
  let t = 0;
  let index = 1;

  for (const section of script) {
    const words = section.narration.split(/\s+/).filter(Boolean);
    const chunkSize = 8;
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
        text,
        role: section.role,
      });
      index++;
      t = endSec;
    }
  }

  const dir = await ensureVideoDir(videoId);
  const jsonPath = path.join(dir, "captions.json");
  const srtPath = path.join(dir, "captions.srt");
  await fs.writeFile(
    jsonPath,
    JSON.stringify({ style: "karaoke-bottom", language: "pt-BR", cues }, null, 2)
  );
  await fs.writeFile(srtPath, toSrt(cues), "utf8");

  return {
    localPath: jsonPath,
    srtPath,
    url: publicStorageUrl(videoId, "captions.json"),
    srtUrl: publicStorageUrl(videoId, "captions.srt"),
    cues,
  };
}

function toSrt(cues: CaptionCue[]): string {
  return cues
    .map((c) => `${c.index}\n${fmt(c.startSec)} --> ${fmt(c.endSec)}\n${c.text}\n`)
    .join("\n");
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
