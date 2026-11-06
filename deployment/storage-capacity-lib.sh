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

is_nonnegative_integer() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

deployment_budget_required_bytes() {
  local phase="$1" peak_bytes="$2" background_growth_bytes="$3" uncertainty_bytes="$4"
  local floor_bytes=$((15 * 1024 * 1024 * 1024))

  is_nonnegative_integer "$peak_bytes" || return 2
  is_nonnegative_integer "$background_growth_bytes" || return 2
  is_nonnegative_integer "$uncertainty_bytes" || return 2

  case "$phase" in
    pre)
      echo $((floor_bytes + peak_bytes + background_growth_bytes + uncertainty_bytes))
      ;;
    post)
      echo $((floor_bytes + background_growth_bytes + uncertainty_bytes))
      ;;
    *)
      return 2
      ;;
  esac
}

deployment_budget_allowed() {
  local usage_percent="$1" free_bytes="$2" inode_percent="$3"
  local mysql_health="$4" docker_health="$5" phase="$6"
  local peak_bytes="$7" background_growth_bytes="$8" uncertainty_bytes="$9"
  local rollback_ready="${10}"
  local required_bytes

  is_nonnegative_integer "$free_bytes" || return 1
  required_bytes="$(
    deployment_budget_required_bytes \
      "$phase" "$peak_bytes" "$background_growth_bytes" "$uncertainty_bytes"
  )" || return 1

  [ "$usage_percent" -lt 85 ] &&
    [ "$free_bytes" -ge "$required_bytes" ] &&
    [ "$inode_percent" -lt 85 ] &&
    [ "$mysql_health" = "healthy" ] &&
    [ "$docker_health" = "healthy" ] &&
    [ "$rollback_ready" = "true" ]
}

filesystem_metrics() {
  local path="${1:-/}"
  df -P -B1 "$path" | awk 'NR == 2 {gsub(/%/, "", $5); print $2, $3, $4, $5}'
}

inode_metrics() {
  local path="${1:-/}"
  df -P -i "$path" | awk 'NR == 2 {gsub(/%/, "", $5); print $2, $3, $4, $5}'
}
