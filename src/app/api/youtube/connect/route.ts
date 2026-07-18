import { NextResponse } from "next/server";
import { getYoutubeAuthUrl, getYoutubeConnectionStatus } from "@/lib/youtube";
import { getSetting } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    // Garante APP_URL a partir do host atual se estiver vazio
    const current = await getSetting("APP_URL");
    if (!current) {
      const origin = new URL(req.url).origin;
      const { setSetting } = await import("@/lib/settings");
      await setSetting("APP_URL", origin);
    }
    const url = await getYoutubeAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro OAuth";
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(
      `${origin}/settings?youtube_error=${encodeURIComponent(msg)}`
    );
  }
}

export async function POST() {
  try {
    const status = await getYoutubeConnectionStatus();
    if (!status.hasClient) {
      return NextResponse.json(
        { error: "Configure YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET" },
        { status: 400 }
      );
    }
    const url = await getYoutubeAuthUrl();
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 }
    );
  }
}
