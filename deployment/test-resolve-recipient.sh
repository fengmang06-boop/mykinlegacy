#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/test-resolve-recipient.sh <ORDER_NUMBER>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production is missing"
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "MyKinLegacy recipient resolution diagnostic"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "No raw customer email, vault token, or secrets are printed."
echo

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const { resolveDeliveryRecipient } = require("./apps/worker/dist/vault-delivery.js");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();

function payloadFormat(value) {
  if (!value) return "missing";
  const serialized = Buffer.from(value).toString("utf8");
  if (serialized.startsWith("enc:v1:")) return "encrypted";
  if (serialized.startsWith("placeholder:v1:")) return "placeholder";
  return "malformed";
}

function safeResolution(resolution) {
  if (resolution.ok) {
    return {
      ok: true,
      recipient_source: resolution.recipientSource,
      delivery_test_mode: resolution.deliveryTestMode,
      recipient_hash: resolution.recipientEmailHash,
      intended_recipient_hash: resolution.intendedRecipientHash
    };
  }
  return {
    ok: false,
    reason: resolution.reason,
    recipient_source: resolution.recipientSource,
    delivery_test_mode: resolution.deliveryTestMode,
    recipient_hash: resolution.recipientEmailHash,
    intended_recipient_hash: resolution.intendedRecipientHash
  };
}

(async () => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { orderCustomerPii: true }
  });
  if (!order) {
    console.log(JSON.stringify({ found: false, order_number: orderNumber }, null, 2));
    process.exit(2);
  }

  const liveEnv = { ...process.env, EMAIL_DELIVERY_TEST_MODE: "false" };
  const activeResolution = await resolveDeliveryRecipient(prisma, order.id, process.env);
  const liveCustomerResolution = await resolveDeliveryRecipient(prisma, order.id, liveEnv);

  console.log(JSON.stringify({
    found: true,
    order_number: order.orderNumber,
    order_id_present: Boolean(order.id),
    pii_row_exists: Boolean(order.orderCustomerPii) ? "yes" : "no",
    pii_order_id_matches: order.orderCustomerPii?.orderId === order.id ? "yes" : "no",
    payload_encrypted: payloadFormat(order.orderCustomerPii?.emailEncrypted) === "encrypted" ? "yes" : "no",
    payload_format: payloadFormat(order.orderCustomerPii?.emailEncrypted),
    stored_email_hash_present: Boolean(order.orderCustomerPii?.emailHash) ? "yes" : "no",
    active_env_resolution: safeResolution(activeResolution),
    live_customer_resolution: safeResolution(liveCustomerResolution)
  }, null, 2));
})()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
