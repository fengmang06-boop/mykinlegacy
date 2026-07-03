#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/repair-order-artifacts.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy artifact repair"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "This regenerates private PNG/PDF/ZIP artifact files for the order."
echo "No raw vault token, customer email, or secrets are printed."
echo

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const { PrismaClient } = require("./packages/database/generated/client");

const workerRequire = createRequire(path.join(process.cwd(), "apps/worker/package.json"));
const { PrismaOrchestrationRepository, runManifestDrivenGeneration } = workerRequire("@ai-heritage/database");
const { LocalPrivateStorageAdapter, validateArtifactBuffer } = workerRequire("@ai-heritage/storage");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();
const storage = new LocalPrivateStorageAdapter();

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function maskStorageKey(value) {
  if (!value) return "missing";
  const parts = String(value).split("/");
  return parts.length > 3 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

async function inspectAsset(asset) {
  let actualSize = null;
  let exists = false;
  let validation = { valid: false, signature_valid: false, format_valid: false };
  try {
    const body = await storage.getObject({
      storage_provider: asset.storageProvider,
      storage_bucket: asset.storageBucket,
      storage_key: asset.storageKey
    });
    actualSize = body.byteLength;
    exists = true;
    validation = validateArtifactBuffer({
      body,
      file_ext: asset.fileExt,
      mime_type: asset.mimeType
    });
  } catch {
    // Reported as missing below without leaking filesystem paths.
  }
  const dbSize = Number(asset.sizeBytes ?? 0);
  const placeholder = dbSize <= 512 || (actualSize !== null && actualSize <= 512);
  return {
    artifact_type: asset.deliverableType?.code ?? asset.deliverableTypeId,
    asset_id_hash: hash(asset.id),
    db_status: asset.status,
    storage_key_masked: maskStorageKey(asset.storageKey),
    db_file_size: dbSize,
    actual_file_size: actualSize,
    mime_type: asset.mimeType,
    placeholder,
    signature_valid: validation.signature_valid,
    format_valid: validation.format_valid,
    pdf_header_valid: validation.pdf_header_valid ?? null,
    png_header_valid: validation.png_header_valid ?? null,
    zip_header_valid: validation.zip_header_valid ?? null,
    zip_test_passed: validation.zip_test_passed ?? null,
    downloadable: asset.status === "available" && exists && !placeholder && validation.valid
  };
}

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { generationManifests: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (!order) throw new Error("order_not_found");
  const manifest = order.generationManifests[0];
  if (!manifest) throw new Error("generation_manifest_missing");

  const repository = new PrismaOrchestrationRepository(prisma);
  await runManifestDrivenGeneration({
    manifest_id: manifest.id,
    repository,
    now: new Date()
  });

  const refreshed = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      assets: { include: { deliverableType: true }, orderBy: { createdAt: "asc" } },
      downloadTokens: { include: { downloadTokenAssets: true }, orderBy: { createdAt: "desc" } }
    }
  });
  const artifacts = [];
  for (const asset of refreshed.assets) artifacts.push(await inspectAsset(asset));
  const downloadableCount = artifacts.filter((asset) => asset.downloadable).length;
  const placeholderCount = artifacts.filter((asset) => asset.placeholder).length;
  const output = {
    ok: true,
    order_number: refreshed.orderNumber,
    payment_status: refreshed.paymentStatus,
    fulfillment_status: refreshed.fulfillmentStatus,
    active_download_tokens: refreshed.downloadTokens.filter((token) => token.status === "active").length,
    latest_token_linked_assets: refreshed.downloadTokens[0]?.downloadTokenAssets?.length ?? 0,
    artifacts_count: artifacts.length,
    downloadable_count: downloadableCount,
    placeholder_count: placeholderCount,
    artifacts
  };
  console.log(JSON.stringify(output, null, 2));

  if (artifacts.length < 8 || downloadableCount < 8 || placeholderCount > 0) {
    console.error(JSON.stringify({
      ok: false,
      reason: "artifact_repair_did_not_produce_downloadable_files",
      artifacts_count: artifacts.length,
      downloadable_count: downloadableCount,
      placeholder_count: placeholderCount
    }, null, 2));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
NODE
