#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_SCRIPT="$SCRIPT_DIR/with-production-lock.sh"
TEST_ROOT="$(mktemp -d)"
TEST_PID=""

cleanup() {
  if [ -n "$TEST_PID" ] && kill -0 "$TEST_PID" 2>/dev/null; then
    kill -TERM "$TEST_PID" 2>/dev/null || true
    wait "$TEST_PID" 2>/dev/null || true
  fi
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

fail() {
  echo "FAIL $*" >&2
  exit 1
}

run_lock() {
  local name="$1"
  shift
  PRODUCTION_LOCK_FILE="$TEST_ROOT/$name.lock" \
    PRODUCTION_LOCK_METADATA_FILE="$TEST_ROOT/$name.lock.meta" \
    MYKINLEGACY_DEPLOY_RUN_ID="test-$name" \
    bash "$LOCK_SCRIPT" "$name" "$@"
}

echo "TEST normal deployment clears metadata"
run_lock normal bash -c 'exit 0'
[ ! -e "$TEST_ROOT/normal.lock.meta" ] || fail "normal metadata was not cleared"

echo "TEST failed command clears metadata"
if run_lock failure bash -c 'exit 23'; then
  fail "failed command unexpectedly succeeded"
fi
[ ! -e "$TEST_ROOT/failure.lock.meta" ] || fail "failure metadata was not cleared"

echo "TEST interrupted command trap clears metadata"
PRODUCTION_LOCK_FILE="$TEST_ROOT/interrupt.lock" \
  PRODUCTION_LOCK_METADATA_FILE="$TEST_ROOT/interrupt.lock.meta" \
  MYKINLEGACY_DEPLOY_RUN_ID="test-interrupt" \
  bash "$LOCK_SCRIPT" interrupt bash -c 'sleep 30' &
TEST_PID=$!
for _ in $(seq 1 50); do
  [ -s "$TEST_ROOT/interrupt.lock.meta" ] && break
  sleep 0.1
done
[ -s "$TEST_ROOT/interrupt.lock.meta" ] || fail "interrupt metadata was not created"
kill -TERM "$TEST_PID"
wait "$TEST_PID" 2>/dev/null || true
TEST_PID=""
[ ! -e "$TEST_ROOT/interrupt.lock.meta" ] || fail "interrupt metadata was not cleared"

echo "TEST stale PID metadata is recognized"
cat > "$TEST_ROOT/stale.lock.meta" <<'EOF'
version=1
owner_pid=999999
owner_start_ticks=1
operation=old
run_id=old
started_at=1970-01-01T00:00:00+00:00
EOF
stale_output="$(run_lock stale bash -c 'exit 0')"
grep -q 'LOCK_METADATA_STATUS stale reason=pid_not_alive' <<<"$stale_output" ||
  fail "stale PID was not classified"
[ ! -e "$TEST_ROOT/stale.lock.meta" ] || fail "stale metadata was not cleared"

echo "TEST active lock blocks a second deployment"
PRODUCTION_LOCK_FILE="$TEST_ROOT/active.lock" \
  PRODUCTION_LOCK_METADATA_FILE="$TEST_ROOT/active.lock.meta" \
  MYKINLEGACY_DEPLOY_RUN_ID="test-active-one" \
  bash "$LOCK_SCRIPT" active-one bash -c 'sleep 3' &
TEST_PID=$!
for _ in $(seq 1 50); do
  [ -s "$TEST_ROOT/active.lock.meta" ] && break
  sleep 0.1
done
[ -s "$TEST_ROOT/active.lock.meta" ] || fail "active metadata was not created"
set +e
active_output="$(
  PRODUCTION_LOCK_FILE="$TEST_ROOT/active.lock" \
    PRODUCTION_LOCK_METADATA_FILE="$TEST_ROOT/active.lock.meta" \
    PRODUCTION_LOCK_TIMEOUT_SECONDS=1 \
    MYKINLEGACY_DEPLOY_RUN_ID="test-active-two" \
    bash "$LOCK_SCRIPT" active-two bash -c 'exit 0' 2>&1
)"
active_status=$?
set -e
[ "$active_status" -eq 75 ] || fail "second active deployment exit code was $active_status"
grep -q 'LOCK_METADATA_STATUS active' <<<"$active_output" || fail "active owner was not reported"
grep -q 'PRODUCTION_LOCK_ACQUIRE_FAILED' <<<"$active_output" || fail "active lock did not block"
kill -TERM "$TEST_PID"
wait "$TEST_PID" 2>/dev/null || true
TEST_PID=""

echo "TEST unrelated live PID is not terminated"
sleep 30 &
unrelated_pid=$!
unrelated_ticks="$(awk '{ print $22 }' "/proc/$unrelated_pid/stat")"
cat > "$TEST_ROOT/unrelated.lock.meta" <<EOF
version=1
owner_pid=$unrelated_pid
owner_start_ticks=$((unrelated_ticks + 1))
operation=unrelated
run_id=unrelated
started_at=1970-01-01T00:00:00+00:00
EOF
unrelated_output="$(run_lock unrelated bash -c 'exit 0')"
grep -q 'LOCK_METADATA_STATUS stale reason=pid_identity_mismatch' <<<"$unrelated_output" ||
  fail "PID identity mismatch was not classified"
kill -0 "$unrelated_pid" 2>/dev/null || fail "unrelated PID was terminated"
kill -TERM "$unrelated_pid"
wait "$unrelated_pid" 2>/dev/null || true

echo "PASS production lock test suite"
