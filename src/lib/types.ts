export type VideoFormat = "long" | "shorts" | "both";

export type ScriptSection = {
  id: string;
  role: "hook" | "intro" | "item" | "cta_mid" | "outro";
  title: string;
  narration: string;
  visualQuery: string;
  durationSec: number;
  itemNumber?: number;
};

export type ProductionPlan = {
  title: string;
  format: VideoFormat;
  angle: string;
  hooks: string[];
  outline: string[];
  ctaStrategy: string[];
  risks: string[];
  mediaStrategy: string;
  estimatedDurationSec: number;
  itemCount: number;
  searchQueries: string[];
};

export type CostEstimate = {
  currency: "USD";
  totalUsd: number;
  breakdown: {
    provider: string;
    kind: string;
    units: number;
    unitCostUsd: number;
    totalUsd: number;
    note: string;
  }[];
  assumptions: string[];
};

export type SuggestionPayload = {
  plan: ProductionPlan;
  script: ScriptSection[];
  estimate: CostEstimate;
};
