import { NextResponse } from "next/server";
import { exchangeTikTokCode } from "@/lib/tiktok";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const saved = await getSetting("APP_URL");
  const appUrl = (saved || origin).replace(/\/$/, "");
  if (!saved || saved !== origin) {
    await setSetting("APP_URL", origin).catch(() => null);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?tiktok_error=${encodeURIComponent(errorDesc || error)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=missing_code`);
  }

  try {
    const result = await exchangeTikTokCode(code);
    const q = new URLSearchParams({
      tiktok_ok: "1",
      account: result.displayName || result.openId || "ok",
    });
    return NextResponse.redirect(`${appUrl}/settings?${q.toString()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "callback_failed";
    return NextResponse.redirect(
      `${appUrl}/settings?tiktok_error=${encodeURIComponent(msg.slice(0, 300))}`
    );
  }
}
