import fs from "fs/promises";
import path from "path";
import { getSetting } from "@/lib/settings";
import { ensureVideoDir, publicStorageUrl } from "@/lib/storage";
import type { ScriptSection } from "@/lib/types";

export type TtsResult = {
  localPath: string;
  url: string;
  chars: number;
  provider: "elevenlabs" | "demo";
  voiceId?: string;
};

/** Gera voiceover. Com ElevenLabs salva MP3; sem key gera arquivo de texto demo. */
export async function generateVoiceover(
  videoId: string,
  script: ScriptSection[]
): Promise<TtsResult> {
  const narration = script.map((s) => s.narration).join("\n\n");
  const chars = narration.length;
  const dir = await ensureVideoDir(videoId);
  const apiKey = await getSetting("ELEVENLABS_API_KEY");
  const voiceId =
    (await getSetting("ELEVENLABS_VOICE_ID")) || "21m00Tcm4TlvDq8ikWAM";

  if (!apiKey) {
    const file = path.join(dir, "voiceover.txt");
    await fs.writeFile(file, narration, "utf8");
    return {
      localPath: file,
      url: publicStorageUrl(videoId, "voiceover.txt"),
      chars,
      provider: "demo",
    };
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: narration.slice(0, 4500),
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${err.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(dir, "voiceover.mp3");
  await fs.writeFile(file, buf);

  return {
    localPath: file,
    url: publicStorageUrl(videoId, "voiceover.mp3"),
    chars,
    provider: "elevenlabs",
    voiceId,
  };
}
