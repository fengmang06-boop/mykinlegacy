#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BUDGET_FILE="${DEPLOY_CAPACITY_BUDGET_FILE:-$SCRIPT_DIR/release-capacity-budget.env}"
GATE_VERSION="mykinlegacy-release-capacity-gate-v1.1.0"
run_type="${DEPLOY_CAPACITY_RUN_TYPE:-release}"
candidate_image_unpacked_bytes="${DEPLOY_CANDIDATE_IMAGE_UNPACKED_BYTES:-UNKNOWN}"

# shellcheck source=deployment/storage-capacity-lib.sh
. "$SCRIPT_DIR/storage-capacity-lib.sh"

blocked() {
  echo "DEPLOYMENT_BLOCKED_CAPACITY_BUDGET reason=$1" >&2
  exit 78
}

if [ "${MYKINLEGACY_CAPACITY_TEST_MODE:-false}" = "true" ]; then
  root_total="${CAPACITY_TEST_ROOT_TOTAL:?}"
  root_used="${CAPACITY_TEST_ROOT_USED:?}"
  root_free="${CAPACITY_TEST_ROOT_FREE:?}"
  root_usage="${CAPACITY_TEST_ROOT_USAGE:?}"
  inode_total="${CAPACITY_TEST_INODE_TOTAL:?}"
  inode_used="${CAPACITY_TEST_INODE_USED:?}"
  inode_free="${CAPACITY_TEST_INODE_FREE:?}"
  inode_usage="${CAPACITY_TEST_INODE_USAGE:?}"
  mysql_health="${CAPACITY_TEST_MYSQL_HEALTH:?}"
  docker_health="${CAPACITY_TEST_DOCKER_HEALTH:?}"
  filesystem_source="${CAPACITY_TEST_FILESYSTEM_SOURCE:-testfs}"
  gate_phase="${CAPACITY_TEST_GATE_PHASE:-pre}"
  peak_budget_bytes="${CAPACITY_TEST_PEAK_BUDGET_BYTES:-UNKNOWN}"
  background_growth_budget_bytes="${CAPACITY_TEST_BACKGROUND_GROWTH_BUDGET_BYTES:-UNKNOWN}"
  uncertainty_margin_bytes="${CAPACITY_TEST_UNCERTAINTY_MARGIN_BYTES:-UNKNOWN}"
  rollback_ready="${CAPACITY_TEST_ROLLBACK_READY:-false}"
  rollback_image="${CAPACITY_TEST_ROLLBACK_IMAGE:-test-rollback-image}"
  current_image="${CAPACITY_TEST_CURRENT_IMAGE:-test-current-image}"
  budget_version="${CAPACITY_TEST_BUDGET_VERSION:-test-budget}"
  budget_basis="${CAPACITY_TEST_BUDGET_BASIS:-ESTIMATED_UPPER_BOUND}"
  budget_updated_at="${CAPACITY_TEST_BUDGET_UPDATED_AT:-2026-11-06T00:00:00Z}"
  budget_age_seconds="${CAPACITY_TEST_BUDGET_AGE_SECONDS:-0}"
  base_peak_budget_bytes="$peak_budget_bytes"
  budget_sha256="TEST"
