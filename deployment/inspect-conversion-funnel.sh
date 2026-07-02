#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"
DAYS="${1:-7}"

cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL env deployment/.env.production is missing"
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "MyKinLegacy conversion funnel summary"
echo "Window: last ${DAYS} day(s)"
echo "PII: no raw email, no vault token, no secrets"
echo

compose exec -T mysql mysql \
  -u"${MYSQL_USER:-mykinlegacy}" \
  -p"${MYSQL_PASSWORD:-}" \
  "${MYSQL_DATABASE:-mykinlegacy}" <<SQL
SELECT
  action AS event_name,
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.step_name')), action) AS step_name,
  COUNT(*) AS events,
  COUNT(DISTINCT entity_id) AS orders,
  ROUND(AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.duration_ms')) AS UNSIGNED))) AS avg_duration_ms,
  MIN(created_at) AS first_seen_utc,
  MAX(created_at) AS last_seen_utc
FROM audit_logs
WHERE entity_type = 'conversion_funnel'
  AND created_at >= UTC_TIMESTAMP() - INTERVAL ${DAYS} DAY
GROUP BY event_name, step_name
ORDER BY
  FIELD(action,
    'funnel_step_viewed',
    'funnel_step_completed',
    'checkout_started',
    'checkout_completed',
    'payment_success',
    'vault_opened',
    'email_sent_confirmed',
    'artifact_downloaded'
  ),
  step_name;
SQL

echo
echo "Slow steps over 3000ms"
compose exec -T mysql mysql \
  -u"${MYSQL_USER:-mykinlegacy}" \
  -p"${MYSQL_PASSWORD:-}" \
  "${MYSQL_DATABASE:-mykinlegacy}" <<SQL
SELECT
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.step_name')), action) AS step_name,
  action AS event_name,
  JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.order_number')) AS order_number,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.duration_ms')) AS UNSIGNED) AS duration_ms,
  created_at AS created_at_utc
FROM audit_logs
WHERE entity_type = 'conversion_funnel'
  AND created_at >= UTC_TIMESTAMP() - INTERVAL ${DAYS} DAY
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.duration_ms')) AS UNSIGNED) > 3000
ORDER BY duration_ms DESC
LIMIT 25;
SQL
