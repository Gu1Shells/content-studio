import { NextResponse } from "next/server";
import { getYoutubeAuthUrl, getYoutubeConnectionStatus } from "@/lib/youtube";

export async function GET() {
  try {
    const status = await getYoutubeConnectionStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const url = await getYoutubeAuthUrl();
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 }
    );
  }
}
