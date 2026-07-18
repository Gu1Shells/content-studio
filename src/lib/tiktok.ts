import fs from "fs";
import { getSetting, setSetting } from "@/lib/settings";

const TIKTOK_AUTH = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_INBOX_INIT = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const TIKTOK_STATUS = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const SCOPES = ["user.info.basic", "video.upload"].join(",");

async function getAppUrl() {
  const appUrl = (await getSetting("APP_URL")) || "https://studio.neonux.com.br";
  const cleaned = appUrl.replace(/\/$/, "");
  // Nunca use bind interno do Docker como redirect
  if (/0\.0\.0\.0|127\.0\.0\.1/.test(cleaned)) {
    return "https://studio.neonux.com.br";
  }
  return cleaned;
}

export async function getTikTokRedirectUri() {
  return `${await getAppUrl()}/api/tiktok/callback`;
}

export async function getTikTokCredentials() {
  const clientKey = await getSetting("TIKTOK_CLIENT_KEY");
  const clientSecret = await getSetting("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) {
    throw new Error("Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET em /settings");
  }
  return { clientKey, clientSecret };
}

export async function getTikTokAuthUrl(state?: string) {
  const { clientKey } = await getTikTokCredentials();
  const redirectUri = await getTikTokRedirectUri();
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state || "content-studio",
  });
  return `${TIKTOK_AUTH}?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string) {
  const { clientKey, clientSecret } = await getTikTokCredentials();
  const redirectUri = await getTikTokRedirectUri();

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || data.error || data.message === "error") {
    throw new Error(
      data.error_description || data.error || data.message || `Token TikTok falhou (${res.status})`
    );
  }

  const accessToken = data.access_token as string | undefined;
  const refreshToken = data.refresh_token as string | undefined;
  const openId = data.open_id as string | undefined;

  if (!accessToken) throw new Error("TikTok não retornou access_token");

  await setSetting("TIKTOK_ACCESS_TOKEN", accessToken);
  if (refreshToken) await setSetting("TIKTOK_REFRESH_TOKEN", refreshToken);
  if (openId) await setSetting("TIKTOK_OPEN_ID", openId);

  let displayName: string | null = null;
  try {
    const u = await fetch(
      `${TIKTOK_USER}?fields=${encodeURIComponent("open_id,display_name,avatar_url")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const uj = await u.json();
    displayName = uj?.data?.user?.display_name || null;
    if (displayName) await setSetting("TIKTOK_DISPLAY_NAME", displayName);
  } catch {
    // opcional
  }

  return {
    openId: openId || null,
    displayName,
    hasRefreshToken: Boolean(refreshToken),
  };
}

export async function refreshTikTokAccessToken() {
  const { clientKey, clientSecret } = await getTikTokCredentials();
  const refreshToken = await getSetting("TIKTOK_REFRESH_TOKEN");
  if (!refreshToken) throw new Error("TikTok sem refresh_token. Conecte de novo em /settings.");

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "Falha ao renovar token TikTok");
  }
  await setSetting("TIKTOK_ACCESS_TOKEN", data.access_token);
  if (data.refresh_token) await setSetting("TIKTOK_REFRESH_TOKEN", data.refresh_token);
  return data.access_token as string;
}

export async function getValidTikTokAccessToken() {
  let token = await getSetting("TIKTOK_ACCESS_TOKEN");
  if (!token) {
    const refresh = await getSetting("TIKTOK_REFRESH_TOKEN");
    if (!refresh) throw new Error("TikTok não conectado. Vá em /settings e clique em Conectar TikTok.");
    token = await refreshTikTokAccessToken();
  }
  return token;
}

export async function getTikTokConnectionStatus() {
  const clientKey = await getSetting("TIKTOK_CLIENT_KEY");
  const clientSecret = await getSetting("TIKTOK_CLIENT_SECRET");
  const access = await getSetting("TIKTOK_ACCESS_TOKEN");
  const refresh = await getSetting("TIKTOK_REFRESH_TOKEN");
  const openId = await getSetting("TIKTOK_OPEN_ID");
  const displayName = await getSetting("TIKTOK_DISPLAY_NAME");
  return {
    hasClient: Boolean(clientKey && clientSecret),
    connected: Boolean(access || refresh),
    openId: openId || null,
    displayName: displayName || null,
  };
}

/**
 * Envia vídeo para a caixa de entrada (rascunho) — scope video.upload.
 * O criador finaliza no app TikTok.
 */
export async function uploadToTikTokInbox(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const videoSize = stat.size;
  if (videoSize < 1) throw new Error("Arquivo de vídeo vazio");

  let accessToken = await getValidTikTokAccessToken();

  const initOnce = async (token: string) => {
    const res = await fetch(TIKTOK_INBOX_INIT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });
    return { res, json: await res.json() };
  };

  let { res: initRes, json: initJson } = await initOnce(accessToken);
  if (initRes.status === 401 || initJson?.error?.code === "access_token_invalid") {
    accessToken = await refreshTikTokAccessToken();
    ({ res: initRes, json: initJson } = await initOnce(accessToken));
  }

  if (initJson?.error?.code && initJson.error.code !== "ok") {
    throw new Error(
      initJson.error.message || initJson.error.code || "Falha ao iniciar upload TikTok"
    );
  }

  const uploadUrl = initJson?.data?.upload_url as string | undefined;
  const publishId = initJson?.data?.publish_id as string | undefined;
  if (!uploadUrl || !publishId) {
    throw new Error(`TikTok init sem upload_url/publish_id: ${JSON.stringify(initJson).slice(0, 300)}`);
  }

  const fileBuf = fs.readFileSync(filePath);
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoSize),
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: fileBuf,
  });

  if (!put.ok) {
    const errText = await put.text();
    throw new Error(`Upload TikTok falhou (${put.status}): ${errText.slice(0, 200)}`);
  }

  // Status (best-effort)
  let status = "PROCESSING";
  try {
    const st = await fetch(TIKTOK_STATUS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const sj = await st.json();
    status = sj?.data?.status || status;
  } catch {
    // ignore
  }

  return {
    publishId,
    status,
    note: "Vídeo enviado como rascunho (inbox). Abra o app TikTok para editar e publicar.",
  };
}
