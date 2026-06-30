#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL .env.production missing"
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

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

FAILURES=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS ${name}"
  else
    echo "FAIL ${name}"
    FAILURES=$((FAILURES + 1))
  fi
}

check_worker() {
  if compose ps --status running worker | grep -q "mykinlegacy_worker"; then
    echo "PASS worker"
  else
    echo "FAIL worker"
    FAILURES=$((FAILURES + 1))
  fi
}

check "mysql" compose exec -T mysql mysqladmin ping -h 127.0.0.1 "-u${MYSQL_USER:-mykinlegacy}" "-p${MYSQL_PASSWORD:-}"
check "redis" compose exec -T redis redis-cli ping
check "api" compose exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
check "web" compose exec -T web node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
check_worker
check "nginx" compose exec -T nginx wget -q --spider http://127.0.0.1/health

if [ "$FAILURES" -eq 0 ]; then
  echo "PASS production bootstrap health check"
  exit 0
fi

echo "FAIL production bootstrap health check (${FAILURES} checks failed)"
exit 1
