#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
ORDER_NUMBER="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"

if [ -z "$ACTION" ]; then
  echo "Usage: bash deployment/run-ops-action.sh <action> [ORDER_NUMBER]"
  exit 1
fi

if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
  exec bash "$SCRIPT_DIR/with-production-lock.sh" "ops:${ACTION}" "$0" "$@"
fi

cd "$PROJECT_ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production is missing"
  exit 1
fi

require_order_number() {
  if [ -z "$ORDER_NUMBER" ]; then
    echo "FAIL action ${ACTION} requires order_number"
    exit 1
  fi
  if [[ ! "$ORDER_NUMBER" =~ ^[A-Z0-9-]{8,64}$ ]]; then
    echo "FAIL order_number must contain only uppercase letters, numbers, and hyphens"
    exit 1
  fi
}

safe_url_check() {
  local label="$1"
  local url="$2"
  local status
  status="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || echo "000")"
  if [[ "$status" =~ ^[23] ]]; then
    printf '%-34s PASS %s\n' "$label" "$status"
    return 0
  fi
  printf '%-34s FAIL %s\n' "$label" "$status"
  return 1
}

print_preflight() {
  echo "MyKinLegacy Ops workflow preflight"
  echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "Action: ${ACTION}"
  if [ -n "$ORDER_NUMBER" ]; then
    echo "Order: ${ORDER_NUMBER}"
  fi
  echo "project_directory_exists=yes"
  if [ -d "$PROJECT_ROOT/.git" ]; then
    echo "current_commit=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  else
    echo "current_commit=unknown"
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker_compose_available=yes"
  else
    echo "docker_compose_available=no"
  fi
  if [ -x "$SCRIPT_DIR/health-check.sh" ] || [ -f "$SCRIPT_DIR/health-check.sh" ]; then
    echo "deployment_scripts_available=yes"
  else
    echo "deployment_scripts_available=no"
  fi
  echo "production_lock=held"
  echo
}

print_preflight

case "$ACTION" in
  health_check)
    failures=0
    bash "$SCRIPT_DIR/health-check.sh" || failures=$((failures + 1))
    echo
    echo "Public route checks"
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    safe_url_check "https /health" "https://${DOMAIN:-mykinlegacy.com}/health" || failures=$((failures + 1))
    safe_url_check "https /create" "https://${DOMAIN:-mykinlegacy.com}/create" || failures=$((failures + 1))
    safe_url_check "https /api/v1/products" "https://${DOMAIN:-mykinlegacy.com}/api/v1/products" || failures=$((failures + 1))
    safe_url_check "https /family-legacy-collection" "https://${DOMAIN:-mykinlegacy.com}/family-legacy-collection" || failures=$((failures + 1))
    safe_url_check "origin /health" "http://${PUBLIC_IP:-216.128.154.152}/health" || failures=$((failures + 1))
    if [ "$failures" -gt 0 ]; then
      echo "OPS_HEALTH_CHECK_FAIL failures=${failures}"
      exit 1
    fi
    echo "OPS_HEALTH_CHECK_PASS"
    ;;

  inspect_order)
    require_order_number
    bash "$SCRIPT_DIR/inspect-artifacts.sh" "$ORDER_NUMBER"
    bash "$SCRIPT_DIR/inspect-delivery-state.sh" "$ORDER_NUMBER"
    if [ -f "$SCRIPT_DIR/inspect-email-delivery.sh" ]; then
      bash "$SCRIPT_DIR/inspect-email-delivery.sh" "$ORDER_NUMBER"
    else
      echo "inspect-email-delivery.sh not available"
    fi
    ;;

  repair_order_artifacts)
    require_order_number
    echo "===== BEFORE: ARTIFACTS ====="
    bash "$SCRIPT_DIR/inspect-artifacts.sh" "$ORDER_NUMBER"
    echo "===== BEFORE: DELIVERY STATE ====="
    bash "$SCRIPT_DIR/inspect-delivery-state.sh" "$ORDER_NUMBER"
    echo "===== REPAIR ====="
    bash "$SCRIPT_DIR/repair-order-artifacts.sh" "$ORDER_NUMBER"
    echo "===== AFTER: ARTIFACTS ====="
    bash "$SCRIPT_DIR/inspect-artifacts.sh" "$ORDER_NUMBER"
    echo "===== AFTER: DELIVERY STATE ====="
    bash "$SCRIPT_DIR/inspect-delivery-state.sh" "$ORDER_NUMBER"
    echo "===== VERIFY DOWNLOAD BINARIES ====="
    bash "$SCRIPT_DIR/verify-download-binaries.sh" "$ORDER_NUMBER"
    echo "OPS_REPAIR_ORDER_ARTIFACTS_COMPLETE"
    ;;

  verify_download_binaries)
    require_order_number
    bash "$SCRIPT_DIR/verify-download-binaries.sh" "$ORDER_NUMBER"
    ;;

  founder_final_order_verification)
    require_order_number
    bash "$SCRIPT_DIR/founder-final-order-verification.sh" "$ORDER_NUMBER"
    ;;

  safe_deploy)
    echo "===== SAFE DEPLOY ====="
    if [ -d "$PROJECT_ROOT/.git" ]; then
      echo "current_commit_before=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
      git -C "$PROJECT_ROOT" fetch origin main
      git -C "$PROJECT_ROOT" checkout main
      git -C "$PROJECT_ROOT" pull --ff-only origin main
      echo "current_commit_after_pull=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
    fi
    bash "$SCRIPT_DIR/deploy.sh"
    bash "$SCRIPT_DIR/status.sh"
    echo "OPS_SAFE_DEPLOY_COMPLETE"
    ;;

  *)
    echo "FAIL unsupported action: ${ACTION}"
    echo "Supported actions: health_check, inspect_order, repair_order_artifacts, verify_download_binaries, founder_final_order_verification, safe_deploy"
    exit 1
    ;;
esac
