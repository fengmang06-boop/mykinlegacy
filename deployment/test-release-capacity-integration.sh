#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GATE="$SCRIPT_DIR/deployment-capacity-gate.sh"
WORKFLOW="$ROOT_DIR/.github/workflows/deploy-production.yml"
HELPER="$ROOT_DIR/scripts/run-production-capacity-preflight.sh"
DEPLOY="$SCRIPT_DIR/deploy.sh"

passed=0
failed=0

pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }

run_test_gate() {
  MYKINLEGACY_CAPACITY_TEST_MODE=true \
  CAPACITY_TEST_ROOT_TOTAL=79941234688 \
  CAPACITY_TEST_ROOT_USED=50000000000 \
  CAPACITY_TEST_ROOT_FREE="$1" \
  CAPACITY_TEST_ROOT_USAGE=68 \
  CAPACITY_TEST_INODE_TOTAL=20708160 \
  CAPACITY_TEST_INODE_USED=460000 \
  CAPACITY_TEST_INODE_FREE=20248160 \
  CAPACITY_TEST_INODE_USAGE=3 \
  CAPACITY_TEST_MYSQL_HEALTH=healthy \
  CAPACITY_TEST_DOCKER_HEALTH=healthy \
  CAPACITY_TEST_GATE_PHASE=pre \
  CAPACITY_TEST_PEAK_BUDGET_BYTES="$2" \
  CAPACITY_TEST_BACKGROUND_GROWTH_BUDGET_BYTES=1073741824 \
  CAPACITY_TEST_UNCERTAINTY_MARGIN_BYTES=2147483648 \
  CAPACITY_TEST_ROLLBACK_READY="$3" \
  bash "$GATE"
}

if run_test_gate 24962342912 5268000000 true >/tmp/mkl-gate-pass.log 2>&1; then
  grep -Fq 'version=mykinlegacy-release-capacity-gate-v1.1.0' /tmp/mkl-gate-pass.log &&
    grep -Fq 'DEPLOYMENT_CAPACITY_GATE_PASS' /tmp/mkl-gate-pass.log &&
    pass "target gate version accepts complete boundary inputs" ||
    fail "target gate version accepts complete boundary inputs"
else
  fail "target gate version accepts complete boundary inputs"
fi

if run_test_gate 16000000000 5268000000 true >/tmp/mkl-gate-low.log 2>&1; then
  fail "low capacity blocks release"
else
  [ "$?" -eq 78 ] && pass "low capacity blocks release" || fail "low capacity blocks release"
fi

if run_test_gate 30000000000 UNKNOWN true >/tmp/mkl-gate-unknown.log 2>&1; then
  fail "unknown peak budget blocks release"
else
  [ "$?" -eq 78 ] && pass "unknown peak budget blocks release" || fail "unknown peak budget blocks release"
fi

if run_test_gate 30000000000 5268000000 false >/tmp/mkl-gate-rollback.log 2>&1; then
  fail "missing rollback blocks release"
else
  [ "$?" -eq 78 ] && pass "missing rollback blocks release" || fail "missing rollback blocks release"
fi

if DEPLOY_CAPACITY_RUN_TYPE=deploy run_test_gate 30000000000 5268000000 true >/tmp/mkl-gate-candidate.log 2>&1; then
  fail "full deploy without candidate size blocks release"
else
  [ "$?" -eq 78 ] && pass "full deploy without candidate size blocks release" || fail "full deploy without candidate size blocks release"
fi

if grep -Fq 'default: preflight_only' "$WORKFLOW" &&
  grep -Fq "if: env.DEPLOY_REQUESTED == 'true'" "$WORKFLOW" &&
  grep -Fq 'CANDIDATE_IMAGE_MEASURED location=github_actions_runner' "$WORKFLOW" &&
  grep -Fq 'PREFLIGHT_ONLY_COMPLETE build=false image_pull=false container_recreate=false deploy=false' "$WORKFLOW"; then
  pass "manual default is preflight-only and production steps are conditional"
else
  fail "manual default is preflight-only and production steps are conditional"
fi

if grep -Fq 'PREFLIGHT_ONLY_CONFIRMED build=false image_pull=false container_recreate=false deploy=false' "$HELPER" &&
  ! grep -Eq 'docker (pull|build)|docker compose|compose up' "$HELPER"; then
  pass "preflight helper contains no image pull build or container recreate"
else
  fail "preflight helper contains no image pull build or container recreate"
fi

gate_line="$(grep -n 'phase "Deployment capacity gate"' "$DEPLOY" | head -1 | cut -d: -f1)"
pull_line="$(grep -n 'git -C "$PROJECT_ROOT" pull' "$DEPLOY" | head -1 | cut -d: -f1)"
image_pull_line="$(grep -n 'phase "Pulling production application image"' "$DEPLOY" | head -1 | cut -d: -f1)"
if [ "$gate_line" -lt "$pull_line" ] && [ "$gate_line" -lt "$image_pull_line" ]; then
  pass "direct deploy gate runs before git pull and image pull"
else
  fail "direct deploy gate runs before git pull and image pull"
fi

preflight_line="$(grep -n 'name: Production capacity gate before build' "$WORKFLOW" | cut -d: -f1)"
build_line="$(grep -n 'name: Build and push production image' "$WORKFLOW" | cut -d: -f1)"
second_gate_line="$(grep -n 'name: Production capacity gate before VPS update' "$WORKFLOW" | cut -d: -f1)"
deploy_line="$(grep -n 'name: Deploy on production VPS' "$WORKFLOW" | cut -d: -f1)"
if [ "$preflight_line" -lt "$build_line" ] && [ "$second_gate_line" -lt "$deploy_line" ]; then
  pass "workflow gates ordinary manual and retry paths before writes"
else
  fail "workflow gates ordinary manual and retry paths before writes"
fi

rm -f /tmp/mkl-gate-pass.log /tmp/mkl-gate-low.log /tmp/mkl-gate-unknown.log /tmp/mkl-gate-rollback.log /tmp/mkl-gate-candidate.log
echo "RELEASE_CAPACITY_INTEGRATION_TESTS passed=$passed failed=$failed"
[ "$failed" -eq 0 ]
