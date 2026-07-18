import { NextResponse } from "next/server";
import { exchangeYoutubeCode } from "@/lib/youtube";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  const origin = await resolvePublicOrigin(req);
  await setSetting("APP_URL", origin).catch(() => null);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?youtube_error=${encodeURIComponent(errorDesc || error)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?youtube_error=missing_code`);
  }

  try {
    const result = await exchangeYoutubeCode(code, origin);
    const q = new URLSearchParams({
      youtube_ok: "1",
      channel: result.channelTitle || result.channelId || "ok",
    });
    return NextResponse.redirect(`${origin}/settings?${q.toString()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "callback_failed";
    return NextResponse.redirect(
      `${origin}/settings?youtube_error=${encodeURIComponent(msg.slice(0, 300))}`
    );
  }
}
