#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

cd "$SCRIPT_DIR"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker is missing. Run: bash deployment/install.sh"
  exit 1
fi

if [ -d "$PROJECT_ROOT/.git" ]; then
  git -C "$PROJECT_ROOT" rev-parse HEAD > "$SCRIPT_DIR/.previous_revision.tmp" || true
  if [ -f "$SCRIPT_DIR/.current_revision" ]; then
    cp "$SCRIPT_DIR/.current_revision" "$SCRIPT_DIR/.previous_revision"
  elif [ -s "$SCRIPT_DIR/.previous_revision.tmp" ]; then
    cp "$SCRIPT_DIR/.previous_revision.tmp" "$SCRIPT_DIR/.previous_revision"
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$SCRIPT_DIR/.env.production.example" "$ENV_FILE"
  MYSQL_PASSWORD="$(openssl rand -hex 32)"
  MYSQL_ROOT_PASSWORD="$(openssl rand -hex 32)"
  ADMIN_SESSION_SECRET="$(openssl rand -hex 48)"
  sed -i "s|MYSQL_PASSWORD=auto|MYSQL_PASSWORD=${MYSQL_PASSWORD}|g" "$ENV_FILE"
  sed -i "s|MYSQL_ROOT_PASSWORD=auto|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}|g" "$ENV_FILE"
  sed -i "s|ADMIN_SESSION_SECRET=auto|ADMIN_SESSION_SECRET=${ADMIN_SESSION_SECRET}|g" "$ENV_FILE"
  sed -i "s|mysql://mykinlegacy:auto@mysql:3306/mykinlegacy|mysql://mykinlegacy:${MYSQL_PASSWORD}@mysql:3306/mykinlegacy|g" "$ENV_FILE"
  echo "Created deployment/.env.production with generated local secrets."
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

DOMAIN="${DOMAIN:-216.128.154.152}"
PUBLIC_IP="${PUBLIC_IP:-216.128.154.152}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-support@mykinlegacy.com}"
TLS_MODE="${TLS_MODE:-self_signed}"

if [[ "${MYSQL_PASSWORD:-}" == "auto" || "${MYSQL_ROOT_PASSWORD:-}" == "auto" || "${ADMIN_SESSION_SECRET:-}" == "auto" ]]; then
  echo "Secrets were not generated in deployment/.env.production."
  exit 1
fi

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "Creating Docker volumes..."
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_mysql_data" >/dev/null
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_redis_data" >/dev/null
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_node_store" >/dev/null
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_private_storage" >/dev/null

compose stop nginx >/dev/null 2>&1 || true
bash "$SCRIPT_DIR/ssl-init.sh"

echo "Starting MySQL and Redis..."
compose up -d mysql redis

echo "Running database migrations..."
compose run --rm api sh -lc "corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm db:generate && corepack pnpm db:migrate:deploy"

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Running seed data..."
  compose run --rm api sh -lc "corepack pnpm db:seed"
fi

echo "Building production workspaces..."
compose run --rm api sh -lc "corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm db:generate && corepack pnpm --filter @ai-heritage/api... build && corepack pnpm --filter @ai-heritage/worker... build && NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api/v1 NEXT_PUBLIC_SITE_URL=https://${DOMAIN} APP_WEB_URL=https://${DOMAIN} APP_BASE_URL=https://${DOMAIN} corepack pnpm --filter @ai-heritage/web... build"

echo "Building and starting application services..."
compose up -d --build api worker web nginx

if [ -d "$PROJECT_ROOT/.git" ]; then
  git -C "$PROJECT_ROOT" rev-parse HEAD > "$SCRIPT_DIR/.current_revision" || true
fi

echo "Running health check..."
bash "$SCRIPT_DIR/health-check.sh"

echo "PASS deployment complete"
echo "Open: https://${DOMAIN}"
