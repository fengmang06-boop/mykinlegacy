#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/inspect-delivery-state.sh <ORDER_NUMBER>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"

if [[ ! "$ORDER_NUMBER" =~ ^[A-Z0-9-]{8,64}$ ]]; then
  echo "FAIL order_number must contain only uppercase letters, numbers, and hyphens"
  exit 1
fi

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

echo "MyKinLegacy delivery state inspection"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "No raw vault token, customer email, or secrets are printed."
echo

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const { PrismaClient } = require("./packages/database/generated/client");

const workerRequire = createRequire(path.join(process.cwd(), "apps/worker/package.json"));
const { LocalPrivateStorageAdapter } = workerRequire("@ai-heritage/storage");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();
const storage = new LocalPrivateStorageAdapter();

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function minimumBytes(fileExt) {
  if (fileExt === "zip") return 20 * 1024;
  if (fileExt === "png" || fileExt === "pdf") return 10 * 1024;
  return 1024;
}

function deliveryStatus(input) {
  if (input.payment_status !== "paid") return "preparing";
  if (input.vault_ready && input.artifacts_downloadable) {
    return input.fulfillment_status === "failed" ? "email_delivery_attention" : "vault_ready";
  }
  if (
    input.manifest_status === "failed" ||
    input.failed_assets_count > 0 ||
    (input.fulfillment_status === "failed" && !input.artifacts_downloadable)
  ) {
    return "artifact_generation_failed";
  }
  if (input.fulfillment_status === "failed") return "failed";
  return "preparing";
}

function maskStorageKey(value) {
  if (!value) return "missing";
  const parts = String(value).split("/");
  return parts.length > 3 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

async function inspectAsset(asset) {
  let actualSize = null;
  let fileExists = false;
  let storageError = null;
  try {
    const body = await storage.getObject({
      storage_provider: asset.storageProvider,
      storage_bucket: asset.storageBucket,
      storage_key: asset.storageKey
    });
    actualSize = body.byteLength;
    fileExists = true;
  } catch (error) {
    storageError = error instanceof Error ? error.message : "storage_read_failed";
  }
  const dbSize = Number(asset.sizeBytes ?? 0);
  const requiredBytes = minimumBytes(asset.fileExt);
  const placeholder = dbSize < requiredBytes || (actualSize !== null && actualSize < requiredBytes);
  const statusAvailable = asset.status === "available" || asset.status === "available_for_download";
  return {
    artifact_type: asset.deliverableType?.code ?? asset.deliverableTypeId,
    asset_id_hash: hash(asset.id),
    db_status: asset.status,
    storage_key_masked: maskStorageKey(asset.storageKey),
    db_file_size: dbSize,
    actual_file_size: actualSize,
    required_min_bytes: requiredBytes,
    mime_type: asset.mimeType,
    file_ext: asset.fileExt,
    placeholder,
    storage_file_exists: fileExists,
    downloadable: statusAvailable && fileExists && !placeholder,
    storage_error: storageError
  };
}

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      assets: { include: { deliverableType: true }, orderBy: { createdAt: "asc" } },
      downloadTokens: { include: { downloadTokenAssets: true }, orderBy: { createdAt: "desc" } },
      generationManifests: { orderBy: { createdAt: "desc" }, take: 1 },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });

  if (!order) {
    console.log(JSON.stringify({ ok: false, reason: "order_not_found" }, null, 2));
    process.exitCode = 1;
    return;
  }

  const artifacts = [];
  for (const asset of order.assets) artifacts.push(await inspectAsset(asset));
  const activeTokens = order.downloadTokens.filter((token) => token.status === "active");
  const downloadableCount = artifacts.filter((asset) => asset.downloadable).length;
  const placeholderCount = artifacts.filter((asset) => asset.placeholder).length;
  const latestManifest = order.generationManifests[0] ?? null;
  const expectedCount = Array.isArray(latestManifest?.expectedAssetsJson) ? latestManifest.expectedAssetsJson.length : 0;
  const vaultReady = activeTokens.length > 0 && latestManifest?.manifestStatus === "completed";
  const artifactsDownloadable = expectedCount > 0 && downloadableCount >= expectedCount && placeholderCount === 0;
  const customerDeliveryStatus = deliveryStatus({
    payment_status: order.paymentStatus,
    fulfillment_status: order.fulfillmentStatus,
    manifest_status: latestManifest?.manifestStatus ?? null,
    failed_assets_count: Array.isArray(latestManifest?.failedAssetsJson) ? latestManifest.failedAssetsJson.length : 0,
    vault_ready: vaultReady,
    artifacts_downloadable: artifactsDownloadable
  });
  const contradictoryState =
    vaultReady &&
    order.fulfillmentStatus === "failed" &&
    customerDeliveryStatus !== "email_delivery_attention" &&
    customerDeliveryStatus !== "artifact_generation_failed";

  console.log(JSON.stringify({
    ok: true,
    order_number: order.orderNumber,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    internal_fulfillment_status: order.fulfillmentStatus,
    customer_delivery_status: customerDeliveryStatus,
    manifest_status: latestManifest?.manifestStatus ?? null,
    vault_ready: vaultReady,
    assets_count: artifacts.length,
    expected_artifacts_count: expectedCount,
    downloadable_count: downloadableCount,
    placeholder_count: placeholderCount,
    active_download_token_count: activeTokens.length,
    linked_download_assets: activeTokens[0]?.downloadTokenAssets.length ?? 0,
    artifact_quality_status: artifactsDownloadable ? "downloadable" : "needs_attention",
    email_delivery_status: order.emailLogs[0]?.status ?? "none",
    email_delivery_provider: order.emailLogs[0]?.provider ?? "none",
    resend_message_id: order.emailLogs.find((log) => log.provider === "resend")?.providerMessageId ?? null,
    contradictory_state: contradictoryState ? "yes" : "no",
    artifacts,
    recent_email_logs: order.emailLogs.map((log) => ({
      provider: log.provider,
      status: log.status,
      error_message: log.errorMessage ? String(log.errorMessage).slice(0, 160) : null,
      provider_message_id_present: Boolean(log.providerMessageId),
      created_at: log.createdAt
    }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
NODE
