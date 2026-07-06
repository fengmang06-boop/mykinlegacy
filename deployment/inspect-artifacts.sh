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
const { LocalPrivateStorageAdapter, validateArtifactBuffer } = workerRequire("@ai-heritage/storage");

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
  let validation = { valid: false, signature_valid: false, format_valid: false };
  let contentQuality = contentQualityForBuffer(Buffer.alloc(0), asset.fileExt);
  try {
    const body = await storage.getObject({
      storage_provider: asset.storageProvider,
      storage_bucket: asset.storageBucket,
      storage_key: asset.storageKey
    });
    actualSize = body.byteLength;
    fileExists = true;
    validation = validateArtifactBuffer({
      body,
      file_ext: asset.fileExt,
      mime_type: asset.mimeType
    });
    contentQuality = contentQualityForBuffer(body, asset.fileExt);
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
    signature_valid: validation.signature_valid,
    format_valid: validation.format_valid,
    pdf_header_valid: validation.pdf_header_valid ?? null,
    png_header_valid: validation.png_header_valid ?? null,
    zip_header_valid: validation.zip_header_valid ?? null,
    zip_test_passed: validation.zip_test_passed ?? null,
    has_unknown_label: contentQuality.has_unknown_label,
    repeated_symbol_blocks: contentQuality.repeated_symbol_blocks,
    raw_json_detected: contentQuality.raw_json_detected,
    boundary_statement_present: contentQuality.boundary_statement_present,
    pdf_layout_version: contentQuality.pdf_layout_version,
    png_prompt_source: contentQuality.png_prompt_source,
    png_pve_score: contentQuality.png_pve_score,
    png_pve_passed: contentQuality.png_pve_passed,
    png_lre_prompt_hash_present: contentQuality.png_lre_prompt_hash_present,
    png_selected_prompt_contains_lre: contentQuality.png_selected_prompt_contains_lre,
    content_quality_status: contentQuality.status,
    downloadable: asset.status === "available" && fileExists && !placeholder && validation.valid && contentQuality.status !== "failed",
    storage_error: storageError
  };
}

function contentQualityForBuffer(body, fileExt) {
  if (!body || body.byteLength === 0) {
    return {
      has_unknown_label: false,
      repeated_symbol_blocks: false,
      raw_json_detected: false,
      boundary_statement_present: false,
      pdf_layout_version: null,
      png_prompt_source: null,
      png_pve_score: null,
      png_pve_passed: null,
      png_lre_prompt_hash_present: false,
      png_selected_prompt_contains_lre: false,
      status: "not_checked"
    };
  }
  const text = body.toString("latin1");
  const promptMetadata = parsePngPromptMetadata(text, fileExt);
  const hasUnknown = /\b(House of Unknown|Unknown|null|undefined)\b/i.test(text);
  const rawJson = /[{[]\s*"[^"]+"\s*:/s.test(text) || /request_id|correlation_id|success|data/i.test(text);
  const boundary = /personalized symbolic keepsake/i.test(text);
  const repeatedSymbols = (text.match(/Shield[:\n]/gi) ?? []).length > 1 ||
    (text.match(/Tree[:\n]/gi) ?? []).length > 1 ||
    (text.match(/Knot[:\n]/gi) ?? []).length > 1;
  const layoutVersion = fileExt === "pdf" && /Legacy, Designed\.|Archive Reference|Prepared for:/i.test(text)
    ? "premium_v1"
    : fileExt === "pdf"
      ? "legacy_or_unknown"
      : null;
  const failed = hasUnknown || rawJson || (fileExt === "pdf" && (!boundary || repeatedSymbols || layoutVersion !== "premium_v1"));
  return {
    has_unknown_label: hasUnknown,
    repeated_symbol_blocks: repeatedSymbols,
    raw_json_detected: rawJson,
    boundary_statement_present: boundary,
    pdf_layout_version: layoutVersion,
    ...promptMetadata,
    status: failed ? "failed" : "passed"
  };
}

function parsePngPromptMetadata(text, fileExt) {
  if (fileExt !== "png") {
    return {
      png_prompt_source: null,
      png_pve_score: null,
      png_pve_passed: null,
      png_lre_prompt_hash_present: false,
      png_selected_prompt_contains_lre: false
    };
  }
  const promptSource = text.match(/prompt_source=([^;]+)/)?.[1] ?? null;
  const pveScoreRaw = text.match(/pve_score=([^;]+)/)?.[1] ?? null;
  return {
    png_prompt_source: promptSource,
    png_pve_score: pveScoreRaw && /^\d+$/.test(pveScoreRaw) ? Number(pveScoreRaw) : null,
    png_pve_passed: text.includes("pve_passed=true"),
    png_lre_prompt_hash_present: /lre_prompt_sha256=[a-f0-9]{64}/.test(text),
    png_selected_prompt_contains_lre: /selected_prompt=LRE Prompt Builder:/i.test(text)
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
