import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const budgetRaw = await getSetting("MONTHLY_BUDGET_USD");
  const budget = Number(budgetRaw || "50") || 50;

  const [videos, costs, byStatus] = await Promise.all([
    prisma.video.count(),
    prisma.costEntry.aggregate({ _sum: { totalUsd: true } }),
    prisma.video.groupBy({ by: ["status"], _count: true }),
  ]);

  const recent = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      estimatedCostUsd: true,
      actualCostUsd: true,
      scheduledAt: true,
      publishedAt: true,
      createdAt: true,
      format: true,
    },
  });

  const monthSpend = costs._sum.totalUsd || 0;
  const avg = videos > 0 ? monthSpend / videos : 0.08;
  const projectedVideos = avg > 0 ? Math.floor(budget / avg) : null;

  const keys = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "OPENAI_API_KEY",
          "PEXELS_API_KEY",
          "ELEVENLABS_API_KEY",
          "YOUTUBE_CLIENT_ID",
          "TIKTOK_CLIENT_KEY",
        ],
      },
    },
    select: { key: true },
  });
  const envFallback = [
    "OPENAI_API_KEY",
    "PEXELS_API_KEY",
    "ELEVENLABS_API_KEY",
    "YOUTUBE_CLIENT_ID",
    "TIKTOK_CLIENT_KEY",
  ].filter((k) => Boolean(process.env[k]?.trim()));

  const configuredKeys = new Set([...keys.map((k) => k.key), ...envFallback]);

  return NextResponse.json({
    totals: {
      videos,
      spendUsd: monthSpend,
      budgetUsd: budget,
      remainingUsd: Math.max(budget - monthSpend, 0),
      projectedVideosAtBudget: projectedVideos,
      configuredIntegrations: configuredKeys.size,
    },
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    recent,
  });
}
