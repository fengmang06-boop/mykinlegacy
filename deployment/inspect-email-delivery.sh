#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/inspect-email-delivery.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy email delivery diagnostic"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo

echo "Worker runtime env (safe)"
compose exec -T worker node - <<'NODE'
const names = [
  "EMAIL_PROVIDER",
  "EMAIL_DELIVERY_TEST_MODE",
  "EMAIL_TEST_RECIPIENT",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "CUSTOMER_PII_ENCRYPTION_KEY",
  "RESEND_API_KEY",
  "NODE_ENV",
  "WORKER_ENABLE_OUTBOX_DISPATCHER",
  "WORKER_POLL_INTERVAL_MS"
];
for (const name of names) {
  const value = process.env[name];
  if (name === "CUSTOMER_PII_ENCRYPTION_KEY" || name === "RESEND_API_KEY") {
    console.log(`${name}=${value ? "SET" : "EMPTY"}`);
  } else if (name === "EMAIL_TEST_RECIPIENT") {
    console.log(`${name}=${value ? "SET" : "EMPTY"}`);
  } else {
    console.log(`${name}=${value ?? "EMPTY"}`);
  }
}
NODE
echo

echo "Order / vault / email log diagnostic (safe)"
compose exec -T api node - "$ORDER_NUMBER" <<'NODE'
const { createDecipheriv, createHash } = require("node:crypto");
const { PrismaClient } = require("./packages/database/generated/client");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();

function decryptableEmail(value) {
  if (!value) return false;
  const serialized = Buffer.from(value).toString("utf8");
  if (!serialized.startsWith("enc:v1:")) return false;
  const [, , ivBase64, tagBase64, ciphertextBase64] = serialized.split(":");
  const rawKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY || process.env.PII_ENCRYPTION_KEY;
  if (!rawKey || rawKey === "disabled" || rawKey === "replace_me" || rawKey.startsWith("replace_with_")) {
    return false;
  }
  try {
    const key = createHash("sha256").update(rawKey).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64url"));
    Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64url")),
      decipher.final()
    ]).toString("utf8");
    return true;
  } catch {
    return false;
  }
}

function piiPayloadFormat(value) {
  if (!value) return "missing";
  const serialized = Buffer.from(value).toString("utf8");
  if (serialized.startsWith("enc:v1:")) return "encrypted";
  if (serialized.startsWith("placeholder:v1:")) return "placeholder";
  return "malformed";
}

function safePayload(payload) {
  const safe = payload && typeof payload === "object" ? { ...payload } : {};
  for (const key of Object.keys(safe)) {
    if (/email|token|secret|key|html|text|body/i.test(key) && key !== "download_token_id") {
      safe[key] = "[redacted]";
    }
  }
  if (safe.masked_download_vault_link) safe.masked_download_vault_link = "/download/[redacted]";
  return safe;
}

(async () => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      orderCustomerPii: true,
      generationManifests: { orderBy: { createdAt: "desc" }, take: 1 },
      assets: true,
      downloadTokens: {
        orderBy: { createdAt: "desc" },
        include: { downloadTokenAssets: true }
      },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!order) {
    console.log(JSON.stringify({ found: false, order_number: orderNumber }, null, 2));
    process.exit(2);
  }
  const latestEmailLog = order.emailLogs[0] || null;
  const latestPayload = latestEmailLog ? safePayload(latestEmailLog.payloadJson) : null;
  const result = {
    found: true,
    order_number: order.orderNumber,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    fulfillment_status: order.fulfillmentStatus,
    completed_at: order.completedAt ? order.completedAt.toISOString() : null,
    manifest_status: order.generationManifests[0]?.status ?? null,
    assets_count: order.assets.length,
    download_token_count: order.downloadTokens.length,
    download_ready: order.downloadTokens.some((token) => token.status === "active"),
    latest_download_token_asset_count: order.downloadTokens[0]?.downloadTokenAssets.length ?? 0,
    email_log_count: order.emailLogs.length,
    customer_pii_exists: Boolean(order.orderCustomerPii),
    customer_pii_row_exists: Boolean(order.orderCustomerPii) ? "yes" : "no",
    pii_order_id_matches: order.orderCustomerPii?.orderId === order.id ? "yes" : "no",
    customer_email_pii_exists: Boolean(order.orderCustomerPii?.emailEncrypted),
    customer_email_pii_format: piiPayloadFormat(order.orderCustomerPii?.emailEncrypted),
    customer_email_payload_format: piiPayloadFormat(order.orderCustomerPii?.emailEncrypted),
    customer_email_decryptable: decryptableEmail(order.orderCustomerPii?.emailEncrypted),
    latest_email_log: latestEmailLog
      ? {
          provider: latestEmailLog.provider,
          status: latestEmailLog.status,
          error_message: latestEmailLog.errorMessage,
          provider_message_id: latestEmailLog.providerMessageId,
          created_at: latestEmailLog.createdAt.toISOString(),
          sent_at: latestEmailLog.sentAt ? latestEmailLog.sentAt.toISOString() : null,
          delivery_test_mode: latestPayload?.delivery_test_mode ?? null,
          recipient_source: latestPayload?.recipient_source ?? null,
          resend_message_id: latestEmailLog.provider === "resend" ? latestEmailLog.providerMessageId : null,
          payload_json_safe: latestPayload
        }
      : null,
    recent_email_logs: order.emailLogs.map((log) => ({
      provider: log.provider,
      status: log.status,
      error_message: log.errorMessage,
      provider_message_id: log.providerMessageId,
      created_at: log.createdAt.toISOString()
    }))
  };
  console.log(JSON.stringify(result, null, 2));
})()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
echo

echo "Worker logs from last 60 minutes (delivery-related)"
compose logs --since=60m worker 2>/dev/null | grep -E \
  'worker_started|scanner_started|scanner_found_candidates|recovery_candidate_order|EMAIL_TRIGGER_CONDITION_MET|EMAIL_TRIGGER_SKIPPED_REASON|EMAIL_JOB_ENQUEUED|EMAIL_JOB_CONSUMED|EMAIL_HANDLER_EXECUTED|delivery_attempt_start|delivery_recipient_source|resend_provider_selected|resend_send_start|resend_send_success|delivery_failure_reason|EMAIL_DECRYPTION_SUCCESS|EMAIL_DECRYPTION_FAILED|EMAIL_JOB_CREATED|EMAIL_TRIGGERED|EMAIL_SKIPPED_REASON|delivery_email_failed|unsafe_live_email_recipient_internal_inbox|customer_email|payment-confirmation|vault|resend' \
  || echo "No matching worker delivery logs found in the last 60 minutes."
