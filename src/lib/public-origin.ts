import { getSetting, setSetting } from "@/lib/settings";

/** Monta a URL pública correta atrás do EasyPanel/proxy (nunca 0.0.0.0). */
export async function resolvePublicOrigin(req: Request): Promise<string> {
  const saved = (await getSetting("APP_URL")).trim().replace(/\/$/, "");
  if (saved && isPublicOrigin(saved)) {
    return saved;
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host?.includes("localhost") ? "http" : "https");

  if (host && !isInternalHost(host)) {
    const origin = `${proto}://${host}`.replace(/\/$/, "");
    if (isPublicOrigin(origin)) {
      await setSetting("APP_URL", origin).catch(() => null);
      return origin;
    }
  }

  // Último recurso: domínio de produção conhecido
  const fallback = "https://studio.neonux.com.br";
  await setSetting("APP_URL", fallback).catch(() => null);
  return fallback;
}

function isInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.startsWith("0.0.0.0") ||
    h.startsWith("127.0.0.1") ||
    h.startsWith("::1") ||
    h.includes("localhost") && !h.includes(".")
  );
}

function isPublicOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) return false;
    return !isInternalHost(u.host);
  } catch {
    return false;
  }
}
