import { NextResponse } from "next/server";
import { getTikTokAuthUrl, getTikTokConnectionStatus } from "@/lib/tiktok";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const origin = await resolvePublicOrigin(req);
    await setSetting("APP_URL", origin);
    const url = await getTikTokAuthUrl();
    // getTikTokAuthUrl usa APP_URL das settings — já atualizado acima
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro OAuth TikTok";
    const origin = await resolvePublicOrigin(req).catch(() => "https://studio.neonux.com.br");
    return NextResponse.redirect(
      `${origin}/settings?tiktok_error=${encodeURIComponent(msg)}`
    );
  }
}

export async function POST(req: Request) {
  try {
    const origin = await resolvePublicOrigin(req);
    await setSetting("APP_URL", origin);
    const status = await getTikTokConnectionStatus();
    if (!status.hasClient) {
      return NextResponse.json(
        { error: "Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET" },
        { status: 400 }
      );
    }
    const url = await getTikTokAuthUrl();
    return NextResponse.json({ url, origin });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 }
    );
  }
}
