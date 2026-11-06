#!/usr/bin/env bash
set -euo pipefail

: "${PROD_SSH_HOST:?Missing PROD_SSH_HOST}"
: "${PROD_SSH_USER:?Missing PROD_SSH_USER}"
: "${PROD_SSH_PORT:?Missing PROD_SSH_PORT}"
: "${PROD_PROJECT_DIR:?Missing PROD_PROJECT_DIR}"

SSH_KEY_PATH="${PROD_SSH_KEY_PATH:-$HOME/.ssh/mykinlegacy_prod}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${GITHUB_RUN_ID:-manual}-attempt-${GITHUB_RUN_ATTEMPT:-0}"
PREFLIGHT_RUN_TYPE="${DEPLOY_CAPACITY_RUN_TYPE:-preflight_only}"
CANDIDATE_IMAGE_UNPACKED_BYTES="${DEPLOY_CANDIDATE_IMAGE_UNPACKED_BYTES:-UNKNOWN}"

required_files=(
  deployment/with-production-lock.sh
  deployment/storage-capacity-lib.sh
  deployment/deployment-capacity-gate.sh
  deployment/release-capacity-budget.env
)

for file in "${required_files[@]}"; do
  if [ ! -f "$ROOT_DIR/$file" ]; then
    echo "CAPACITY_PREFLIGHT_PACKAGE_MISSING file=$file" >&2
    exit 78
  fi
done

ssh_base=(
  ssh -i "$SSH_KEY_PATH"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -p "$PROD_SSH_PORT"
  "$PROD_SSH_USER@$PROD_SSH_HOST"
)

scp_base=(
  scp -i "$SSH_KEY_PATH"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -P "$PROD_SSH_PORT"
)

echo "CAPACITY_PREFLIGHT_PACKAGE gate_sha256=$(sha256sum "$ROOT_DIR/deployment/deployment-capacity-gate.sh" | awk '{print $1}') budget_sha256=$(sha256sum "$ROOT_DIR/deployment/release-capacity-budget.env" | awk '{print $1}') run_id=$RUN_ID run_type=$PREFLIGHT_RUN_TYPE candidate_image_unpacked_bytes=$CANDIDATE_IMAGE_UNPACKED_BYTES"

REMOTE_TEMP="$("${ssh_base[@]}" 'mktemp -d /tmp/mykinlegacy-capacity-preflight.XXXXXX')"
if [[ "$REMOTE_TEMP" != /tmp/mykinlegacy-capacity-preflight.* ]]; then
  echo "CAPACITY_PREFLIGHT_TEMP_INVALID path=$REMOTE_TEMP" >&2
  exit 78
fi

cleanup_remote() {
  "${ssh_base[@]}" 'bash -s' -- "$REMOTE_TEMP" <<'CLEANUP_SCRIPT' || true
set -euo pipefail
target="$1"
case "$target" in
  /tmp/mykinlegacy-capacity-preflight.*) rm -rf -- "$target" ;;
  *) echo "REFUSING_UNSAFE_PREFLIGHT_CLEANUP path=$target" >&2; exit 78 ;;
esac
CLEANUP_SCRIPT
}
trap cleanup_remote EXIT

"${ssh_base[@]}" "mkdir -p -- '$REMOTE_TEMP/deployment'"
for file in "${required_files[@]}"; do
  "${scp_base[@]}" "$ROOT_DIR/$file" \
    "$PROD_SSH_USER@$PROD_SSH_HOST:$REMOTE_TEMP/deployment/"
done

"${ssh_base[@]}" \
    'bash -s' -- "$PROD_PROJECT_DIR" "$RUN_ID" "$REMOTE_TEMP" "$PREFLIGHT_RUN_TYPE" "$CANDIDATE_IMAGE_UNPACKED_BYTES" <<'REMOTE_SCRIPT'
set -euo pipefail
PROJECT_DIR="$1"
RUN_ID="$2"
TEMP_ROOT="$3"
PREFLIGHT_RUN_TYPE="$4"
CANDIDATE_IMAGE_UNPACKED_BYTES="$5"
chmod 700 \
  "$TEMP_ROOT/deployment/with-production-lock.sh" \
  "$TEMP_ROOT/deployment/deployment-capacity-gate.sh"

PRODUCTION_LOCK_FILE="$PROJECT_DIR/deployment/.production.lock" \
PRODUCTION_LOCK_METADATA_FILE="$PROJECT_DIR/deployment/.production.lock.meta" \
MYKINLEGACY_DEPLOY_RUN_ID="$RUN_ID" \
DEPLOY_PROJECT_DIR="$PROJECT_DIR" \
DEPLOY_CAPACITY_RUN_TYPE="$PREFLIGHT_RUN_TYPE" \
DEPLOY_CANDIDATE_IMAGE_UNPACKED_BYTES="$CANDIDATE_IMAGE_UNPACKED_BYTES" \
bash "$TEMP_ROOT/deployment/with-production-lock.sh" \
  "deploy-capacity-preflight-only" \
  bash "$TEMP_ROOT/deployment/deployment-capacity-gate.sh"

echo "PREFLIGHT_ONLY_CONFIRMED build=false image_pull=false container_recreate=false deploy=false"
REMOTE_SCRIPT

cleanup_remote
trap - EXIT
