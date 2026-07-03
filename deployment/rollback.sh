#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
  exec "$SCRIPT_DIR/with-production-lock.sh" "rollback" "$0" "$@"
fi

usage() {
  echo "Usage:"
  echo "  bash deployment/rollback.sh <commit_hash>"
  echo
  echo "Example:"
  echo "  bash deployment/rollback.sh 3254f28"
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ $# -ne 1 ]; then
  usage
  exit 1
fi

TARGET_COMMIT="$1"

cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Cannot rollback: deployment/.env.production is missing."
  exit 1
fi

if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Cannot rollback: git repository is missing."
  exit 1
fi

if ! git -C "$PROJECT_ROOT" cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null; then
  echo "Cannot rollback: target commit does not exist locally: ${TARGET_COMMIT}"
  echo "Try: git fetch origin"
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

print_recent_logs() {
  echo
  echo "Recent API logs (tail 80)"
  compose logs --tail=80 api || true
  echo
  echo "Recent Web logs (tail 80)"
  compose logs --tail=80 web || true
  echo
  echo "Recent Worker logs (tail 80)"
  compose logs --tail=80 worker || true
}

CURRENT_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
TARGET_FULL_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse "$TARGET_COMMIT")"

echo "Current commit: ${CURRENT_COMMIT}"
echo "Rollback target: ${TARGET_FULL_COMMIT}"
echo
echo "This will check out the target commit, run deployment/deploy.sh, then run deployment/health-check.sh."
echo "Database migrations are not automatically rolled back."
echo
read -r -p "Type ROLLBACK to continue: " CONFIRMATION

if [ "$CONFIRMATION" != "ROLLBACK" ]; then
  echo "Rollback cancelled."
  exit 1
fi

echo "$CURRENT_COMMIT" > "$SCRIPT_DIR/.failed_revision"

echo "Checking out rollback target..."
git -C "$PROJECT_ROOT" checkout "$TARGET_FULL_COMMIT"

echo "Running deployment for rollback target..."
if ! DEPLOY_SKIP_GIT_PULL=true bash "$SCRIPT_DIR/deploy.sh"; then
  echo "Rollback deploy failed."
  print_recent_logs
  exit 1
fi

echo "Running post-rollback health check..."
if ! bash "$SCRIPT_DIR/health-check.sh"; then
  echo "Rollback health check failed."
  print_recent_logs
  exit 1
fi

echo "$TARGET_FULL_COMMIT" > "$SCRIPT_DIR/.current_revision"
echo "$TARGET_FULL_COMMIT" > "$SCRIPT_DIR/.last-successful-commit"
echo "$CURRENT_COMMIT" > "$SCRIPT_DIR/.previous_revision"

echo "ROLLBACK_SUCCESS $(echo "$TARGET_FULL_COMMIT" | cut -c1-12)"
