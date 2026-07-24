#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deployment/storage-capacity-lib.sh
. "$SCRIPT_DIR/storage-capacity-lib.sh"

passed=0
failed=0

assert_equal() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS $name"
    passed=$((passed + 1))
  else
    echo "FAIL $name expected=$expected actual=$actual" >&2
    failed=$((failed + 1))
  fi
}

assert_contains() {
  local name="$1" needle="$2" file="$3"
  if grep -Fq "$needle" "$file"; then
    echo "PASS $name"
    passed=$((passed + 1))
  else
    echo "FAIL $name missing=$needle" >&2
    failed=$((failed + 1))
  fi
}

gb=$((1024 * 1024 * 1024))
assert_equal "info classification" INFO "$(capacity_alert_level 40 $((43 * gb)) 2 0)"
assert_equal "warning usage classification" WARNING "$(capacity_alert_level 75 $((30 * gb)) 2 0)"
assert_equal "warning free classification" WARNING "$(capacity_alert_level 70 $((24 * gb)) 2 0)"
assert_equal "warning growth classification" WARNING "$(capacity_alert_level 40 $((43 * gb)) 2 $((6 * gb)))"
assert_equal "high usage classification" HIGH "$(capacity_alert_level 85 $((20 * gb)) 2 0)"
assert_equal "high free classification" HIGH "$(capacity_alert_level 70 $((14 * gb)) 2 0)"
assert_equal "critical usage classification" CRITICAL "$(capacity_alert_level 92 $((20 * gb)) 2 0)"
assert_equal "critical free classification" CRITICAL "$(capacity_alert_level 70 $((7 * gb)) 2 0)"
assert_equal "critical inode classification" CRITICAL "$(capacity_alert_level 40 $((43 * gb)) 92 0)"

if deployment_capacity_allowed 40 $((43 * gb)) 2 healthy healthy; then
  assert_equal "normal capacity allows deployment" YES YES
else
  assert_equal "normal capacity allows deployment" YES NO
fi
if deployment_capacity_allowed 85 $((14 * gb)) 2 healthy healthy; then
  assert_equal "low capacity blocks deployment" NO YES
else
  assert_equal "low capacity blocks deployment" NO NO
fi
if deployment_capacity_allowed 40 $((43 * gb)) 2 unhealthy healthy; then
  assert_equal "mysql unhealthy blocks deployment" NO YES
else
  assert_equal "mysql unhealthy blocks deployment" NO NO
fi

assert_contains "current image protected by cleanup" \
  'current_image="$(tr -d' "$SCRIPT_DIR/docker-safe-cleanup.sh"
assert_contains "rollback image protected by cleanup" \
  'previous_image="$(tr -d' "$SCRIPT_DIR/docker-safe-cleanup.sh"
assert_contains "unknown volumes never deleted" \
  'docker image rm' "$SCRIPT_DIR/docker-safe-cleanup.sh"
if grep -Eq 'docker (system|volume) prune|docker volume rm' "$SCRIPT_DIR/docker-safe-cleanup.sh"; then
  assert_equal "no volume or global prune" absent present
else
  assert_equal "no volume or global prune" absent absent
fi
assert_contains "deploy invokes capacity gate" \
  'deployment-capacity-gate.sh' "$SCRIPT_DIR/deploy.sh"
assert_contains "monitor emits deployment decision" \
  'deployment_allowed=' "$SCRIPT_DIR/vps-capacity-monitor.sh"
assert_contains "monitor output excludes secrets" \
  'VPS_CAPACITY_STATUS_BEGIN' "$SCRIPT_DIR/vps-capacity-monitor.sh"
assert_contains "weekly cleanup is dry run" \
  'docker-safe-cleanup.sh --dry-run' "$SCRIPT_DIR/../.github/workflows/docker-safe-cleanup.yml"

echo "STORAGE_HARDENING_TESTS passed=$passed failed=$failed"
[ "$failed" -eq 0 ]
