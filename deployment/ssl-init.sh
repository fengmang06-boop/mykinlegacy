#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production missing"
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

DOMAIN="${DOMAIN:-mykinlegacy.com}"
PUBLIC_IP="${PUBLIC_IP:-216.128.154.152}"
TLS_MODE="${TLS_MODE:-self_signed}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-support@mykinlegacy.com}"

$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_nginx_certs" >/dev/null
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_certbot_webroot" >/dev/null

if [ "$TLS_MODE" = "letsencrypt" ]; then
  if [ "$DOMAIN" = "$PUBLIC_IP" ]; then
    echo "FAIL TLS_MODE=letsencrypt requires DOMAIN to be a real domain."
    exit 1
  fi

  echo "Creating Let's Encrypt certificate for ${DOMAIN}..."
  $SUDO docker run --rm \
    -p 80:80 \
    -v "${COMPOSE_PROJECT_NAME}_nginx_certs":/etc/letsencrypt \
    certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$LETSENCRYPT_EMAIL" \
    -d "$DOMAIN"

  echo "PASS ssl letsencrypt"
  exit 0
fi

echo "Creating self-signed HTTPS certificate for ${DOMAIN}..."
$SUDO docker run --rm \
  -v "${COMPOSE_PROJECT_NAME}_nginx_certs":/certs \
  alpine:3.20 sh -lc "
    apk add --no-cache openssl >/dev/null &&
    mkdir -p /certs/live/${DOMAIN} &&
    if [ ! -f /certs/live/${DOMAIN}/fullchain.pem ]; then
      openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout /certs/live/${DOMAIN}/privkey.pem \
        -out /certs/live/${DOMAIN}/fullchain.pem \
        -subj '/CN=${DOMAIN}' \
        -addext 'subjectAltName=DNS:${DOMAIN},IP:${PUBLIC_IP}' >/dev/null 2>&1
    fi"

echo "PASS ssl self_signed"
