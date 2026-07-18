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

/** Busca mídia legal (Pexels). Sem key → demo. */
export async function searchMedia(query: string, opts?: { video?: boolean }): Promise<MediaHit[]> {
  const key = await getSetting("PEXELS_API_KEY");
  if (!key) {
    const idx = Math.abs(hash(query)) % DEMO_IMAGES.length;
    return [
      {
        id: `demo-${idx}`,
        type: "image",
        url: DEMO_IMAGES[idx],
        thumb: DEMO_IMAGES[idx],
        source: "demo",
        query,
        photographer: "Pexels demo",
      },
    ];
  }

  const endpoint = opts?.video
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;

  const res = await fetch(endpoint, {
    headers: { Authorization: key },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Pexels error: ${res.status}`);
  }

  const data = await res.json();

  if (opts?.video) {
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

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
