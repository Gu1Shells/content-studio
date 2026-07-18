import { getSetting } from "@/lib/settings";
import type { MediaHit } from "@/lib/pipeline/media-types";

export type { MediaHit };

const DEMO_IMAGES = [
  "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/346529/pexels-photo-346529.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/147411/italy-mountains-dawn-daybreak-147411.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/462162/pexels-photo-462162.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/210205/pexels-photo-210205.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=1280",
];

export const IP_RISK =
  /gta|grand\s*theft|rockstar|nintendo|disney|marvel|fifa|pokemon|harry\s*potter|playstation|xbox|call\s*of\s*duty|fortnite|minecraft|apple|iphone|samsung|netflix|spotify|tiktok|instagram/i;

/**
 * Cascata inteligente:
 * - Temas com IP (GTA, etc.) → Serper/Google PRIMEIRO (Pexels não tem arte oficial)
 * - Temas genéricos → Pexels → Unsplash → Wikimedia → Serper
 */
export async function searchMedia(
  query: string,
  opts?: { video?: boolean; allowWeb?: boolean; preferWeb?: boolean }
): Promise<MediaHit[]> {
  const allowWeb = opts?.allowWeb !== false;
  const risk = IP_RISK.test(query);
  const serperKey = await getSetting("SERPER_API_KEY");
  const preferWeb = Boolean(opts?.preferWeb || risk || (await getSetting("WEB_IMAGES_FIRST")) === "true");

  // IP / preferência web: Google Images (Serper) primeiro
  if (allowWeb && preferWeb && serperKey) {
    const web = await searchSerperImages(query);
    if (web.length) return tagRisk(web, true);

    // segunda tentativa mais curta (só o núcleo da query)
    const core = query.split(/\s+/).slice(0, 4).join(" ");
    if (core !== query) {
      const web2 = await searchSerperImages(core);
      if (web2.length) return tagRisk(web2, true);
    }
  }

  if (!preferWeb || !serperKey) {
    const pexels = await searchPexels(query, opts?.video);
    if (pexels.length) return tagRisk(pexels, risk);

    const unsplash = await searchUnsplash(query);
    if (unsplash.length) return tagRisk(unsplash, risk);

    const wiki = await searchWikimedia(query);
    if (wiki.length) return tagRisk(wiki, risk);
  }

  if (allowWeb && serperKey && !preferWeb) {
    const web = await searchSerperImages(query);
    if (web.length) return tagRisk(web, true);
  }

  // Sem Serper em tema IP: tenta Wikimedia e depois avisa com demo
  if (preferWeb) {
    const wiki = await searchWikimedia(query);
    if (wiki.length) return tagRisk(wiki, risk);
  }

  const idx = Math.abs(hash(query)) % DEMO_IMAGES.length;
  return tagRisk(
    [
      {
        id: `demo-${idx}`,
        type: "image",
        url: DEMO_IMAGES[idx],
        thumb: DEMO_IMAGES[idx],
        source: "demo",
        query,
        photographer: serperKey
          ? "Fallback demo"
          : "Sem SERPER_API_KEY — configure em /settings para Google Images",
      },
    ],
    risk
  );
}

function tagRisk(hits: MediaHit[], risk: boolean): MediaHit[] {
  if (!risk) return hits;
  return hits.map((h) => ({ ...h, copyrightRisk: true }));
}

