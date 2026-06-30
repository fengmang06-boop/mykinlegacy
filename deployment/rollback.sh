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

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "Cannot rollback: deployment/.env.production is missing."
  exit 1
fi

if [ -d "$PROJECT_ROOT/.git" ] && [ -s "$SCRIPT_DIR/.previous_revision" ]; then
  PREVIOUS_REVISION="$(cat "$SCRIPT_DIR/.previous_revision")"
  echo "Rolling back source to ${PREVIOUS_REVISION}..."
  git -C "$PROJECT_ROOT" checkout "$PREVIOUS_REVISION"
  git -C "$PROJECT_ROOT" rev-parse HEAD > "$SCRIPT_DIR/.current_revision" || true
else
  echo "No previous git revision recorded. Restarting current running stack instead."
fi

echo "Restarting application services..."
compose up -d --build api worker web nginx

bash "$SCRIPT_DIR/health-check.sh"

echo "PASS rollback complete"
