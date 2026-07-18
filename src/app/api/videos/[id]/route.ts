import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSuggestion } from "@/lib/pipeline/orchestrator";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: { assets: true, jobs: true, costEntries: true },
  });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...video, suggestion: parseSuggestion(video) });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["title", "status", "scheduledAt", "scriptJson", "prompt"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);
  const video = await prisma.video.update({ where: { id }, data });
  return NextResponse.json(video);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.video.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
