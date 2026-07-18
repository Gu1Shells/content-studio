# Deploy no EasyPanel

## 1) Pré-requisitos
- VPS com EasyPanel instalado
- Domínio apontando (DNS A/CNAME) para o IP da VPS
- Repo: https://github.com/Gu1Shells/content-studio

## 2) Criar app no EasyPanel
1. **Projects** → criar/abrir projeto
2. **+ Service** → **App**
3. Source: **GitHub** → `Gu1Shells/content-studio` (branch `master`)
4. Build: **Dockerfile** (arquivo `Dockerfile` na raiz)
5. Port: **3001** (não use 3000 — o EasyPanel já usa)

## 3) Volumes (persistência)
Monte estes caminhos no serviço:

| Mount path | Tipo |
|---|---|
| `/app/data` | Volume (SQLite) |
| `/app/storage` | Volume (vídeos/áudios gerados) |

## 4) Variáveis de ambiente
Obrigatórias no EasyPanel:

```
DATABASE_URL=file:/app/data/prod.db
APP_URL=https://SEU-DOMINIO.com
PORT=3001
HOSTNAME=0.0.0.0
MONTHLY_BUDGET_USD=50
MOCK_PIPELINE=false
```

Opcionais (ou configure depois em `/settings` no painel):

```
OPENAI_API_KEY=
PEXELS_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```

## 5) Domínio
1. No serviço → **Domains** → **Add Domain**
2. Digite: `studio.seudominio.com` (ou o domínio raiz)
3. EasyPanel emite SSL (Let's Encrypt) automaticamente
4. No DNS do domínio:
   - Tipo **A** → IP da VPS, **ou**
   - **CNAME** → conforme o EasyPanel indicar

## 6) Depois do deploy
1. Abra `https://SEU-DOMINIO.com`
2. Vá em **Keys** e salve as APIs
3. Defina `APP_URL` = `https://SEU-DOMINIO.com`
4. Google OAuth (YouTube): adicione redirect  
   `https://SEU-DOMINIO.com/api/youtube/callback`
5. TikTok Login Kit: adicione redirect  
   `https://SEU-DOMINIO.com/api/tiktok/callback`
6. TikTok Web/Desktop URL pode passar a ser o domínio (além do GitHub Pages legal)

## 7) Redeploy
Push na branch `master` → EasyPanel rebuild (se auto-deploy estiver ligado), ou clique **Deploy**.

## Observações
- A imagem já inclui **FFmpeg** para render.
- Dados do banco e arquivos ficam nos volumes (não se perdem no rebuild).
- Terms/Privacy públicos também estão em:  
  `https://gu1shells.github.io/content-studio/terms.html`
