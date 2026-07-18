import { NextResponse } from "next/server";
import { exchangeYoutubeCode } from "@/lib/youtube";
import { setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  await setSetting("APP_URL", origin).catch(() => null);
  const appUrl = origin;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?youtube_error=${encodeURIComponent(errorDesc || error)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?youtube_error=missing_code`);
  }

  try {
    const result = await exchangeYoutubeCode(code, origin);
    const q = new URLSearchParams({
      youtube_ok: "1",
      channel: result.channelTitle || result.channelId || "ok",
    });
    return NextResponse.redirect(`${appUrl}/settings?${q.toString()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "callback_failed";
    return NextResponse.redirect(
      `${appUrl}/settings?youtube_error=${encodeURIComponent(msg.slice(0, 300))}`
    );
  }
}
