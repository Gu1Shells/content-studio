import OpenAI from "openai";
import { getSetting } from "@/lib/settings";
import type { ProductionPlan, ScriptSection, SuggestionPayload, VideoFormat } from "@/lib/types";
import { buildSuggestionLocal } from "@/lib/pipeline/suggest-local";

type LlmPayload = {
  title: string;
  angle: string;
  hooks: string[];
  ctaStrategy: string[];
  risks: string[];
  mediaStrategy: string;
  items: { number: number; name: string; fact: string; visualQuery: string }[];
  script: {
    role: "hook" | "intro" | "item" | "cta_mid" | "outro";
    title: string;
    narration: string;
    visualQuery: string;
    durationSec: number;
    itemNumber?: number;
  }[];
};

function estimateFromScript(
  script: ScriptSection[],
  format: VideoFormat,
  usedOpenAI: boolean
): SuggestionPayload["estimate"] {
  const narration = script.map((s) => s.narration).join(" ");
  const chars = narration.length;
  const imageCount = script.filter((s) => s.role === "item" || s.role === "hook").length + 2;
  const promptTokens = usedOpenAI ? 1800 : 400;
  const completionTokens = usedOpenAI ? Math.round(chars / 2.5) : Math.round(chars / 4);

  const breakdown = [
    {
      provider: "openai",
      kind: "tokens",
      units: promptTokens + completionTokens,
      unitCostUsd: 0.0006 / 1000,
      totalUsd: Number(
        ((promptTokens / 1000) * 0.00015 + (completionTokens / 1000) * 0.0006).toFixed(4)
      ),
      note: usedOpenAI ? "Roteiro OpenAI" : "Roteiro local (sem OpenAI key)",
    },
    {
      provider: "elevenlabs",
      kind: "tts_chars",
      units: chars,
      unitCostUsd: 0.03 / 1000,
      totalUsd: Number(((chars / 1000) * 0.03).toFixed(4)),
      note: "Narração TTS",
    },
    {
      provider: "pexels",
      kind: "image",
      units: imageCount,
      unitCostUsd: 0,
      totalUsd: 0,
      note: "Imagens royalty-free (Pexels)",
    },
    {
      provider: "local",
      kind: "render",
      units: 1,
      unitCostUsd: 0.01,
      totalUsd: 0.01,
      note: format === "both" ? "Render longo + shorts na VPS" : "Render na VPS (FFmpeg)",
    },
  ];

  if (!usedOpenAI) {
    breakdown[0].totalUsd = 0;
  }

  return {
    currency: "USD",
    totalUsd: Number(breakdown.reduce((a, b) => a + b.totalUsd, 0).toFixed(4)),
    breakdown,
    assumptions: [
      usedOpenAI
        ? "Roteiro gerado com OpenAI (gpt-4o-mini por padrão)."
        : "Sem OPENAI_API_KEY — usou template local. Configure em /settings.",
      "Imagens via Pexels (não Google scrape).",
      "IP de jogos/marcas pode gerar claim no YouTube.",
    ],
  };
}

async function buildWithOpenAI(
  prompt: string,
  format: VideoFormat,
  itemCount: number
): Promise<SuggestionPayload | null> {
  const apiKey = await getSetting("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = (await getSetting("OPENAI_MODEL")) || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const system = `Você é um roteirista senior de YouTube de curiosidades (pt-BR), especialista em retenção e viralização.
Regras:
- Fatos verificáveis e específicos (nomes reais de lugares, números, datas quando couber).
- Estrutura: hook → intro com CTA like/inscrição → itens do ranking (#N até #1) → CTA meio (só se long) → outro com CTA comentário.
- visualQuery em inglês curto para buscar stock (Pexels), sem nomes de marcas copyrighted quando possível.
- Narração falada, natural, sem markdown.
- Responda APENAS JSON válido no schema pedido.`;

  const user = `Crie o plano completo para este briefing.
Prompt do usuário: ${JSON.stringify(prompt)}
Formato: ${format}
Quantidade de itens do ranking: ${itemCount}
Nicho: curiosidades

JSON schema:
{
  "title": "string (título YouTube, até 90 chars)",
  "angle": "string",
  "hooks": ["string","string","string"],
  "ctaStrategy": ["string","string","string"],
  "risks": ["string"],
  "mediaStrategy": "string",
  "items": [{"number":1,"name":"string","fact":"string","visualQuery":"string"}],
  "script": [{
    "role":"hook|intro|item|cta_mid|outro",
    "title":"string",
    "narration":"string",
    "visualQuery":"string",
    "durationSec": number,
    "itemNumber": number|null
  }]
}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI retornou vazio");

  const data = JSON.parse(raw) as LlmPayload;
  const script: ScriptSection[] = (data.script || []).map((s, idx) => ({
    id: `${s.role}-${s.itemNumber ?? idx}`,
    role: s.role,
    title: s.title,
    narration: s.narration,
    visualQuery: s.visualQuery,
    durationSec: Math.max(3, Number(s.durationSec) || 20),
    itemNumber: s.itemNumber ?? undefined,
  }));

  if (!script.length) throw new Error("OpenAI não retornou script");

  const estimatedDurationSec = script.reduce((a, s) => a + s.durationSec, 0);
  const plan: ProductionPlan = {
    title: (data.title || prompt).slice(0, 90),
    format,
    angle: data.angle || "Ranking de curiosidades",
    hooks: data.hooks?.length ? data.hooks : ["Assista até o final"],
    outline: script.map((s) => `${s.title}: ${s.narration.slice(0, 80)}...`),
    ctaStrategy: data.ctaStrategy?.length
      ? data.ctaStrategy
      : ["Like + inscrição no início", "CTA meio", "Comentário no final"],
    risks: data.risks || [],
    mediaStrategy: data.mediaStrategy || "Pexels royalty-free por visualQuery",
    estimatedDurationSec,
    itemCount: data.items?.length || itemCount,
    searchQueries: script.map((s) => s.visualQuery),
  };

  return {
    plan,
    script,
    estimate: estimateFromScript(script, format, true),
  };
}

/** Prefer OpenAI; fallback para template local. */
export async function buildSuggestion(
  prompt: string,
  formatPreferred: VideoFormat = "long"
): Promise<SuggestionPayload> {
  const local = buildSuggestionLocal(prompt, formatPreferred);
  try {
    const ai = await buildWithOpenAI(prompt, local.plan.format, local.plan.itemCount);
    if (ai) return ai;
  } catch (e) {
    console.error("OpenAI suggest failed, using local:", e);
  }
  return {
    ...local,
    estimate: estimateFromScript(local.script, local.plan.format, false),
  };
}
