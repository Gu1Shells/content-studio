import type { CostEstimate, ProductionPlan, ScriptSection, SuggestionPayload, VideoFormat } from "@/lib/types";

function extractTopN(prompt: string): number {
  const m = prompt.match(/top\s*(\d+)/i) || prompt.match(/(\d+)\s*(curiosidades|lugares|fatos|dicas)/i);
  if (m) return Math.min(Math.max(parseInt(m[1], 10), 3), 15);
  return 10;
}

function detectFormat(prompt: string, preferred?: VideoFormat): VideoFormat {
  if (preferred && preferred !== "both") return preferred;
  if (/short|tiktok|reels/i.test(prompt)) return "shorts";
  if (/longo|long.?form|document/i.test(prompt)) return "long";
  return preferred || "long";
}

function topicFromPrompt(prompt: string): string {
  const placeMatch = prompt.match(/lugares?\s+mais\s+\w+(?:\s+do\s+\w+)?/i);
  if (placeMatch) return placeMatch[0];

  const curiosMatch = prompt.match(/curiosidades?\s+(?:de|sobre|do|da|dos|das)\s+(.+)$/i);
  if (curiosMatch) return curiosMatch[1].replace(/[?.!]+$/, "").trim().slice(0, 120);

  const cleaned = prompt
    .replace(/^(crie|gera|gerar|faça|faz|create|make)\s+(um\s+)?(vídeo|video)\s*/i, "")
    .replace(/^(das?|dos?|de|sobre|com)\s+/i, "")
    .replace(/^top\s*\d+\s*/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

  return cleaned.slice(0, 120) || "curiosidades";
}

function buildScript(topic: string, itemCount: number, format: VideoFormat): ScriptSection[] {
  const perItem = format === "shorts" ? 12 : 35;
  const sections: ScriptSection[] = [
    {
      id: "hook",
      role: "hook",
      title: "Gancho",
      narration: `Quase ninguém sabe disso sobre ${topic}. Nos próximos minutos você vai ver ${itemCount} fatos que vão mudar o jeito que você olha para esse assunto.`,
      visualQuery: `${topic} cinematic`,
      durationSec: format === "shorts" ? 3 : 8,
    },
    {
      id: "intro",
      role: "intro",
      title: "Introdução",
      narration: `Se você curte curiosidades, fica até o final — tem um detalhe no último item que a maioria ignora. E se esse tipo de conteúdo te ajuda, já deixa o like e se inscreve para não perder os próximos rankings.`,
      visualQuery: `${topic} montage`,
      durationSec: format === "shorts" ? 4 : 12,
    },
  ];

  for (let i = 1; i <= itemCount; i++) {
    const reverse = itemCount - i + 1;
    sections.push({
      id: `item-${reverse}`,
      role: "item",
      title: `#${reverse}`,
      itemNumber: reverse,
      narration:
        reverse === 1
          ? `Número 1: o ponto mais impressionante sobre ${topic}. Presta atenção — é aqui que muita gente se surpreende. Conta nos comentários se você já sabia.`
          : `Número ${reverse}: mais uma curiosidade forte sobre ${topic}. Guarda esse detalhe, porque ele conecta com o próximo.`,
      visualQuery: `${topic} ${reverse}`,
      durationSec: perItem,
    });

    if (format === "long" && i === Math.floor(itemCount / 2)) {
      sections.push({
        id: "cta-mid",
        role: "cta_mid",
        title: "CTA meio",
        narration: `Rápido: se está gostando, se inscreve no canal e ativa o sininho. Isso ajuda a trazer mais curiosidades como essa toda semana.`,
        visualQuery: `subscribe youtube end screen`,
        durationSec: 8,
      });
    }
  }

  sections.push({
    id: "outro",
    role: "outro",
    title: "Encerramento",
    narration: `E aí: qual item mais te surpreendeu? Comenta o número. Se curtiu, deixa o like, se inscreve e compartilha com alguém que precisa ver isso. No próximo vídeo a gente continua com mais curiosidades — até lá.`,
    visualQuery: `${topic} finale`,
    durationSec: format === "shorts" ? 4 : 14,
  });

  return sections;
}

function copyrightRisk(prompt: string): string[] {
  const risks: string[] = [];
  if (/gta|rockstar|nintendo|disney|marvel|fifa|pokemon|harry\s*potter/i.test(prompt)) {
    risks.push(
      "Tema com IP de terceiros: imagens oficiais/gameplay sem licença podem gerar claim no YouTube."
    );
  }
  return risks;
}

/** Template local (sem OpenAI). */
export function buildSuggestionLocal(
  prompt: string,
  formatPreferred: VideoFormat = "long"
): SuggestionPayload {
  const itemCount = extractTopN(prompt);
  const format = detectFormat(prompt, formatPreferred);
  const topic = topicFromPrompt(prompt);
  const title =
    format === "shorts"
      ? `${itemCount} curiosidades sobre ${topic}`.slice(0, 70)
      : `Top ${itemCount}: ${topic}`.slice(0, 90);

  const script = buildScript(topic, itemCount, format);
  const estimatedDurationSec = script.reduce((a, s) => a + s.durationSec, 0);

  const plan: ProductionPlan = {
    title,
    format,
    angle: `Ranking viral de curiosidades com gancho forte e CTAs de inscrição/like.`,
    hooks: [
      `Quase ninguém sabe disso sobre ${topic}...`,
      `O #1 vai te surpreender`,
      `${itemCount} fatos que mudam o que você pensa sobre ${topic}`,
    ],
    outline: script.map((s) => `${s.title}: ${s.narration.slice(0, 80)}...`),
    ctaStrategy: [
      "CTA cedo (inscrição + like) após o gancho",
      "CTA no meio do ranking (vídeos longos)",
      "CTA final pedindo comentário com o número favorito",
    ],
    risks: copyrightRisk(prompt),
    mediaStrategy:
      "Buscar imagens/vídeos royalty-free por query (Pexels). Evite scrape de Google e assets oficiais de jogos.",
    estimatedDurationSec,
    itemCount,
    searchQueries: script.map((s) => s.visualQuery),
  };

  const estimate: CostEstimate = {
    currency: "USD",
    totalUsd: 0,
    breakdown: [],
    assumptions: [],
  };

  return { plan, script, estimate };
}
