#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"
LAST_SUCCESSFUL_FILE="$SCRIPT_DIR/.last-successful-commit"

if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
  exec "$SCRIPT_DIR/with-production-lock.sh" "deploy" "$0" "$@"
fi

cd "$SCRIPT_DIR"

current_commit() {
  if [ -d "$PROJECT_ROOT/.git" ]; then
    git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

short_commit() {
  local commit="$1"
  if [ "$commit" = "unknown" ]; then
    echo "unknown"
  else
    echo "$commit" | cut -c1-12
  fi
}

deploy_failed() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    local failed_commit
    failed_commit="$(current_commit)"
    echo "DEPLOYMENT_FAILED $(short_commit "$failed_commit")"
    if [ "${MYKINLEGACY_ROLLBACK_IN_PROGRESS:-false}" != "true" ] &&
      [ "${MYKINLEGACY_DISABLE_AUTO_ROLLBACK:-false}" != "true" ] &&
      [ -f "$SCRIPT_DIR/.previous_revision" ] &&
      [ -d "$PROJECT_ROOT/.git" ]; then
      local rollback_commit
      rollback_commit="$(cat "$SCRIPT_DIR/.previous_revision" | tr -d '[:space:]')"
      if [ -n "$rollback_commit" ] && [ "$rollback_commit" != "$failed_commit" ] &&
        git -C "$PROJECT_ROOT" cat-file -e "${rollback_commit}^{commit}" 2>/dev/null; then
        echo "Attempting automatic rollback to $(short_commit "$rollback_commit") after failed deploy..."
        git -C "$PROJECT_ROOT" checkout "$rollback_commit"
        if MYKINLEGACY_ROLLBACK_IN_PROGRESS=true DEPLOY_SKIP_GIT_PULL=true bash "$SCRIPT_DIR/deploy.sh"; then
          echo "ROLLBACK_AFTER_DEPLOY_FAILURE_SUCCESS $(short_commit "$rollback_commit")"
        else
          echo "ROLLBACK_AFTER_DEPLOY_FAILURE_FAILED $(short_commit "$rollback_commit")"
        fi
      else
        echo "Automatic rollback skipped: previous revision unavailable or matches failed commit."
      fi
    fi
  fi
}

trap deploy_failed EXIT

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
  BEFORE_COMMIT="$(current_commit)"
  echo "Current commit before deploy: $(short_commit "$BEFORE_COMMIT")"

  if [ -f "$LAST_SUCCESSFUL_FILE" ]; then
    cp "$LAST_SUCCESSFUL_FILE" "$SCRIPT_DIR/.previous_revision"
  elif [ -f "$SCRIPT_DIR/.current_revision" ]; then
    cp "$SCRIPT_DIR/.current_revision" "$SCRIPT_DIR/.previous_revision"
  elif [ "$BEFORE_COMMIT" != "unknown" ]; then
    echo "$BEFORE_COMMIT" > "$SCRIPT_DIR/.previous_revision"
  fi

  CURRENT_BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")"
  if [ "${DEPLOY_SKIP_GIT_PULL:-false}" != "true" ] && [ "$CURRENT_BRANCH" != "HEAD" ] && git -C "$PROJECT_ROOT" remote get-url origin >/dev/null 2>&1; then
    echo "Pulling latest code from origin/${CURRENT_BRANCH}..."
    git -C "$PROJECT_ROOT" pull --ff-only origin "$CURRENT_BRANCH"
    AFTER_PULL_COMMIT="$(current_commit)"
    echo "Current commit after git pull: $(short_commit "$AFTER_PULL_COMMIT")"
  else
    echo "Git pull skipped. Branch: ${CURRENT_BRANCH}"
    AFTER_PULL_COMMIT="$(current_commit)"
    echo "Current commit after git pull step: $(short_commit "$AFTER_PULL_COMMIT")"
  fi
else
  echo "Current commit before deploy: unknown"
  echo "Current commit after git pull step: unknown"
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

DOMAIN="${DOMAIN:-mykinlegacy.com}"
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
$SUDO docker volume create "${COMPOSE_PROJECT_NAME}_private_storage" >/dev/null

compose stop nginx >/dev/null 2>&1 || true
bash "$SCRIPT_DIR/ssl-init.sh"

echo "Building production application image..."
compose build --pull api

echo "Starting MySQL and Redis..."
compose up -d mysql redis

echo "Running database migrations..."
compose run --rm api corepack pnpm db:migrate:deploy

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Running seed data..."
  compose run --rm api sh -lc "corepack pnpm db:seed"
fi

echo "Building and starting application services..."
compose up -d --no-build --force-recreate api worker web nginx

echo "Running health check..."
bash "$SCRIPT_DIR/health-check.sh"

if [ -d "$PROJECT_ROOT/.git" ]; then
  SUCCESSFUL_COMMIT="$(current_commit)"
  echo "$SUCCESSFUL_COMMIT" > "$SCRIPT_DIR/.current_revision"
  echo "$SUCCESSFUL_COMMIT" > "$LAST_SUCCESSFUL_FILE"
else
  SUCCESSFUL_COMMIT="unknown"
fi

echo "PASS deployment complete"
echo "Open: https://${DOMAIN}"
echo "DEPLOYMENT_SUCCESS $(short_commit "$SUCCESSFUL_COMMIT")"

trap - EXIT
