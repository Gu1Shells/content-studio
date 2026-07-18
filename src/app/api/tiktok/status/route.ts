import { NextResponse } from "next/server";
import { getTikTokConnectionStatus } from "@/lib/tiktok";

export async function GET() {
  try {
    const status = await getTikTokConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    );
  }
}
