import { NextResponse } from "next/server";
import { getTikTokAuthUrl, getTikTokConnectionStatus } from "@/lib/tiktok";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const current = await getSetting("APP_URL");
    if (!current) {
      await setSetting("APP_URL", origin);
    }
    const url = await getTikTokAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro OAuth TikTok";
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(
      `${origin}/settings?tiktok_error=${encodeURIComponent(msg)}`
    );
  }
}

export async function POST() {
  try {
    const status = await getTikTokConnectionStatus();
    if (!status.hasClient) {
      return NextResponse.json(
        { error: "Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET" },
        { status: 400 }
      );
    }
    const url = await getTikTokAuthUrl();
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 }
    );
  }
}
