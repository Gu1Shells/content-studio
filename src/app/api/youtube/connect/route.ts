import { NextResponse } from "next/server";
import { getYoutubeAuthUrl, getYoutubeConnectionStatus, getYoutubeRedirectUri } from "@/lib/youtube";
import { setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  try {
    // Sempre alinha APP_URL ao domínio real (evita localhost antigo)
    await setSetting("APP_URL", origin);
    const redirectUri = await getYoutubeRedirectUri(origin);
    const url = await getYoutubeAuthUrl("content-studio", origin);
    // Se algo falhar no Google, o usuário vê o redirect esperado na query
    const res = NextResponse.redirect(url);
    res.headers.set("x-youtube-redirect-uri", redirectUri);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro OAuth";
    const redirectUri = await getYoutubeRedirectUri(origin).catch(() => `${origin}/api/youtube/callback`);
    return NextResponse.redirect(
      `${origin}/settings?youtube_error=${encodeURIComponent(`${msg} | Use no Google: ${redirectUri}`)}`
    );
  }
}

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    await setSetting("APP_URL", origin);
    const status = await getYoutubeConnectionStatus();
    if (!status.hasClient) {
      return NextResponse.json(
        { error: "Configure YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET" },
        { status: 400 }
      );
    }
    const redirectUri = await getYoutubeRedirectUri(origin);
    const url = await getYoutubeAuthUrl("content-studio", origin);
    return NextResponse.json({ url, redirectUri });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 }
    );
  }
}
