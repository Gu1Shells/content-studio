import { prisma } from "@/lib/db";
import { ALL_SETTING_KEYS } from "@/lib/settings-catalog";

const cache = new Map<string, { value: string; at: number }>();
const TTL_MS = 5_000;

/** Lê setting do DB; fallback para process.env. */
export async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const row = await prisma.appSetting.findUnique({ where: { key } });
  const value = (row?.value ?? process.env[key] ?? "").trim();
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    keys.map(async (key) => {
      out[key] = await getSetting(key);
    })
  );
  return out;
}

export async function setSetting(key: string, value: string) {
  if (!ALL_SETTING_KEYS.includes(key)) {
    throw new Error(`Setting não permitido: ${key}`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key } });
    cache.delete(key);
    return;
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: trimmed },
    update: { value: trimmed },
  });
  cache.set(key, { value: trimmed, at: Date.now() });
}

export function clearSettingsCache() {
  cache.clear();
}

export async function hasKey(key: string): Promise<boolean> {
  const v = await getSetting(key);
  return v.length > 0;
}
