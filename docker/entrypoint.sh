#!/bin/sh
set -e

mkdir -p /app/data /app/storage

echo "[content-studio] Running Prisma migrations..."
npx prisma migrate deploy

echo "[content-studio] Starting Next.js on :${PORT:-3001}"
exec node server.js
