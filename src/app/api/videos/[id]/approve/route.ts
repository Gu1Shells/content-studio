import { NextResponse } from "next/server";
import { approveAndGenerate } from "@/lib/pipeline/orchestrator";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const video = await approveAndGenerate(id);
    return NextResponse.json(video);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
