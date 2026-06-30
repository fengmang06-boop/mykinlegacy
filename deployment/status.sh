#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production is missing"
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

container_health() {
  local container="$1"
  local state
  state="$($SUDO docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
  if [ -z "$state" ]; then
    state="missing"
  fi
  printf '%-24s %s\n' "$container" "$state"
}

public_check() {
  local label="$1"
  local url="$2"
  if curl -kfsS --max-time 10 "$url" >/dev/null 2>&1; then
    printf '%-16s PASS %s\n' "$label" "$url"
  else
    printf '%-16s FAIL %s\n' "$label" "$url"
  fi
}

api_health() {
  local output
  if output="$(compose exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(async r=>{console.log(r.status + ' ' + await r.text()); process.exit(r.ok?0:1)}).catch(e=>{console.error(e.message); process.exit(1)})" 2>&1)"; then
    echo "api_health      PASS ${output}"
  else
    echo "api_health      FAIL ${output}"
  fi
}

echo "MyKinLegacy production status"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo

echo "Git"
if [ -d "$PROJECT_ROOT/.git" ]; then
  echo "current_branch: $(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  echo "current_commit: $(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "latest_message: $(git -C "$PROJECT_ROOT" log -1 --pretty=%s 2>/dev/null || echo unknown)"
  if [ -f "$SCRIPT_DIR/.last-successful-commit" ]; then
    echo "last_successful: $(cut -c1-12 "$SCRIPT_DIR/.last-successful-commit")"
  else
    echo "last_successful: not recorded"
  fi
  if [ -f "$SCRIPT_DIR/.previous_revision" ]; then
    echo "previous_revision: $(cut -c1-12 "$SCRIPT_DIR/.previous_revision")"
  else
    echo "previous_revision: not recorded"
  fi
else
  echo "git repository not found"
fi
echo

echo "Docker compose service status"
compose ps || true
echo

echo "Container health status"
container_health mykinlegacy_mysql
container_health mykinlegacy_redis
container_health mykinlegacy_api
container_health mykinlegacy_worker
container_health mykinlegacy_web
container_health mykinlegacy_nginx
echo

echo "Public URL checks"
public_check "public_http" "http://${PUBLIC_IP:-216.128.154.152}/health"
public_check "public_https" "https://${DOMAIN:-216.128.154.152}/health"
echo

echo "API /health result"
api_health
echo

echo "Disk usage"
df -h / || true
echo

echo "Memory usage"
free -h || true
echo

echo "Recent API logs (tail 80)"
compose logs --tail=80 api || true
echo

echo "Recent Web logs (tail 80)"
compose logs --tail=80 web || true
echo

echo "Recent Worker logs (tail 80)"
compose logs --tail=80 worker || true
echo

echo "Rollback hint"
echo "Rollback to a known commit:"
echo "  bash deployment/rollback.sh <commit_hash>"
