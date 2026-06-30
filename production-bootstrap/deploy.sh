#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [ ! -f "$ENV_FILE" ]; then
  cp "$SCRIPT_DIR/.env.production.example" "$ENV_FILE"
  if command -v openssl >/dev/null 2>&1; then
    MYSQL_PASSWORD="$(openssl rand -hex 32 | tr -d '\n')"
    MYSQL_ROOT_PASSWORD="$(openssl rand -hex 32 | tr -d '\n')"
    ADMIN_SESSION_SECRET="$(openssl rand -hex 48 | tr -d '\n')"
    sed -i "s|MYSQL_PASSWORD=replace_me_generate_on_server|MYSQL_PASSWORD=${MYSQL_PASSWORD}|g" "$ENV_FILE"
    sed -i "s|MYSQL_ROOT_PASSWORD=replace_me_generate_on_server|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}|g" "$ENV_FILE"
    sed -i "s|ADMIN_SESSION_SECRET=replace_me_generate_on_server|ADMIN_SESSION_SECRET=${ADMIN_SESSION_SECRET}|g" "$ENV_FILE"
    sed -i "s|mysql://mykinlegacy:replace_me_generate_on_server@mysql:3306/mykinlegacy|mysql://mykinlegacy:${MYSQL_PASSWORD}@mysql:3306/mykinlegacy|g" "$ENV_FILE"
  fi
  echo "Created .env.production from example."
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

DOMAIN="${DOMAIN:-mykinlegacy.com}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-support@mykinlegacy.com}"

if [[ "${MYSQL_PASSWORD:-}" == replace_me* || "${MYSQL_ROOT_PASSWORD:-}" == replace_me* ]]; then
  echo "Database passwords were not generated. Install openssl or edit .env.production manually."
  exit 1
fi

if [ "$DOMAIN" != "mykinlegacy.com" ]; then
  echo "This bootstrap nginx.conf is pinned to mykinlegacy.com."
  echo "Update production-bootstrap/nginx.conf before using DOMAIN=$DOMAIN."
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  echo "Installing Docker and Docker Compose plugin..."
  $SUDO apt-get update
  $SUDO apt-get install -y ca-certificates curl gnupg lsb-release docker.io docker-compose-plugin
  $SUDO systemctl enable --now docker
}

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

install_docker

echo "Preparing Docker volumes..."
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_letsencrypt" >/dev/null
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_certbot_webroot" >/dev/null

if ! $SUDO docker run --rm -v "${COMPOSE_PROJECT_NAME}_letsencrypt":/etc/letsencrypt alpine sh -c "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
  echo "Requesting Let's Encrypt certificate for ${DOMAIN} and www.${DOMAIN}..."
  echo "DNS A records must already point to this Vultr server before this step."
  $SUDO docker run --rm \
    -p 80:80 \
    -v "${COMPOSE_PROJECT_NAME}_letsencrypt":/etc/letsencrypt \
    certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$LETSENCRYPT_EMAIL" \
    -d "$DOMAIN" \
    -d "www.${DOMAIN}"
fi

echo "Starting MySQL and Redis..."
compose up -d mysql redis

echo "Running Prisma generate, migrations, and seed data..."
compose run --rm api sh -lc "corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm db:generate && corepack pnpm db:migrate:deploy && corepack pnpm db:seed"

echo "Starting application services..."
compose up -d api worker web nginx

echo "Waiting for services to settle..."
sleep 10

bash "$SCRIPT_DIR/deploy-health-check.sh"
