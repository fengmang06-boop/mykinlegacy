#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/repair-order-email-pii.sh <ORDER_NUMBER>"
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

printf "Customer email for %s (input hidden): " "$ORDER_NUMBER"
IFS= read -r -s CUSTOMER_EMAIL
printf "\n"

if [ -z "$CUSTOMER_EMAIL" ]; then
  echo "FAIL customer email is required"
  exit 1
fi

echo "Repairing encrypted customer email PII for order: $ORDER_NUMBER"
echo "Raw customer email will not be printed."

compose exec -T -e REPAIR_ORDER_NUMBER="$ORDER_NUMBER" -e REPAIR_CUSTOMER_EMAIL="$CUSTOMER_EMAIL" api node - <<'NODE'
const { createCipheriv, createHash, randomBytes } = require("node:crypto");
const { PrismaClient } = require("./packages/database/generated/client");

const prisma = new PrismaClient();
const orderNumber = process.env.REPAIR_ORDER_NUMBER;
const customerEmail = (process.env.REPAIR_CUSTOMER_EMAIL || "").trim().toLowerCase();
const rawKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY || process.env.PII_ENCRYPTION_KEY;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function isPlaceholderSecret(value) {
  return value === "disabled" || value === "replace_me" || value.startsWith("replace_with_");
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encryptEmailForStorage(email) {
  const key = createHash("sha256").update(rawKey).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`,
    "utf8"
  );
}

function createLocalId() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let id = "";
  for (const byte of randomBytes(26)) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
}

(async () => {
  if (!orderNumber) fail("order number is required");
  if (!validateEmail(customerEmail)) fail("customer email format is invalid");
  if (!rawKey || isPlaceholderSecret(rawKey)) fail("CUSTOMER_PII_ENCRYPTION_KEY is not configured");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true }
  });
  if (!order) fail("order not found");

  const now = new Date();
  await prisma.orderCustomerPii.upsert({
    where: { orderId: order.id },
    create: {
      id: createLocalId(),
      orderId: order.id,
      emailEncrypted: encryptEmailForStorage(customerEmail),
      emailHash: sha256(customerEmail),
      nameEncrypted: null,
      billingCountry: null,
      createdAt: now,
      updatedAt: now
    },
    update: {
      emailEncrypted: encryptEmailForStorage(customerEmail),
      emailHash: sha256(customerEmail),
      updatedAt: now
    }
  });

  console.log(JSON.stringify({
    repaired: true,
    order_number: order.orderNumber,
    customer_email_hash: sha256(customerEmail),
    raw_email_printed: false
  }, null, 2));
})()
  .catch((error) => {
    console.error(JSON.stringify({ repaired: false, error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

unset CUSTOMER_EMAIL

echo "PASS customer email PII repaired"
echo "Next: bash deployment/inspect-email-delivery.sh $ORDER_NUMBER"
