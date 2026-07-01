#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [ $# -ne 1 ]; then
  echo "Usage: bash deployment/inspect-order.sh <order_number>"
  exit 1
fi

ORDER_NUMBER="$1"

if [[ ! "$ORDER_NUMBER" =~ ^[A-Z0-9-]{8,64}$ ]]; then
  echo "FAIL order_number must contain only uppercase letters, numbers, and hyphens"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production is missing"
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

sql() {
  compose exec -T mysql sh -lc 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" --table --execute "$MYSQL_QUERY"'
}

echo "MyKinLegacy sanitized order inspection"
echo "Order: $ORDER_NUMBER"
echo

MYSQL_QUERY="
SELECT
  id,
  order_number,
  order_status,
  payment_status,
  fulfillment_status,
  total_cents,
  currency,
  paid_at,
  completed_at,
  created_at,
  updated_at
FROM orders
WHERE order_number = '$ORDER_NUMBER';
"
sql

MYSQL_QUERY="
SELECT
  oi.id AS order_item_id,
  p.code AS product_code,
  pp.code AS package_code,
  oi.status,
  oi.total_price_cents,
  oi.currency
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
JOIN product_packages pp ON pp.id = oi.package_id
WHERE o.order_number = '$ORDER_NUMBER';
"
sql

MYSQL_QUERY="
SELECT
  oe.id,
  oe.event_type,
  oe.status,
  oe.attempts,
  oe.next_attempt_at,
  oe.created_at,
  oe.published_at
FROM outbox_events oe
JOIN orders o ON o.id = oe.aggregate_id
WHERE o.order_number = '$ORDER_NUMBER'
ORDER BY oe.created_at ASC;
"
sql

MYSQL_QUERY="
SELECT
  gm.id,
  gm.manifest_status,
  JSON_LENGTH(gm.expected_assets_json) AS expected_assets,
  JSON_LENGTH(gm.generated_assets_json) AS generated_assets,
  JSON_LENGTH(gm.missing_required_assets_json) AS missing_required_assets,
  JSON_LENGTH(gm.failed_assets_json) AS failed_assets,
  gm.created_at,
  gm.updated_at,
  gm.completed_at
FROM generation_manifests gm
JOIN orders o ON o.id = gm.order_id
WHERE o.order_number = '$ORDER_NUMBER';
"
sql

MYSQL_QUERY="
SELECT
  gj.id,
  gj.status,
  gj.attempts,
  gj.max_attempts,
  gj.error_code,
  gj.created_at,
  gj.updated_at,
  gj.completed_at
FROM generation_jobs gj
JOIN orders o ON o.id = gj.order_id
WHERE o.order_number = '$ORDER_NUMBER';
"
sql

MYSQL_QUERY="
SELECT
  a.id,
  dt.code AS deliverable_code,
  a.asset_type,
  a.asset_kind,
  a.status,
  a.file_ext,
  a.size_bytes,
  a.public_url IS NOT NULL AS has_public_url,
  a.created_at
FROM assets a
JOIN orders o ON o.id = a.order_id
JOIN deliverable_types dt ON dt.id = a.deliverable_type_id
WHERE o.order_number = '$ORDER_NUMBER'
ORDER BY a.created_at ASC;
"
sql

MYSQL_QUERY="
SELECT
  dt.id,
  dt.status,
  dt.expires_at,
  dt.max_downloads,
  dt.download_count,
  dt.token_hash IS NOT NULL AS token_hash_present,
  COUNT(dta.id) AS linked_assets,
  dt.created_at
FROM download_tokens dt
JOIN orders o ON o.id = dt.order_id
LEFT JOIN download_token_assets dta ON dta.download_token_id = dt.id
WHERE o.order_number = '$ORDER_NUMBER'
GROUP BY dt.id;
"
sql

MYSQL_QUERY="
SELECT
  el.id,
  el.provider,
  el.status,
  el.provider_message_id,
  el.error_message,
  JSON_EXTRACT(el.payload_json, '$.masked_download_vault_link') AS masked_vault_link,
  JSON_EXTRACT(el.payload_json, '$.raw_token_present') AS raw_token_present,
  el.created_at,
  el.sent_at
FROM email_logs el
JOIN orders o ON o.id = el.order_id
WHERE o.order_number = '$ORDER_NUMBER'
ORDER BY el.created_at ASC;
"
sql

echo
echo "PASS sanitized inspection complete"