else
  [ -f "$BUDGET_FILE" ] || blocked "BUDGET_FILE_MISSING"

  # shellcheck disable=SC1090
  . "$BUDGET_FILE"

  [ "${MYKINLEGACY_DEPLOY_BUDGET_SCHEMA:-}" = "1" ] || blocked "BUDGET_SCHEMA_INVALID"
  budget_version="${MYKINLEGACY_DEPLOY_BUDGET_VERSION:-UNKNOWN}"
  budget_basis="${MYKINLEGACY_DEPLOY_BUDGET_BASIS:-UNKNOWN}"
  budget_updated_at="${MYKINLEGACY_DEPLOY_BUDGET_UPDATED_AT_UTC:-UNKNOWN}"
  budget_max_age_seconds="${MYKINLEGACY_DEPLOY_BUDGET_MAX_AGE_SECONDS:-UNKNOWN}"
  peak_budget_bytes="${MYKINLEGACY_DEPLOY_EXTRA_PEAK_BUDGET_BYTES:-UNKNOWN}"
  base_peak_budget_bytes="$peak_budget_bytes"
  background_growth_budget_bytes="${MYKINLEGACY_DEPLOY_BACKGROUND_GROWTH_BUDGET_BYTES:-UNKNOWN}"
  uncertainty_margin_bytes="${MYKINLEGACY_DEPLOY_UNCERTAINTY_MARGIN_BYTES:-UNKNOWN}"

  is_nonnegative_integer "$peak_budget_bytes" || blocked "PEAK_BUDGET_INVALID"
  is_nonnegative_integer "$background_growth_budget_bytes" || blocked "BACKGROUND_BUDGET_INVALID"
  is_nonnegative_integer "$uncertainty_margin_bytes" || blocked "UNCERTAINTY_BUDGET_INVALID"
  is_nonnegative_integer "$budget_max_age_seconds" || blocked "BUDGET_MAX_AGE_INVALID"
  case "$budget_basis" in
    ESTIMATED_UPPER_BOUND|MEASURED) ;;
    *) blocked "BUDGET_BASIS_INVALID" ;;
  esac

  budget_updated_epoch="$(date -u -d "$budget_updated_at" +%s 2>/dev/null || true)"
  [ -n "$budget_updated_epoch" ] || blocked "BUDGET_TIMESTAMP_INVALID"
  now_epoch="$(date -u +%s)"
  budget_age_seconds=$((now_epoch - budget_updated_epoch))
  [ "$budget_age_seconds" -ge 0 ] || blocked "BUDGET_TIMESTAMP_IN_FUTURE"
  [ "$budget_age_seconds" -le "$budget_max_age_seconds" ] || blocked "BUDGET_STALE"

  read -r root_total root_used root_free root_usage < <(filesystem_metrics /)
  read -r inode_total inode_used inode_free inode_usage < <(inode_metrics /)
  filesystem_source="$(findmnt -n -o SOURCE / 2>/dev/null || echo UNKNOWN)"
  docker info >/dev/null 2>&1 && docker_health=healthy || docker_health=unhealthy
  mysql_health="$(
    docker inspect --format \
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      mykinlegacy_mysql 2>/dev/null || echo unavailable
  )"

  current_image_file="$PROJECT_DIR/deployment/.last-successful-image"
  rollback_image_file="$PROJECT_DIR/deployment/.previous_image"
  current_image="$(tr -d '[:space:]' < "$current_image_file" 2>/dev/null || true)"
  rollback_image="$(tr -d '[:space:]' < "$rollback_image_file" 2>/dev/null || true)"
  rollback_ready=false
  if [ -n "$current_image" ] && [ -n "$rollback_image" ] &&
    [ "$current_image" != "$rollback_image" ] &&
    docker image inspect "$current_image" >/dev/null 2>&1 &&
    docker image inspect "$rollback_image" >/dev/null 2>&1; then
    rollback_ready=true
  fi

  gate_phase="${DEPLOY_CAPACITY_GATE_PHASE:-pre}"
  budget_sha256="$(sha256sum "$BUDGET_FILE" | awk '{print $1}')"
fi

candidate_peak_budget_bytes="NOT_APPLICABLE"
case "$run_type" in
  pre_deploy_candidate|deploy)
    is_nonnegative_integer "$candidate_image_unpacked_bytes" || blocked "CANDIDATE_IMAGE_SIZE_UNKNOWN"
    candidate_peak_budget_bytes=$((2 * candidate_image_unpacked_bytes))
    if [ "$candidate_peak_budget_bytes" -gt "$peak_budget_bytes" ]; then
      peak_budget_bytes="$candidate_peak_budget_bytes"
    fi
    ;;
esac

required_bytes="UNKNOWN"
if calculated_required="$(
  deployment_budget_required_bytes \
    "$gate_phase" "$peak_budget_bytes" "$background_growth_budget_bytes" "$uncertainty_margin_bytes"
)"; then
  required_bytes="$calculated_required"
fi

alert_level="$(capacity_alert_level "$root_usage" "$root_free" "$inode_usage" 0)"
gate_sha256="$(sha256sum "$SCRIPT_DIR/deployment-capacity-gate.sh" | awk '{print $1}')"
checked_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "CAPACITY_GATE_VERSION version=$GATE_VERSION gate_sha256=$gate_sha256 budget_version=$budget_version budget_sha256=$budget_sha256 budget_basis=$budget_basis budget_updated_at=$budget_updated_at budget_age_seconds=$budget_age_seconds checked_at=$checked_at run_type=$run_type"
echo "CAPACITY_GATE_METRICS phase=$gate_phase filesystem_source=$filesystem_source total_bytes=$root_total used_bytes=$root_used free_bytes=$root_free usage_percent=$root_usage inode_total=$inode_total inode_used=$inode_used inode_free=$inode_free inode_percent=$inode_usage mysql=$mysql_health docker=$docker_health alert=$alert_level floor_bytes=16106127360 base_peak_budget_bytes=$base_peak_budget_bytes candidate_image_unpacked_bytes=$candidate_image_unpacked_bytes candidate_peak_budget_bytes=$candidate_peak_budget_bytes effective_peak_budget_bytes=$peak_budget_bytes background_growth_budget_bytes=$background_growth_budget_bytes uncertainty_margin_bytes=$uncertainty_margin_bytes required_free_bytes=$required_bytes rollback_ready=$rollback_ready current_image=$current_image rollback_image=$rollback_image"

if ! deployment_budget_allowed \
  "$root_usage" "$root_free" "$inode_usage" "$mysql_health" "$docker_health" \
  "$gate_phase" "$peak_budget_bytes" "$background_growth_budget_bytes" \
  "$uncertainty_margin_bytes" "$rollback_ready"; then
  echo "DEPLOYMENT_BLOCKED_CAPACITY_BUDGET phase=$gate_phase free_bytes=$root_free required_free_bytes=$required_bytes rollback_ready=$rollback_ready" >&2
  exit 78
fi

echo "DEPLOYMENT_CAPACITY_GATE_PASS phase=$gate_phase free_bytes=$root_free required_free_bytes=$required_bytes"
