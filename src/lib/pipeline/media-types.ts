export type MediaHit = {
  id: string;
  type: "image" | "video";
  url: string;
  thumb: string;
  photographer?: string;
  source: "pexels" | "unsplash" | "serper" | "wikimedia" | "demo";
  query: string;
  copyrightRisk?: boolean;
};
