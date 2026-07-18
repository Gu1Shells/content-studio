# Content Studio

Estúdio interno (depois SaaS) para canal de **curiosidades**: prompt → plano + custo → aprovação → assets → agenda → (futuro) post YouTube/Shorts/TikTok.

## O que já funciona

- Briefing por prompt (ex.: “Top 10 lugares mais bonitos do mundo”)
- Sugestão com gancho, roteiro (começo/meio/fim), CTAs de like/inscrição
- Estimativa de custo antes de aprovar
- Busca de imagens/vídeos via **Pexels** (royalty-free) — **não** Google scrape
- Histórico, pausar, excluir, cronograma, dashboard de gastos
- Alerta de risco de copyright (ex.: GTA 6 / IPs de jogos)

## O que vem na sequência

- TTS real (ElevenLabs) + legendas karaoke
- Render FFmpeg/Remotion na VPS Hostinger
- OAuth YouTube + upload
- TikTok posting
- Multi-tenant + Stripe (revenda)

## Resposta direta: “dá para achar imagens do GTA 6?”

**Tecnicamente** dá para buscar na web. **Para monetizar no YouTube, não é o caminho.**
Assets oficiais/gameplay de GTA 6 são IP da Rockstar → claim / desmonetização.

No sistema:
- Lugares, natureza, ciência → Pexels/Unsplash (seguro)
- Temas com IP (GTA, Disney, etc.) → o plano marca **risco** e a estratégia deve usar arte estilizada / genérica, não scrape de Google com arte oficial

## Setup local

```bash
cd content-studio
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

Abra http://localhost:3000

## Keys (importante)

Abra **http://localhost:3000/settings** e preencha:

- **OpenAI** — roteiro real (gpt-4o-mini)
- **Pexels** (grátis) — imagens/vídeos
- **ElevenLabs** — voz
- **YouTube** — Client ID/Secret + botão **Conectar YouTube**

### YouTube OAuth (checklist)

1. Google Cloud → criar OAuth Client (Web)
2. Ativar **YouTube Data API v3**
3. Redirect URI: `http://localhost:3000/api/youtube/callback` (ou seu domínio)
4. Salvar Client ID/Secret + `APP_URL` em `/settings`
5. Clicar **Conectar YouTube**
6. No vídeo `ready` com `final.mp4` → **Enviar ao YouTube (privado)**

## Pipeline atual ao aprovar

1. Roteiro (OpenAI se key existir, senão template)
2. Imagens (Pexels)
3. TTS (ElevenLabs ou demo texto)
4. Legendas `.srt`
5. Render FFmpeg na VPS (ou manifesto se FFmpeg não estiver instalado)
6. Publicar YouTube (manual no botão)


## Deploy na VPS Hostinger

1. Node 20+ na VPS
2. Clone o repo / copie `content-studio`
3. `npm ci && npx prisma migrate deploy && npm run build`
4. `npm run start` (ou PM2: `pm2 start npm --name content-studio -- start`)
5. Nginx/Caddy proxy para a porta 3000
6. Depois: instalar FFmpeg na VPS para o render

SQLite serve para uso interno single-node. Quando for SaaS multi-user, migre `DATABASE_URL` para Postgres.

## Fluxo do produto

1. Usuário digita o prompt
2. Sistema devolve título, roteiro, CTAs, queries de mídia e **US$ estimado**
3. Usuário aprova
4. Sistema baixa assets (Pexels), registra custos, deixa status `ready`
5. Agenda / (futuro) publica
