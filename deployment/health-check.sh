#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL env deployment/.env.production is missing"
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

line() {
  printf '%-14s %-6s %s\n' "$1" "$2" "$3"
}

check() {
  local name="$1"
  local description="$2"
  shift 2

  local output
  if output="$("$@" 2>&1)"; then
    line "$name" "PASS" "$description"
  else
    line "$name" "FAIL" "$description"
    if [ -n "$output" ]; then
      echo "  ${output}" | tail -n 5
    fi
    FAILURES=$((FAILURES + 1))
  fi
}

check_container_running() {
  local service="$1"
  local name="$2"
  if compose ps --status running "$service" | grep -q "$name"; then
    line "$service" "PASS" "container is running"
  else
    line "$service" "FAIL" "container is not running"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "MyKinLegacy deployment health check"
echo "Domain: ${DOMAIN:-mykinlegacy.com}"
echo "Public IP: ${PUBLIC_IP:-216.128.154.152}"
echo

check "mysql" "mysqladmin ping inside container" \
  compose exec -T mysql mysqladmin ping -h 127.0.0.1 "-u${MYSQL_USER:-mykinlegacy}" "-p${MYSQL_PASSWORD:-}"

check "redis" "redis-cli ping inside container" \
  compose exec -T redis redis-cli ping

check "api" "http://127.0.0.1:4000/health inside api container" \
  compose exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

check "web" "http://127.0.0.1:3000 inside web container" \
  compose exec -T web node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

check_container_running "worker" "mykinlegacy_worker"

check "nginx" "http://127.0.0.1/health inside nginx container" \
  compose exec -T nginx wget -q --spider http://127.0.0.1/health

check "public_http" "http://${PUBLIC_IP:-216.128.154.152}/health from host" \
  curl -fsS --max-time 10 "http://${PUBLIC_IP:-216.128.154.152}/health"

check "public_https" "https://${DOMAIN:-mykinlegacy.com}/health from host" \
  curl -kfsS --max-time 10 "https://${DOMAIN:-mykinlegacy.com}/health"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "PASS deployment health check"
  exit 0
fi

echo "FAIL deployment health check (${FAILURES} checks failed)"
echo "Run: bash deployment/status.sh"
exit 1
