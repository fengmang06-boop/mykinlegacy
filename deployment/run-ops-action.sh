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
  exec bash "$SCRIPT_DIR/with-production-lock.sh" "ops:${ACTION}" bash "$0" "$@"
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

compose() {
  docker compose -p mykinlegacy --env-file "$ENV_FILE" -f "$SCRIPT_DIR/docker-compose.yml" "$@"
}

health_check_with_retry() {
  local attempt
  for attempt in $(seq 1 12); do
    if bash "$SCRIPT_DIR/health-check.sh"; then
      return 0
    fi
    echo "Health check attempt ${attempt}/12 did not pass; waiting for services to settle."
    sleep 5
  done
  echo "FAIL health check did not pass after restart retries"
  return 1
}

set_env_var() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$ENV_FILE"; then
    awk -v key="$key" -v value="$value" 'BEGIN { FS = OFS = "=" } $1 == key { print key "=" value; next } { print }' "$ENV_FILE" > "$tmp"
  else
    cat "$ENV_FILE" > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

export_last_successful_image() {
  local image_file="$SCRIPT_DIR/.last-successful-image"
  if [ ! -f "$image_file" ]; then
    echo "FAIL deployment/.last-successful-image is missing"
    exit 1
  fi
  APP_IMAGE="$(tr -d '[:space:]' < "$image_file")"
  if [ -z "$APP_IMAGE" ]; then
    echo "FAIL deployment/.last-successful-image is empty"
    exit 1
  fi
  export APP_IMAGE
  echo "APP_IMAGE=$(echo "$APP_IMAGE" | sed -E 's#:[a-f0-9]{40}$#:***#')"
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

  restart_nginx)
    echo "===== RESTART NGINX ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    export_last_successful_image
    compose up -d --no-build --no-deps --force-recreate nginx
    bash "$SCRIPT_DIR/health-check.sh"
    echo "OPS_RESTART_NGINX_COMPLETE"
    ;;

  restart_services)
    echo "===== RESTART SERVICES ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    export_last_successful_image
    compose up -d --no-build
    bash "$SCRIPT_DIR/health-check.sh"
    echo "OPS_RESTART_SERVICES_COMPLETE"
    ;;

  docker_ps)
    echo "===== DOCKER COMPOSE PS ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    compose ps
    echo "OPS_DOCKER_PS_COMPLETE"
    ;;

  nginx_logs)
    echo "===== NGINX LOGS tail=120 ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    docker logs mykinlegacy_nginx --tail 120
    echo "OPS_NGINX_LOGS_COMPLETE"
    ;;

  api_logs)
    echo "===== API LOGS tail=120 ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    docker logs mykinlegacy_api --tail 120
    echo "OPS_API_LOGS_COMPLETE"
    ;;

  web_logs)
    echo "===== WEB LOGS tail=120 ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    docker logs mykinlegacy_web --tail 120
    echo "OPS_WEB_LOGS_COMPLETE"
    ;;

  worker_logs)
    echo "===== WORKER LOGS tail=120 ====="
    echo "mode=lightweight no_git_pull=yes no_build=yes"
    docker logs mykinlegacy_worker --tail 120
    echo "OPS_WORKER_LOGS_COMPLETE"
    ;;

  pause_checkout)
    echo "===== PAUSE CHECKOUT ====="
    set_env_var "CHECKOUT_ENABLED" "false"
    export_last_successful_image
    compose up -d --no-build --force-recreate api
    health_check_with_retry
    echo "OPS_PAUSE_CHECKOUT_COMPLETE checkout_enabled=false"
    ;;

  resume_checkout)
    echo "===== RESUME CHECKOUT ====="
    set_env_var "CHECKOUT_ENABLED" "true"
    set_env_var "FOUNDER_EDITION_ENABLED" "true"
    set_env_var "FOUNDER_EDITION_ORDER_LIMIT" "25"
    set_env_var "FOUNDER_REVIEW_REQUIRED" "true"
    if ! grep -Eq '^FOUNDER_EDITION_START_AT=.+$' "$ENV_FILE"; then
      set_env_var "FOUNDER_EDITION_START_AT" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    fi
    export_last_successful_image
    compose up -d --no-build --force-recreate api worker web
    compose up -d --no-build --no-deps --force-recreate nginx
    health_check_with_retry
    echo "OPS_RESUME_CHECKOUT_COMPLETE checkout_enabled=true founder_review_required=true order_limit=25"
    ;;

  verify_stripe_checkout_branding)
    bash "$SCRIPT_DIR/verify-stripe-checkout-branding.sh"
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
    if [ -f "$SCRIPT_DIR/inspect-resend-message.sh" ]; then
      bash "$SCRIPT_DIR/inspect-resend-message.sh" "$ORDER_NUMBER"
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

  approve_founder_delivery)
    require_order_number
    bash "$SCRIPT_DIR/approve-founder-delivery.sh" "$ORDER_NUMBER"
    ;;

  ai_image_bridge_order_test)
    require_order_number
    echo "===== AI IMAGE BRIDGE ORDER TEST ====="
    echo "mode=allowlist_only restart_worker_only=yes no_full_deploy=yes"
    set_env_var "LRE_IMAGE_PROMPT_ORDER_ALLOWLIST" "$ORDER_NUMBER"
    set_env_var "LRE_IMAGE_GENERATION_PROVIDER" "openai"
    set_env_var "OPENAI_IMAGE_MODEL" "gpt-image-1"
    set_env_var "OPENAI_IMAGE_SIZE" "1024x1024"
    set_env_var "OPENAI_IMAGE_QUALITY" "high"
    if [ -n "${MYKINLEGACY_OPENAI_API_KEY:-}" ]; then
      set_env_var "OPENAI_API_KEY" "$MYKINLEGACY_OPENAI_API_KEY"
      echo "OPENAI_API_KEY_SOURCE=github_secret"
    elif grep -Eq '^OPENAI_API_KEY=.+$' "$ENV_FILE"; then
      echo "OPENAI_API_KEY_SOURCE=existing_vps_env"
    else
      echo "FAIL OPENAI_API_KEY is missing. Add GitHub secret OPENAI_API_KEY or set it in deployment/.env.production."
      exit 1
    fi

    export_last_successful_image
    compose up -d --no-build --force-recreate worker
    echo "===== REPAIR WITH AI IMAGE BRIDGE ====="
    bash "$SCRIPT_DIR/repair-order-artifacts.sh" "$ORDER_NUMBER"
    echo "===== INSPECT AI IMAGE BRIDGE RESULT ====="
    inspect_output="$(mktemp)"
    bash "$SCRIPT_DIR/inspect-artifacts.sh" "$ORDER_NUMBER" | tee "$inspect_output"
    grep -q '"png_prompt_source": "lre_prompt"' "$inspect_output"
    grep -q '"png_pve_passed": true' "$inspect_output"
    grep -Eq '"png_pve_score": (9[5-9]|100)' "$inspect_output"
    grep -q '"image_provider": "openai"' "$inspect_output"
    grep -q '"fallback_used": "false"' "$inspect_output"
    rm -f "$inspect_output"
    echo "AI_IMAGE_BRIDGE_ORDER_TEST_PASS order=${ORDER_NUMBER}"
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
    echo "Supported actions: health_check, restart_nginx, restart_services, docker_ps, nginx_logs, api_logs, web_logs, worker_logs, pause_checkout, resume_checkout, verify_stripe_checkout_branding, inspect_order, repair_order_artifacts, verify_download_binaries, founder_final_order_verification, approve_founder_delivery, ai_image_bridge_order_test, safe_deploy"
    exit 1
    ;;
esac
