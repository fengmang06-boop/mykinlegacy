#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:---dry-run}"

case "$MODE" in
  --dry-run) ;;
  --apply)
    if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
      exec bash "$SCRIPT_DIR/with-production-lock.sh" \
        "docker-safe-cleanup" bash "$0" --apply
    fi
    ;;
  *)
    echo "Usage: bash deployment/docker-safe-cleanup.sh [--dry-run|--apply]" >&2
    exit 64
    ;;
esac

current_image="$(tr -d '\r\n' < "$SCRIPT_DIR/.last-successful-image" 2>/dev/null || true)"
previous_image="$(tr -d '\r\n' < "$SCRIPT_DIR/.previous_image" 2>/dev/null || true)"
mapfile -t used_image_ids < <(
  docker ps -aq |
    xargs -r docker inspect --format '{{.Image}}' |
    sort -u
)
mapfile -t dangling_ids < <(docker image ls --filter dangling=true -q --no-trunc | sort -u)

echo "DOCKER_SAFE_CLEANUP_BEGIN mode=$MODE"
echo "protected_current_image=${current_image:-unavailable}"
echo "protected_rollback_image=${previous_image:-unavailable}"
echo "disk_before=$(df -P -B1 / | awk 'NR==2 {print $2 \":\" $3 \":\" $4 \":\" $5}')"

removable=()
for image_id in "${dangling_ids[@]}"; do
  [ -n "$image_id" ] || continue
  protected=no
  reason="REMOVABLE_DANGLING"
  for used_id in "${used_image_ids[@]}"; do
    if [ "$image_id" = "$used_id" ]; then
      protected=yes
      reason="PROTECTED_CONTAINER_REFERENCE"
      break
    fi
  done
  for protected_ref in "$current_image" "$previous_image"; do
    [ -n "$protected_ref" ] || continue
    protected_id="$(docker image inspect --format '{{.Id}}' "$protected_ref" 2>/dev/null || true)"
    if [ "$image_id" = "$protected_id" ]; then
      protected=yes
      reason="PROTECTED_RELEASE_REFERENCE"
      break
    fi
  done
  size="$(docker image inspect --format '{{.Size}}' "$image_id" 2>/dev/null || echo unknown)"
  created="$(docker image inspect --format '{{.Created}}' "$image_id" 2>/dev/null || echo unknown)"
  echo "candidate_id=$image_id size_bytes=$size created=$created classification=$reason"
  if [ "$protected" = "no" ]; then
    removable+=("$image_id")
  fi
done

echo "removable_count=${#removable[@]}"
if [ "$MODE" = "--apply" ]; then
  for image_id in "${removable[@]}"; do
    docker image rm "$image_id"
  done
fi
echo "disk_after=$(df -P -B1 / | awk 'NR==2 {print $2 \":\" $3 \":\" $4 \":\" $5}')"
echo "DOCKER_SAFE_CLEANUP_END result=PASS"
