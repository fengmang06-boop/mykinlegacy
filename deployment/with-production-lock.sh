#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_FILE="${PRODUCTION_LOCK_FILE:-$SCRIPT_DIR/.production.lock}"
LOCK_METADATA_FILE="${PRODUCTION_LOCK_METADATA_FILE:-${LOCK_FILE}.meta}"
LOCK_TIMEOUT_SECONDS="${PRODUCTION_LOCK_TIMEOUT_SECONDS:-1800}"
RUN_ID="${GITHUB_RUN_ID:-${MYKINLEGACY_DEPLOY_RUN_ID:-manual}}"

if [ $# -lt 2 ]; then
  echo "Usage: bash deployment/with-production-lock.sh <operation_name> <command> [args...]"
  exit 1
fi

OPERATION_NAME="$1"
shift

if [ "${MYKINLEGACY_LOCK_HELD:-false}" = "true" ]; then
  "$@"
  exit $?
fi

mkdir -p "$(dirname "$LOCK_FILE")"

process_start_ticks() {
  local pid="$1"
  awk '{ print $22 }' "/proc/${pid}/stat" 2>/dev/null || true
}

metadata_value() {
  local key="$1"
  local file="${2:-$LOCK_METADATA_FILE}"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file" 2>/dev/null || true
}

classify_existing_metadata() {
  if [ ! -f "$LOCK_METADATA_FILE" ]; then
    echo "LOCK_METADATA_STATUS absent"
    return
  fi

  local recorded_pid recorded_ticks actual_ticks
  recorded_pid="$(metadata_value owner_pid)"
  recorded_ticks="$(metadata_value owner_start_ticks)"

  if [[ ! "$recorded_pid" =~ ^[0-9]+$ ]] || ! kill -0 "$recorded_pid" 2>/dev/null; then
    echo "LOCK_METADATA_STATUS stale reason=pid_not_alive recorded_pid=${recorded_pid:-unknown}"
    return
  fi

  actual_ticks="$(process_start_ticks "$recorded_pid")"
  if [ -z "$recorded_ticks" ] || [ "$actual_ticks" != "$recorded_ticks" ]; then
    echo "LOCK_METADATA_STATUS stale reason=pid_identity_mismatch recorded_pid=$recorded_pid"
    return
  fi

  echo "LOCK_METADATA_STATUS active owner_pid=$recorded_pid operation=$(metadata_value operation) run_id=$(metadata_value run_id) started_at=$(metadata_value started_at)"
}

write_metadata() {
  local temp_file commit start_ticks
  temp_file="$(mktemp "${LOCK_METADATA_FILE}.tmp.XXXXXX")"
  commit="$(git -C "$SCRIPT_DIR/.." rev-parse HEAD 2>/dev/null || echo unknown)"
  start_ticks="$(process_start_ticks "$$")"

  {
    echo "version=1"
    echo "owner_pid=$$"
    echo "owner_start_ticks=$start_ticks"
    echo "child_pid="
    echo "operation=$OPERATION_NAME"
    echo "run_id=$RUN_ID"
    echo "git_commit=$commit"
    echo "started_at=$(date --iso-8601=seconds)"
    echo "executing_user=$(id -un)"
    echo "hostname=$(hostname)"
  } > "$temp_file"
  chmod 600 "$temp_file"
  mv -f "$temp_file" "$LOCK_METADATA_FILE"
  OWNER_START_TICKS="$start_ticks"
}

update_child_metadata() {
  local child_pid="$1" temp_file
  temp_file="$(mktemp "${LOCK_METADATA_FILE}.tmp.XXXXXX")"
  awk -F= -v child_pid="$child_pid" '
    $1 == "child_pid" { print "child_pid=" child_pid; next }
    { print }
  ' "$LOCK_METADATA_FILE" > "$temp_file"
  chmod 600 "$temp_file"
  mv -f "$temp_file" "$LOCK_METADATA_FILE"
}

cleanup_metadata() {
  local status=$?
  if [ -f "$LOCK_METADATA_FILE" ]; then
    local recorded_pid recorded_ticks
    recorded_pid="$(metadata_value owner_pid)"
    recorded_ticks="$(metadata_value owner_start_ticks)"
    if [ "$recorded_pid" = "$$" ] && [ "$recorded_ticks" = "${OWNER_START_TICKS:-}" ]; then
      rm -f "$LOCK_METADATA_FILE"
      echo "PRODUCTION_LOCK_METADATA_CLEARED operation=$OPERATION_NAME run_id=$RUN_ID"
    else
      echo "PRODUCTION_LOCK_METADATA_PRESERVED reason=owner_mismatch operation=$OPERATION_NAME" >&2
    fi
  fi
  return "$status"
}

forward_signal() {
  local signal="$1"
  echo "PRODUCTION_LOCK_SIGNAL signal=$signal operation=$OPERATION_NAME child_pid=${CHILD_PID:-none}" >&2
  if [ -n "${CHILD_PID:-}" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill "-$signal" "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  exit 128
}

classify_existing_metadata

if command -v flock >/dev/null 2>&1; then
  exec 9>>"$LOCK_FILE"
  echo "Waiting for production lock: ${OPERATION_NAME}"
  if ! flock -x -w "$LOCK_TIMEOUT_SECONDS" 9; then
    echo "PRODUCTION_LOCK_ACQUIRE_FAILED operation=$OPERATION_NAME timeout_seconds=$LOCK_TIMEOUT_SECONDS" >&2
    exit 75
  fi

  OWNER_START_TICKS=""
  CHILD_PID=""
  write_metadata
  trap cleanup_metadata EXIT
  trap 'forward_signal TERM' TERM
  trap 'forward_signal INT' INT
  trap 'forward_signal HUP' HUP

  echo "PRODUCTION_LOCK_ACQUIRED operation=$OPERATION_NAME run_id=$RUN_ID owner_pid=$$"
  env MYKINLEGACY_LOCK_HELD=true "$@" &
  CHILD_PID=$!
  update_child_metadata "$CHILD_PID"
  set +e
  wait "$CHILD_PID"
  command_status=$?
  set -e
  CHILD_PID=""
  if [ "$command_status" -ne 0 ]; then
    echo "PRODUCTION_LOCK_COMMAND_FAILED operation=$OPERATION_NAME exit_code=$command_status" >&2
  else
    echo "PRODUCTION_LOCK_COMMAND_COMPLETE operation=$OPERATION_NAME"
  fi
  exit "$command_status"
fi

LOCK_DIR="${LOCK_FILE}.dir"
START_TIME="$(date +%s)"
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  NOW="$(date +%s)"
  if [ $((NOW - START_TIME)) -ge "$LOCK_TIMEOUT_SECONDS" ]; then
    echo "PRODUCTION_LOCK_ACQUIRE_FAILED operation=$OPERATION_NAME timeout_seconds=$LOCK_TIMEOUT_SECONDS fallback=mkdir" >&2
    exit 75
  fi
  sleep 1
done

OWNER_START_TICKS=""
CHILD_PID=""
write_metadata

cleanup_fallback_lock() {
  local status=$?
  cleanup_metadata || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
  return "$status"
}

trap cleanup_fallback_lock EXIT
trap 'forward_signal TERM' TERM
trap 'forward_signal INT' INT
trap 'forward_signal HUP' HUP

echo "PRODUCTION_LOCK_ACQUIRED operation=$OPERATION_NAME run_id=$RUN_ID owner_pid=$$ fallback=mkdir"
env MYKINLEGACY_LOCK_HELD=true "$@" &
CHILD_PID=$!
update_child_metadata "$CHILD_PID"
set +e
wait "$CHILD_PID"
command_status=$?
set -e
CHILD_PID=""
if [ "$command_status" -ne 0 ]; then
  echo "PRODUCTION_LOCK_COMMAND_FAILED operation=$OPERATION_NAME exit_code=$command_status fallback=mkdir" >&2
else
  echo "PRODUCTION_LOCK_COMMAND_COMPLETE operation=$OPERATION_NAME fallback=mkdir"
fi
exit "$command_status"
