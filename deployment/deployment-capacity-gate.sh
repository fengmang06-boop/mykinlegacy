#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deployment/storage-capacity-lib.sh
. "$SCRIPT_DIR/storage-capacity-lib.sh"

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
else
  read -r root_total root_used root_free root_usage < <(filesystem_metrics /)
  read -r inode_total inode_used inode_free inode_usage < <(inode_metrics /)
  docker info >/dev/null 2>&1 && docker_health=healthy || docker_health=unhealthy
  mysql_health="$(
    docker inspect --format \
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      mykinlegacy_mysql 2>/dev/null || echo unavailable
  )"
fi

alert_level="$(capacity_alert_level "$root_usage" "$root_free" "$inode_usage" 0)"
echo "CAPACITY_GATE_METRICS total_bytes=$root_total used_bytes=$root_used free_bytes=$root_free usage_percent=$root_usage inode_total=$inode_total inode_used=$inode_used inode_free=$inode_free inode_percent=$inode_usage mysql=$mysql_health docker=$docker_health alert=$alert_level"

if ! deployment_capacity_allowed \
  "$root_usage" "$root_free" "$inode_usage" "$mysql_health" "$docker_health"; then
  echo "DEPLOYMENT_BLOCKED_LOW_DISK_CAPACITY usage_percent=$root_usage free_bytes=$root_free inode_percent=$inode_usage mysql=$mysql_health docker=$docker_health" >&2
  exit 78
fi

echo "DEPLOYMENT_CAPACITY_GATE_PASS"
