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
LAST_SUCCESSFUL_IMAGE_FILE="$SCRIPT_DIR/.last-successful-image"

if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
  exec bash "$SCRIPT_DIR/with-production-lock.sh" "repair_order_artifacts:${ORDER_NUMBER}" bash "$0" "$@"
fi

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

if [ ! -f "$LAST_SUCCESSFUL_IMAGE_FILE" ]; then
  echo "FAIL deployment/.last-successful-image is missing"
  exit 1
fi

APP_IMAGE="$(tr -d '[:space:]' < "$LAST_SUCCESSFUL_IMAGE_FILE")"
if [ -z "$APP_IMAGE" ]; then
  echo "FAIL deployment/.last-successful-image is empty"
  exit 1
fi
export APP_IMAGE

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

APP_IMAGE_DIGEST="$($SUDO docker image inspect "$APP_IMAGE" --format '{{.Id}}' 2>/dev/null || true)"
if [ -z "$APP_IMAGE_DIGEST" ]; then
  echo "FAIL deployed APP_IMAGE is not present locally: $APP_IMAGE"
  exit 1
fi

echo "MyKinLegacy artifact repair"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "This regenerates private PNG/PDF/ZIP artifact files for the order."
echo "APP_IMAGE=$APP_IMAGE"
echo "APP_IMAGE_DIGEST=$APP_IMAGE_DIGEST"
echo "No raw vault token, customer email, or secrets are printed."
echo

compose run --rm --no-deps worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { PrismaClient } = require("./packages/database/generated/client");

const workerRequire = createRequire(path.join(process.cwd(), "apps/worker/package.json"));
const { PrismaOrchestrationRepository, runManifestDrivenGeneration } = workerRequire("@ai-heritage/database");
const { LocalPrivateStorageAdapter, createMvpCrestPngBuffer, validateArtifactBuffer } = workerRequire("@ai-heritage/storage");

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
  let contentQuality = contentQualityForBuffer(Buffer.alloc(0), asset.fileExt);
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
    contentQuality = contentQualityForBuffer(body, asset.fileExt);
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
    image_provider: contentQuality.image_provider,
    image_model: contentQuality.image_model,
    image_generation_bridge: contentQuality.image_generation_bridge,
    fallback_used: contentQuality.fallback_used,
    content_quality_status: contentQuality.status,
    downloadable: asset.status === "available" && exists && !placeholder && validation.valid && contentQuality.status !== "failed"
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
      image_provider: null,
      image_model: null,
      image_generation_bridge: null,
      fallback_used: null,
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
  const layoutVersion = fileExt === "pdf" && /pdf_layout_version=premium_v5_frameable/i.test(text)
    ? "premium_v5_frameable"
    : fileExt === "pdf" && /Legacy, Designed\.|Archive Reference|Prepared for:/i.test(text)
      ? "premium_v1"
    : fileExt === "pdf"
      ? "legacy_or_unknown"
      : null;
  const failed = hasUnknown || (fileExt === "pdf" && (repeatedSymbols || layoutVersion !== "premium_v5_frameable"));
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
    png_selected_prompt_contains_lre: /selected_prompt=LRE Prompt Builder:/i.test(text),
    image_provider: text.match(/image_provider=([^;]+)/)?.[1] ?? null,
    image_model: text.match(/image_model=([^;]+)/)?.[1] ?? null,
    image_generation_bridge: text.match(/image_generation_bridge=([^;]+)/)?.[1] ?? null,
    fallback_used: text.match(/fallback_used=([^;]+)/)?.[1] ?? null
  };
}

function assertContainerSupportsLrePromptBridge() {
  const databaseEntry = workerRequire.resolve("@ai-heritage/database");
  const pipelineCandidates = [
    path.join(path.dirname(databaseEntry), "orchestration/pipeline.js"),
    path.join(process.cwd(), "packages/database/dist/orchestration/pipeline.js")
  ];
  const pipelinePath = pipelineCandidates.find((candidate) => existsSync(candidate));
  const pipelineSource = pipelinePath ? readFileSync(pipelinePath, "utf8") : "";
  const report = {
    dbEntry: databaseEntry,
    pipelinePath,
    hasSelectPngPrompt: pipelineSource.includes("selectPngPrompt"),
    hasApplyAllowlistedLrePromptReplacement: pipelineSource.includes("applyAllowlistedLrePromptReplacement"),
    pngProbeHasPromptSource: false,
    pngProbeHasSelectedPrompt: false,
    pngProbeHasPveScore: false
  };
  if (!report.hasSelectPngPrompt || !report.hasApplyAllowlistedLrePromptReplacement) {
    console.log(JSON.stringify({ preflight: "lre_png_path", ...report }, null, 2));
    throw new Error("worker_image_missing_lre_manifest_png_path");
  }
  if (typeof createMvpCrestPngBuffer !== "function") {
    console.log(JSON.stringify({ preflight: "lre_png_path", ...report }, null, 2));
    throw new Error("worker_image_missing_png_generator");
  }
  const probe = createMvpCrestPngBuffer({
    variant: "lre_probe_png",
    house_name: "LRE Probe",
    symbols: ["lantern", "book"],
    prompt_metadata: {
      prompt_source: "lre_prompt",
      pve_score: 99,
      pve_passed: true,
      old_prompt_sha256: "0".repeat(64),
      lre_prompt_sha256: "1".repeat(64),
      selected_prompt: "LRE Prompt Builder: preflight prompt metadata probe. Primary composition: lantern.",
      negative_prompt: "no readable text",
      primary_symbol: "Lantern",
      secondary_symbols: ["Book"],
      selected_dna: ["embossed antique gold"]
    }
  }).toString("latin1");
  report.pngProbeHasPromptSource = probe.includes("prompt_source=lre_prompt");
  report.pngProbeHasSelectedPrompt = probe.includes("selected_prompt=LRE Prompt Builder:");
  report.pngProbeHasPveScore = probe.includes("pve_score=99");
  console.log(JSON.stringify({ preflight: "lre_png_path", ...report }, null, 2));
  if (!report.pngProbeHasPromptSource || !report.pngProbeHasSelectedPrompt || !report.pngProbeHasPveScore) {
    throw new Error("worker_image_missing_lre_png_metadata_support");
  }
}

async function main() {
  assertContainerSupportsLrePromptBridge();

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
  const expectedArtifactCount = Array.isArray(manifest.expectedAssetsJson)
    ? manifest.expectedAssetsJson.length
    : artifacts.length;
  const output = {
    ok: true,
    order_number: refreshed.orderNumber,
    payment_status: refreshed.paymentStatus,
    fulfillment_status: refreshed.fulfillmentStatus,
    active_download_tokens: refreshed.downloadTokens.filter((token) => token.status === "active").length,
    latest_token_linked_assets: refreshed.downloadTokens[0]?.downloadTokenAssets?.length ?? 0,
    artifacts_count: artifacts.length,
    expected_artifacts_count: expectedArtifactCount,
    downloadable_count: downloadableCount,
    placeholder_count: placeholderCount,
    artifacts
  };
  console.log(JSON.stringify(output, null, 2));

  if (artifacts.length < expectedArtifactCount || downloadableCount < expectedArtifactCount || placeholderCount > 0) {
    console.error(JSON.stringify({
      ok: false,
      reason: "artifact_repair_did_not_produce_downloadable_files",
      artifacts_count: artifacts.length,
      expected_artifacts_count: expectedArtifactCount,
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
