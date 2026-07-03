#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/inspect-artifacts.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy artifact delivery inspection"
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

function maskStorageKey(value) {
  if (!value) return "missing";
  const parts = String(value).split("/");
  return parts.length > 3 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
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
  const placeholder = dbSize <= 512 || (actualSize !== null && actualSize <= 512);
  return {
    artifact_type: asset.deliverableType?.code ?? asset.deliverableTypeId,
    asset_id_hash: hash(asset.id),
    db_status: asset.status,
    storage_provider: asset.storageProvider,
    storage_bucket: asset.storageBucket,
    storage_key_masked: maskStorageKey(asset.storageKey),
    db_file_size: dbSize,
    actual_file_size: actualSize,
    mime_type: asset.mimeType,
    file_ext: asset.fileExt,
    placeholder,
    storage_file_exists: fileExists,
    downloadable: asset.status === "available" && fileExists && !placeholder,
    storage_error: storageError
  };
}

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      assets: { include: { deliverableType: true }, orderBy: { createdAt: "asc" } },
      downloadTokens: { include: { downloadTokenAssets: true } },
      generationManifests: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!order) {
    console.log(JSON.stringify({ ok: false, reason: "order_not_found" }, null, 2));
    process.exitCode = 1;
    return;
  }

  const artifacts = [];
  for (const asset of order.assets) artifacts.push(await inspectAsset(asset));
  const downloadableCount = artifacts.filter((item) => item.downloadable).length;
  const placeholderCount = artifacts.filter((item) => item.placeholder).length;

  console.log(JSON.stringify({
    ok: true,
    order_number: order.orderNumber,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    fulfillment_status: order.fulfillmentStatus,
    manifest_status: order.generationManifests[0]?.manifestStatus ?? null,
    assets_count: artifacts.length,
    downloadable_count: downloadableCount,
    placeholder_count: placeholderCount,
    active_download_tokens: order.downloadTokens.filter((token) => token.status === "active").length,
    linked_download_assets: order.downloadTokens.reduce((total, token) => total + token.downloadTokenAssets.length, 0),
    artifacts
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
NODE
