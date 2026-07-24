#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=deployment/storage-capacity-lib.sh
. "$SCRIPT_DIR/storage-capacity-lib.sh"

read -r root_total root_used root_free root_usage < <(filesystem_metrics /)
read -r inode_total inode_used inode_free inode_usage < <(inode_metrics /)
docker info >/dev/null 2>&1 && docker_health=healthy || docker_health=unhealthy
mysql_health="$(
  docker inspect --format \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    mykinlegacy_mysql 2>/dev/null || echo unavailable
)"
mysql_restarts="$(
  docker inspect --format '{{.RestartCount}}' mykinlegacy_mysql 2>/dev/null || echo unavailable
)"
mysql_started="$(
  docker inspect --format '{{.State.StartedAt}}' mykinlegacy_mysql 2>/dev/null || echo unavailable
)"
docker_images_bytes="$(
  docker system df --format '{{json .}}' 2>/dev/null |
    awk -F'"Size":"' '$0 ~ /"Type":"Images"/ {split($2,a,"\""); print a[1]; exit}'
)"
docker_reclaimable="$(
  docker system df --format '{{json .}}' 2>/dev/null |
    awk -F'"Reclaimable":"' '$0 ~ /"Type":"Images"/ {split($2,a,"\""); print a[1]; exit}'
)"
docker_directory_bytes="$(du -sx -B1 /var/lib/docker 2>/dev/null | awk '{print $1+0}')"
mysql_directory="$(
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Source}}{{end}}{{end}}' \
    mykinlegacy_mysql 2>/dev/null || true
)"
mysql_bytes="$(
  if [ -n "$mysql_directory" ] && [ -d "$mysql_directory" ]; then
    du -sx -B1 "$mysql_directory" 2>/dev/null | awk '{print $1+0}'
  else
    echo 0
  fi
)"
journal_bytes="$(du -sx -B1 /var/log/journal 2>/dev/null | awk '{print $1+0}')"
nginx_log_bytes="$(du -sx -B1 /var/log/nginx 2>/dev/null | awk '{print $1+0}')"
lock_holder="$(
  lslocks -n -o PID,PATH 2>/dev/null |
    awk -v lock="$SCRIPT_DIR/.production.lock" '$2 == lock {print $1; exit}'
)"
lock_status="${lock_holder:+HELD}"
lock_status="${lock_status:-FREE}"
largest_path="$(
  du -x -B1 -d 2 /var/lib/docker "$PROJECT_ROOT" /var/log /tmp /var/tmp 2>/dev/null |
    sort -nr | head -1 | tr '\t' ':'
)"
alert_level="$(capacity_alert_level "$root_usage" "$root_free" "$inode_usage" 0)"
if deployment_capacity_allowed \
  "$root_usage" "$root_free" "$inode_usage" "$mysql_health" "$docker_health"; then
  deployment_allowed=YES
else
  deployment_allowed=NO
fi

cat <<EOF
VPS_CAPACITY_STATUS_BEGIN
timestamp=$(date --iso-8601=seconds)
timezone=$(timedatectl show -p Timezone --value 2>/dev/null || date +%Z)
root_total_bytes=$root_total
root_used_bytes=$root_used
root_free_bytes=$root_free
root_usage_percent=$root_usage
inode_total=$inode_total
inode_used=$inode_used
inode_free=$inode_free
inode_usage_percent=$inode_usage
docker_directory_bytes=$docker_directory_bytes
docker_images_size=$docker_images_bytes
docker_images_reclaimable=$docker_reclaimable
mysql_data_bytes=$mysql_bytes
journal_bytes=$journal_bytes
nginx_log_bytes=$nginx_log_bytes
mysql_health=$mysql_health
mysql_restart_count=$mysql_restarts
mysql_started_at=$mysql_started
docker_health=$docker_health
production_lock_status=$lock_status
production_lock_holder=${lock_holder:-none}
largest_path=$largest_path
alert_level=$alert_level
deployment_allowed=$deployment_allowed
VPS_CAPACITY_STATUS_END
EOF

if [ "$alert_level" = "CRITICAL" ]; then
  exit 92
fi
