#!/usr/bin/env bash

capacity_alert_level() {
  local usage_percent="$1" free_bytes="$2" inode_percent="$3" growth_24h_bytes="${4:-0}"
  local gb=$((1024 * 1024 * 1024))
  if [ "$usage_percent" -ge 92 ] || [ "$free_bytes" -lt $((8 * gb)) ] ||
    [ "$inode_percent" -ge 92 ]; then
    echo "CRITICAL"
  elif [ "$usage_percent" -ge 85 ] || [ "$free_bytes" -lt $((15 * gb)) ] ||
    [ "$inode_percent" -ge 85 ]; then
    echo "HIGH"
  elif [ "$usage_percent" -ge 75 ] || [ "$free_bytes" -lt $((25 * gb)) ] ||
    [ "$inode_percent" -ge 75 ] || [ "$growth_24h_bytes" -gt $((5 * gb)) ]; then
    echo "WARNING"
  else
    echo "INFO"
  fi
}

deployment_capacity_allowed() {
  local usage_percent="$1" free_bytes="$2" inode_percent="$3"
  local mysql_health="$4" docker_health="$5"
  local gb=$((1024 * 1024 * 1024))
  [ "$usage_percent" -lt 85 ] &&
    [ "$free_bytes" -ge $((15 * gb)) ] &&
    [ "$inode_percent" -lt 85 ] &&
    [ "$mysql_health" = "healthy" ] &&
    [ "$docker_health" = "healthy" ]
}

filesystem_metrics() {
  local path="${1:-/}"
  df -P -B1 "$path" | awk 'NR == 2 {gsub(/%/, "", $5); print $2, $3, $4, $5}'
}

inode_metrics() {
  local path="${1:-/}"
  df -P -i "$path" | awk 'NR == 2 {gsub(/%/, "", $5); print $2, $3, $4, $5}'
}
