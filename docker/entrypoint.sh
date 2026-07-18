#!/bin/sh
set -e

mkdir -p /app/data /app/storage

# Sempre persiste no volume /app/data (evita SQLite dentro da imagem efêmera)
if [ -z "$DATABASE_URL" ] || echo "$DATABASE_URL" | grep -qE '^file:\./|^file:dev\.db'; then
  export DATABASE_URL="file:/app/data/prod.db"
fi

echo "[content-studio] DATABASE_URL=$DATABASE_URL"
echo "[content-studio] PORT=${PORT:-3001}"

if grep -Eq ' /app/data( |$)' /proc/mounts 2>/dev/null; then
  echo "[content-studio] OK: /app/data está em volume persistente"
else
  echo "[content-studio] AVISO: /app/data NÃO parece montado. Keys/banco serão perdidos no redeploy."
  echo "[content-studio] No EasyPanel: Mounts → path /app/data (volume) e /app/storage (volume)"
fi

if grep -Eq ' /app/storage( |$)' /proc/mounts 2>/dev/null; then
  echo "[content-studio] OK: /app/storage está em volume persistente"
else
  echo "[content-studio] AVISO: /app/storage NÃO parece montado. Vídeos gerados podem sumir no redeploy."
fi

echo "[content-studio] Running Prisma migrations..."
npx prisma migrate deploy

echo "[content-studio] Starting Next.js on :${PORT:-3001}"
exec node server.js
