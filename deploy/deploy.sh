#!/usr/bin/env bash
# Deploy API — api.sizor.online → PM2 :3001
set -euo pipefail

APP_NAME="sizor-api"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> [$APP_NAME] Repo: $APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: falta .env en $APP_DIR"
  exit 1
fi

echo "==> Git fetch / reset..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> npm ci..."
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo "==> PM2 reload..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_DIR/deploy/ecosystem.config.cjs" --env production --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs" --env production
fi

pm2 save

echo "==> OK — $APP_NAME en http://127.0.0.1:3001 (Nginx: https://api.sizor.online)"
pm2 status "$APP_NAME"
