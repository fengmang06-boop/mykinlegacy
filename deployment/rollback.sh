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

if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Cannot rollback: git repository is missing."
  exit 1
fi

if [ -n "${ROLLBACK_REVISION:-}" ]; then
  TARGET_REVISION="$ROLLBACK_REVISION"
elif [ -s "$SCRIPT_DIR/.previous_revision" ]; then
  TARGET_REVISION="$(cat "$SCRIPT_DIR/.previous_revision")"
else
  echo "Cannot rollback: no previous revision recorded."
  echo "Run bash deployment/status.sh to inspect the current deployment."
  exit 1
fi

CURRENT_REVISION="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
echo "$CURRENT_REVISION" > "$SCRIPT_DIR/.failed_revision"

echo "Rolling back source to ${TARGET_REVISION}..."
git -C "$PROJECT_ROOT" checkout "$TARGET_REVISION"

echo "Rebuilding rollback application image..."
if [ -f "$SCRIPT_DIR/Dockerfile" ]; then
  compose build --pull api
  echo "Restarting application services from rollback image..."
  compose up -d --no-build --force-recreate api worker web nginx
else
  echo "Rollback target does not contain deployment/Dockerfile. Using legacy compose build."
  compose up -d --build --force-recreate api worker web nginx
fi

bash "$SCRIPT_DIR/health-check.sh"

git -C "$PROJECT_ROOT" rev-parse HEAD > "$SCRIPT_DIR/.current_revision" || true
echo "$CURRENT_REVISION" > "$SCRIPT_DIR/.previous_revision" || true

echo "PASS rollback complete"
echo "Rolled back from ${CURRENT_REVISION} to $(git -C "$PROJECT_ROOT" rev-parse HEAD)"
