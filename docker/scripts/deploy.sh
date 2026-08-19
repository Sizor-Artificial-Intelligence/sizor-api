#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

compose() {
  docker compose --env-file ../.env "$@"
}

echo "==> Deploying ghcr.io/sizor-artificial-intelligence/sizor-api:${IMAGE_TAG}"

# Contenedores actuales = los viejos a retirar después
OLD_IDS="$(compose ps -q app | tr '\n' ' ')"
echo "==> Current app container(s): ${OLD_IDS:-none}"

echo "==> Pulling app image..."
compose pull app

echo "==> Building nginx (if config changed)..."
compose build nginx

echo "==> Starting new app container alongside the current one..."
compose up -d --scale app=2 --no-recreate --wait

new_count=0
for id in $(compose ps -q app); do
  is_old=0
  for old in $OLD_IDS; do
    if [ "$id" = "$old" ]; then
      is_old=1
      break
    fi
  done
  if [ "$is_old" -eq 0 ]; then
    new_count=$((new_count + 1))
    echo "==> New container: $id"
  fi
done

# Compose a veces no crea réplica con --no-recreate (nombres altos tipo app-9)
if [ "$new_count" -eq 0 ] && [ -n "${OLD_IDS// /}" ]; then
  echo "==> Scale with --no-recreate created nothing new; retrying without it..."
  compose up -d --scale app=2 --wait
fi

removed=0
for old in $OLD_IDS; do
  if ! docker inspect "$old" >/dev/null 2>&1; then
    continue
  fi
  current_count="$(compose ps -q app | grep -c . || true)"
  if [ "$current_count" -le 1 ]; then
    echo "==> Skipping remove of $old (only one app container left)"
    break
  fi
  echo "==> Removing old app container: $old"
  docker stop "$old"
  docker rm "$old"
  removed=$((removed + 1))
done

if [ "$removed" -gt 0 ]; then
  compose exec -T nginx nginx -s reload || compose restart nginx
fi

echo "==> Scaling back to a single app replica..."
compose up -d --scale app=1 --no-recreate

echo "==> Waiting for app to become healthy..."
healthy=0
for i in $(seq 1 60); do
  if compose ps app 2>/dev/null | grep -q "(healthy)"; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "ERROR: App failed to become healthy"
  compose logs --tail=80 app
  exit 1
fi

compose exec -T nginx nginx -s reload || true

echo "==> Pruning unused images..."
docker image prune -f

echo "==> Deploy complete."
compose ps
