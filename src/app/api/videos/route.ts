import { NextResponse } from "next/server";
import { z } from "zod";
import { createVideoFromPrompt } from "@/lib/pipeline/orchestrator";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  prompt: z.string().min(8).max(2000),
  format: z.enum(["long", "shorts", "both"]).optional(),
  niche: z.string().optional(),
});

export async function GET() {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { assets: true } } },
  });
  return NextResponse.json(videos);
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const video = await createVideoFromPrompt(parsed.data);
  return NextResponse.json(video);
}
