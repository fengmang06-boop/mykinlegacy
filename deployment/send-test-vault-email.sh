#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/send-test-vault-email.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy direct vault email diagnostic"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "This creates a fresh private vault token and sends one delivery email."
echo "No raw customer email, vault token, or secrets are printed."
echo

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash, randomBytes } = require("node:crypto");
const { PrismaClient } = require("./packages/database/generated/client");
const emailModule = require("@ai-heritage/email");
const { resolveDeliveryRecipient, sendVaultReadyEmail } = require("./apps/worker/dist/vault-delivery.js");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();

function createLocalId() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let id = "";
  for (const byte of randomBytes(26)) id += alphabet[byte % alphabet.length];
  return id;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

async function createFreshToken(order) {
  const activeToken = order.downloadTokens.find((token) => token.status === "active");
  const assetIds = activeToken
    ? activeToken.downloadTokenAssets.map((link) => link.assetId)
    : order.assets.map((asset) => asset.id);

  if (assetIds.length === 0) {
    throw new Error("vault_ready_assets_missing");
  }

  const now = new Date();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenId = createLocalId();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);

  await prisma.downloadToken.create({
    data: {
      id: tokenId,
      orderId: order.id,
      tokenHash: sha256(rawToken),
      status: "active",
      expiresAt,
      maxDownloads: 20,
      downloadCount: 0,
      createdBy: "system",
      createdAt: now
    }
  });

  for (const assetId of assetIds) {
    await prisma.downloadTokenAsset.create({
      data: {
        id: createLocalId(),
        downloadTokenId: tokenId,
        assetId,
        createdAt: now
      }
    });
  }

  return { tokenId, rawToken, expiresAt, assetCount: assetIds.length };
}

(async () => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      orderCustomerPii: true,
      assets: true,
      downloadTokens: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        include: { downloadTokenAssets: true }
      }
    }
  });

  if (!order) {
    console.log(JSON.stringify({ found: false, order_number: orderNumber }, null, 2));
    process.exit(2);
  }

  const resolution = await resolveDeliveryRecipient(prisma, order.id, process.env);
  if (!resolution.ok) {
    console.log(JSON.stringify({
      found: true,
      order_number: order.orderNumber,
      recipient_resolution: safeResolution(resolution),
      email_send_attempted: false
    }, null, 2));
    process.exit(3);
  }

  const token = await createFreshToken(order);
  const workerLogs = [];
  const result = await sendVaultReadyEmail({
    db: prisma,
    emailModule,
    order_id: order.id,
    order_number: order.orderNumber,
    download_token_id: token.tokenId,
    raw_token_for_email_only: token.rawToken,
    expires_at: token.expiresAt,
    log: (entry) => {
      workerLogs.push({
        level: entry.level,
        message: entry.message,
        extra: entry.extra
          ? {
              order_number: entry.extra.order_number,
              provider: entry.extra.provider,
              delivery_status: entry.extra.delivery_status,
              recipient_source: entry.extra.recipient_source,
              delivery_test_mode: entry.extra.delivery_test_mode,
              reason: entry.extra.reason,
              raw_token_omitted: true
            }
          : undefined
      });
    }
  });

  const emailLog = result.email_log_id
    ? await prisma.emailLog.findUnique({ where: { id: result.email_log_id } })
    : null;

  console.log(JSON.stringify({
    found: true,
    order_number: order.orderNumber,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    fulfillment_status: order.fulfillmentStatus,
    fresh_download_token_created: "yes",
    fresh_download_token_id: token.tokenId,
    fresh_download_token_asset_count: token.assetCount,
    raw_token_stored: "no",
    recipient_resolution: safeResolution(resolution),
    email_result: {
      status: result.status,
      email_log_id: result.email_log_id,
      recipient_source: result.recipient_source
    },
    email_log: emailLog
      ? {
          provider: emailLog.provider,
          status: emailLog.status,
          provider_message_id: emailLog.providerMessageId,
          error_message: emailLog.errorMessage
        }
      : null,
    delivery_logs_safe: workerLogs
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
