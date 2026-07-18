import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_SETTING_KEYS } from "@/lib/settings-catalog";
import { clearSettingsCache, setSetting } from "@/lib/settings";

const schema = z.object({ key: z.string() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "key inválida" }, { status: 400 });
  }
  if (!ALL_SETTING_KEYS.includes(parsed.data.key)) {
    return NextResponse.json({ error: "key não permitida" }, { status: 400 });
  }
  await setSetting(parsed.data.key, "");
  clearSettingsCache();
  return NextResponse.json({ ok: true });
}
