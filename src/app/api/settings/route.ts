import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ALL_SETTING_KEYS,
  SETTING_GROUPS,
  maskSecret,
} from "@/lib/settings-catalog";
import { clearSettingsCache, setSetting } from "@/lib/settings";

export async function GET() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ALL_SETTING_KEYS } },
  });
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const groups = SETTING_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.map((field) => {
      const dbValue = dbMap[field.key] || "";
      const envValue = (process.env[field.key] || "").trim();
      const effective = dbValue || envValue;
      const source = dbValue ? "database" : envValue ? "env" : "empty";
      return {
        ...field,
        configured: Boolean(effective),
        source,
        // Nunca devolve o segredo completo
        value: field.secret
          ? effective
            ? maskSecret(effective)
            : ""
          : effective,
        hasValue: Boolean(effective),
      };
    }),
  }));

  return NextResponse.json({ groups });
}

const putSchema = z.object({
  values: z.record(z.string(), z.string()),
});

export async function PUT(req: Request) {
  const json = await req.json();
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: string[] = [];
  for (const [key, raw] of Object.entries(parsed.data.values)) {
    if (!ALL_SETTING_KEYS.includes(key)) continue;
    // Se o cliente reenviar o valor mascarado, ignora (não sobrescreve)
    if (raw.includes("••••")) continue;
    await setSetting(key, raw);
    updates.push(key);
  }

  clearSettingsCache();
  return NextResponse.json({ ok: true, updated: updates });
}
