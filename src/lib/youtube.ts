import { google } from "googleapis";
import fs from "fs";
import { getSetting, setSetting } from "@/lib/settings";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export async function getYoutubeOAuthClient() {
  const clientId = await getSetting("YOUTUBE_CLIENT_ID");
  const clientSecret = await getSetting("YOUTUBE_CLIENT_SECRET");
  const appUrl = (await getSetting("APP_URL")) || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    throw new Error("Configure YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET em /settings");
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl.replace(/\/$/, "")}/api/youtube/callback`);
}

export async function getYoutubeAuthUrl(state?: string) {
  const oauth2 = await getYoutubeOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: state || "content-studio",
  });
}

export async function exchangeYoutubeCode(code: string) {
  const oauth2 = await getYoutubeOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google não retornou tokens. Revogue o acesso do app e tente de novo.");
  }
  if (tokens.refresh_token) {
    await setSetting("YOUTUBE_REFRESH_TOKEN", tokens.refresh_token);
  }
  if (tokens.access_token) {
    await setSetting("YOUTUBE_ACCESS_TOKEN", tokens.access_token);
  }

  oauth2.setCredentials(tokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const me = await youtube.channels.list({ part: ["snippet", "id"], mine: true });
  const channel = me.data.items?.[0];
  if (channel?.id) {
    await setSetting("YOUTUBE_CHANNEL_ID", channel.id);
  }

  return {
    channelId: channel?.id || null,
    channelTitle: channel?.snippet?.title || null,
    hasRefreshToken: Boolean(tokens.refresh_token),
  };
}

export async function getAuthedYoutube() {
  const oauth2 = await getYoutubeOAuthClient();
  const refreshToken = await getSetting("YOUTUBE_REFRESH_TOKEN");
  if (!refreshToken) {
    throw new Error("YouTube não conectado. Vá em /settings e clique em Conectar YouTube.");
  }
  oauth2.setCredentials({ refresh_token: refreshToken });
  return { oauth2, youtube: google.youtube({ version: "v3", auth: oauth2 }) };
}

export async function getYoutubeConnectionStatus() {
  const clientId = await getSetting("YOUTUBE_CLIENT_ID");
  const clientSecret = await getSetting("YOUTUBE_CLIENT_SECRET");
  const refreshToken = await getSetting("YOUTUBE_REFRESH_TOKEN");
  const channelId = await getSetting("YOUTUBE_CHANNEL_ID");
  return {
    hasClient: Boolean(clientId && clientSecret),
    connected: Boolean(refreshToken),
    channelId: channelId || null,
  };
}

export type UploadInput = {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
  categoryId?: string;
  madeForKids?: boolean;
  isShort?: boolean;
};

export async function uploadToYoutube(input: UploadInput) {
  if (!fs.existsSync(input.filePath)) {
    throw new Error(`Arquivo não encontrado: ${input.filePath}`);
  }

  const { youtube } = await getAuthedYoutube();
  const title = input.isShort
    ? input.title.slice(0, 90)
    : input.title.slice(0, 100);

  const description = input.isShort
    ? `${input.description}\n\n#Shorts`
    : input.description;

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags: input.tags || ["curiosidades", "top10", "fatos"],
        categoryId: input.categoryId || "27", // Education
      },
      status: {
        privacyStatus: input.privacyStatus || "private",
        selfDeclaredMadeForKids: input.madeForKids ?? false,
      },
    },
    media: {
      body: fs.createReadStream(input.filePath),
    },
  });

  const id = res.data.id;
  if (!id) throw new Error("Upload YouTube sem videoId");

  return {
    videoId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    shortsUrl: input.isShort ? `https://www.youtube.com/shorts/${id}` : null,
  };
}
