#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_FILE="$SCRIPT_DIR/.production.lock"
LOCK_TIMEOUT_SECONDS="${PRODUCTION_LOCK_TIMEOUT_SECONDS:-1800}"

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

if command -v flock >/dev/null 2>&1; then
  echo "Waiting for production lock: ${OPERATION_NAME}"
  flock -x -w "$LOCK_TIMEOUT_SECONDS" "$LOCK_FILE" env MYKINLEGACY_LOCK_HELD=true "$@"
  exit $?
fi

LOCK_DIR="${LOCK_FILE}.dir"
START_TIME="$(date +%s)"
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  NOW="$(date +%s)"
  if [ $((NOW - START_TIME)) -ge "$LOCK_TIMEOUT_SECONDS" ]; then
    echo "FAIL production lock timeout: ${OPERATION_NAME}"
    exit 1
  fi
  sleep 5
done

cleanup_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup_lock EXIT

echo "Acquired production lock: ${OPERATION_NAME}"
MYKINLEGACY_LOCK_HELD=true "$@"