async function searchPexels(query: string, video?: boolean): Promise<MediaHit[]> {
  const key = await getSetting("PEXELS_API_KEY");
  if (!key) return [];

  const endpoint = video
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;

  const res = await fetch(endpoint, {
    headers: { Authorization: key },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = await res.json();
  if (video) {
    return (data.videos || []).map(
      (v: { id: number; image: string; video_files: { link: string; width: number }[] }) => {
        const file =
          v.video_files?.sort((a: { width: number }, b: { width: number }) => a.width - b.width).find(
            (f: { width: number }) => f.width >= 720
          ) || v.video_files?.[0];
        return {
          id: String(v.id),
          type: "video" as const,
          url: file?.link || v.image,
          thumb: v.image,
          source: "pexels" as const,
          query,
        };
      }
    );
  }

  return (data.photos || []).map(
    (p: { id: number; src: { large2x: string; medium: string }; photographer: string }) => ({
      id: String(p.id),
      type: "image" as const,
      url: p.src.large2x,
      thumb: p.src.medium,
      photographer: p.photographer,
      source: "pexels" as const,
      query,
    })
  );
}

async function searchUnsplash(query: string): Promise<MediaHit[]> {
  const key = await getSetting("UNSPLASH_ACCESS_KEY");
  if (!key) return [];
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(
    (p: { id: string; urls: { regular: string; small: string }; user: { name: string } }) => ({
      id: p.id,
      type: "image" as const,
      url: p.urls.regular,
      thumb: p.urls.small,
      photographer: p.user?.name,
      source: "unsplash" as const,
      query,
    })
  );
}

async function searchWikimedia(query: string): Promise<MediaHit[]> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: query,
        gsrlimit: "5",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "1280",
        origin: "*",
      });
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages || {};
    return Object.values(pages)
      .map((p: unknown) => {
        const page = p as { pageid: number; imageinfo?: { url?: string; thumburl?: string }[] };
        const info = page.imageinfo?.[0];
        if (!info?.url) return null;
        return {
          id: String(page.pageid),
          type: "image" as const,
          url: info.url,
          thumb: info.thumburl || info.url,
          source: "wikimedia" as const,
          query,
          photographer: "Wikimedia Commons",
        };
      })
      .filter(Boolean) as MediaHit[];
  } catch {
    return [];
  }
}

async function searchSerperImages(query: string): Promise<MediaHit[]> {
  const key = await getSetting("SERPER_API_KEY");
  if (!key) return [];

  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 10, gl: "br", hl: "pt-br" }),
  });
  if (!res.ok) {
    console.error("Serper error", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  return (data.images || [])
    .map(
      (
        img: { imageUrl?: string; thumbnailUrl?: string; title?: string; link?: string },
        i: number
      ) => {
        if (!img.imageUrl) return null;
        // Evita SVGs/ícones minúsculos quando possível
        if (/\.svg(\?|$)/i.test(img.imageUrl)) return null;
        return {
          id: `serper-${i}-${hash(img.imageUrl)}`,
          type: "image" as const,
          url: img.imageUrl,
          thumb: img.thumbnailUrl || img.imageUrl,
          source: "serper" as const,
          query,
          photographer: img.title || "Google Images (Serper)",
          copyrightRisk: true,
        };
      }
    )
    .filter(Boolean) as MediaHit[];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Extrai o tema principal do prompt para buscas (ex.: "GTA 6"). */
export function extractTopicQuery(prompt: string): string {
  const gta = prompt.match(/\bgta\s*6\b/i) || prompt.match(/\bgrand\s*theft\s*auto\s*(vi|6)\b/i);
  if (gta) return "GTA 6";

  const cleaned = prompt
    .replace(/^(crie|gera|gerar|faça|faz|create|make)\s+(um\s+)?(vídeo|video)\s*/i, "")
    .replace(/^(das?|dos?|de|sobre|com)\s+/i, "")
    .replace(/^top\s*\d+\s*/i, "")
    .replace(/^(curiosidades?|fatos?|segredos?)\s+(de|sobre|do|da|dos|das)\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

  return cleaned.slice(0, 80) || prompt.slice(0, 80);
}

/** Monta query de imagem específica: "GTA 6 Lucia Vice City" em vez de "female gamer". */
export function buildImageSearchQuery(topic: string, section: { visualQuery: string; title: string; narration: string }): string {
  const vq = section.visualQuery || "";
  // Se visualQuery já contém o tema, usa ela
  if (topic && new RegExp(topic.replace(/\s+/g, "\\s*"), "i").test(vq)) {
    return vq;
  }
  // Junta tema + detalhe da cena
  const detail = vq || section.title || section.narration.split(/\s+/).slice(0, 6).join(" ");
  return `${topic} ${detail}`.replace(/\s+/g, " ").trim().slice(0, 120);
}
