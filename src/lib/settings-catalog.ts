export type SettingField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  help?: string;
  helpUrl?: string;
};

export type SettingGroup = {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
};

/** Catálogo de keys/configurações editáveis na UI */
export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: "llm",
    title: "Roteiro / IA",
    description: "Gera e melhora roteiros, ganchos e títulos.",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API Key",
        secret: true,
        placeholder: "sk-...",
        help: "ChatGPT / GPT para roteiro",
        helpUrl: "https://platform.openai.com/api-keys",
      },
      {
        key: "OPENAI_MODEL",
        label: "OpenAI Model",
        placeholder: "gpt-4o-mini",
        help: "Padrão econômico: gpt-4o-mini",
      },
      {
        key: "ANTHROPIC_API_KEY",
        label: "Anthropic API Key",
        secret: true,
        placeholder: "sk-ant-...",
        help: "Claude (opcional)",
        helpUrl: "https://console.anthropic.com/",
      },
    ],
  },
  {
    id: "media",
    title: "Imagens & vídeo stock",
    description: "Mídia royalty-free. Não use scrape do Google.",
    fields: [
      {
        key: "PEXELS_API_KEY",
        label: "Pexels API Key",
        secret: true,
        help: "Grátis — imagens e vídeos",
        helpUrl: "https://www.pexels.com/api/",
      },
      {
        key: "UNSPLASH_ACCESS_KEY",
        label: "Unsplash Access Key",
        secret: true,
        help: "Fallback de imagens (opcional)",
        helpUrl: "https://unsplash.com/developers",
      },
    ],
  },
  {
    id: "voice",
    title: "Voz (TTS)",
    description: "Narração do roteiro. Principal custo variável no budget.",
    fields: [
      {
        key: "ELEVENLABS_API_KEY",
        label: "ElevenLabs API Key",
        secret: true,
        helpUrl: "https://elevenlabs.io/app/settings/api-keys",
      },
      {
        key: "ELEVENLABS_VOICE_ID",
        label: "ElevenLabs Voice ID",
        placeholder: "21m00Tcm4TlvDq8ikWAM",
        help: "ID da voz no painel ElevenLabs",
      },
    ],
  },
  {
    id: "youtube",
    title: "YouTube",
    description: "OAuth para upload de vídeos longos e Shorts.",
    fields: [
      {
        key: "YOUTUBE_CLIENT_ID",
        label: "Client ID",
        secret: true,
        helpUrl: "https://console.cloud.google.com/apis/credentials",
      },
      {
        key: "YOUTUBE_CLIENT_SECRET",
        label: "Client Secret",
        secret: true,
      },
      {
        key: "YOUTUBE_REFRESH_TOKEN",
        label: "Refresh Token",
        secret: true,
        help: "Preenchido automaticamente ao clicar em Conectar YouTube",
      },
      {
        key: "YOUTUBE_ACCESS_TOKEN",
        label: "Access Token",
        secret: true,
        help: "Atualizado no OAuth (opcional visualizar)",
      },
      {
        key: "YOUTUBE_CHANNEL_ID",
        label: "Channel ID",
        placeholder: "UCxxxxxxxx",
        help: "Preenchido após conectar o canal",
      },
    ],
  },
  {
    id: "tiktok",
    title: "TikTok",
    description: "Login Kit + Content Posting (rascunho). Redirect: {APP_URL}/api/tiktok/callback",
    fields: [
      {
        key: "TIKTOK_CLIENT_KEY",
        label: "Client Key",
        secret: true,
        helpUrl: "https://developers.tiktok.com/",
      },
      {
        key: "TIKTOK_CLIENT_SECRET",
        label: "Client Secret",
        secret: true,
      },
      {
        key: "TIKTOK_ACCESS_TOKEN",
        label: "Access Token",
        secret: true,
        help: "Preenchido ao conectar",
      },
      {
        key: "TIKTOK_REFRESH_TOKEN",
        label: "Refresh Token",
        secret: true,
        help: "Preenchido ao conectar",
      },
      {
        key: "TIKTOK_OPEN_ID",
        label: "Open ID",
        help: "Preenchido ao conectar",
      },
      {
        key: "TIKTOK_DISPLAY_NAME",
        label: "Display Name",
        help: "Conta conectada",
      },
    ],
  },
  {
    id: "app",
    title: "App & orçamento",
    description: "Configurações gerais do estúdio.",
    fields: [
      {
        key: "APP_URL",
        label: "URL do app",
        placeholder: "https://studio.neonux.com.br",
        help: "Produção: https://studio.neonux.com.br — OAuth YouTube/TikTok usam este domínio",
      },
      {
        key: "MONTHLY_BUDGET_USD",
        label: "Budget mensal (USD)",
        placeholder: "50",
        help: "Usado no dashboard de custos",
      },
      {
        key: "MOCK_PIPELINE",
        label: "Modo demo (true/false)",
        placeholder: "false",
        help: "true = não chama APIs pagas se faltar key",
      },
    ],
  },
];

export const ALL_SETTING_KEYS = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
