#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/founder-final-order-verification.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy Founder final order verification"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "No raw email, raw vault token, storage key, signed URL, or secrets are printed."
echo

echo "===== SAFE ARTIFACT INSPECTION ====="
bash "$SCRIPT_DIR/inspect-artifacts.sh" "$ORDER_NUMBER" || true
echo
echo "===== SAFE DELIVERY STATE INSPECTION ====="
bash "$SCRIPT_DIR/inspect-delivery-state.sh" "$ORDER_NUMBER" || true
echo
if [ -f "$SCRIPT_DIR/inspect-email-delivery.sh" ]; then
  echo "===== SAFE EMAIL DELIVERY INSPECTION ====="
  bash "$SCRIPT_DIR/inspect-email-delivery.sh" "$ORDER_NUMBER" || true
  echo
fi
echo "===== DOWNLOAD BINARY VERIFICATION ====="
bash "$SCRIPT_DIR/verify-download-binaries.sh" "$ORDER_NUMBER" || true
echo
echo "===== FINAL VERDICT ====="

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash, randomBytes } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const { PrismaClient } = require("./packages/database/generated/client");

const workerRequire = createRequire(path.join(process.cwd(), "apps/worker/package.json"));
const { LocalPrivateStorageAdapter, validateArtifactBuffer } = workerRequire("@ai-heritage/storage");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();
const storage = new LocalPrivateStorageAdapter();

function id() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let output = "";
  for (let index = 0; index < 26; index += 1) {
    output += alphabet[(bytes[index % bytes.length] ?? 0) % alphabet.length] ?? "0";
  }
  return output;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return sha256(value).slice(0, 16);
}

function contentQualityForBuffer(body, fileExt) {
  if (!body || body.byteLength === 0) {
    return { status: "not_checked" };
  }
  const text = body.toString("latin1");
  const hasUnknown = /\b(House of Unknown|Unknown|null|undefined)\b/i.test(text);
  const rawJson = /[{[]\s*"[^"]+"\s*:/s.test(text) || /request_id|correlation_id|success|data/i.test(text);
  const boundary = /personalized symbolic keepsake/i.test(text);
  const repeatedSymbols =
    (text.match(/Shield[:\n]/gi) ?? []).length > 1 ||
    (text.match(/Tree[:\n]/gi) ?? []).length > 1 ||
    (text.match(/Knot[:\n]/gi) ?? []).length > 1;
  const premiumPdf = fileExt !== "pdf" || /Legacy, Designed\.|Archive Reference|Prepared for:/i.test(text);
  return {
    status: hasUnknown || rawJson || (fileExt === "pdf" && (!boundary || repeatedSymbols || !premiumPdf)) ? "failed" : "passed"
  };
}

function minimumBytes(fileExt) {
  if (fileExt === "zip") return 20 * 1024;
  if (fileExt === "png" || fileExt === "pdf") return 10 * 1024;
  return 1024;
}

async function createDiagnosticToken(order, assets) {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const token = await prisma.downloadToken.create({
    data: {
      id: id(),
      orderId: order.id,
      tokenHash: sha256(rawToken),
      status: "active",
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      maxDownloads: 50,
      downloadCount: 0,
      createdBy: "system",
      createdAt: now,
      revokedAt: null
    }
  });
  await prisma.downloadTokenAsset.createMany({
    data: assets.map((asset) => ({
      id: id(),
      downloadTokenId: token.id,
      assetId: asset.id,
      createdAt: now
    })),
    skipDuplicates: true
  });
  return rawToken;
}

async function verifyDownloadRoute(rawToken, asset) {
  try {
    const response = await fetch(`http://api:4000/api/v1/downloads/${encodeURIComponent(rawToken)}/assets/${encodeURIComponent(asset.id)}/file`);
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const contentDisposition = response.headers.get("content-disposition") ?? "";
    const binaryValidation = validateArtifactBuffer({
      body,
      file_ext: asset.fileExt,
      mime_type: asset.mimeType
    });
    const trimmedPreview = body.subarray(0, 200).toString("utf8").replace(/[^\x20-\x7E]+/g, " ").trimStart();
    const bodyLooksJson =
      trimmedPreview.startsWith("{") ||
      trimmedPreview.startsWith("[") ||
      trimmedPreview.startsWith("{\"request_id\"") ||
      trimmedPreview.startsWith("{\"type\":\"Buffer\"");
    const binaryTypeHasCharset =
      /^(application\/pdf|application\/zip|image\/png)\b/i.test(contentType) &&
      /charset=/i.test(contentType);
    return {
      http_status: response.status,
      content_type: contentType,
      content_disposition: contentDisposition ? "present" : "missing",
      body_size: body.byteLength,
      signature_valid: binaryValidation.signature_valid,
      format_valid: binaryValidation.format_valid,
      valid:
        response.ok &&
        binaryValidation.valid &&
        contentType.toLowerCase() === String(asset.mimeType).toLowerCase() &&
        !binaryTypeHasCharset &&
        !bodyLooksJson,
      errors: [
        ...(binaryValidation.errors ?? []),
        ...(binaryTypeHasCharset ? ["binary_content_type_has_charset"] : []),
        ...(bodyLooksJson ? ["binary_route_returned_json_body"] : [])
      ]
    };
  } catch (error) {
    return {
      http_status: null,
      content_type: null,
      content_disposition: "missing",
      body_size: 0,
      signature_valid: false,
      format_valid: false,
      valid: false,
      errors: [error instanceof Error ? error.message : "download_route_failed"]
    };
  }
}

async function inspectAsset(asset, rawToken) {
  let exists = false;
  let body = Buffer.alloc(0);
  try {
    body = await storage.getObject({
      storage_provider: asset.storageProvider,
      storage_bucket: asset.storageBucket,
      storage_key: asset.storageKey
    });
    exists = true;
  } catch {
    exists = false;
  }
  const validation = exists
    ? validateArtifactBuffer({ body, file_ext: asset.fileExt, mime_type: asset.mimeType })
    : { valid: false, errors: ["storage_missing"] };
  const quality = exists ? contentQualityForBuffer(body, asset.fileExt) : { status: "not_checked" };
  const requiredBytes = minimumBytes(asset.fileExt);
  const dbSize = Number(asset.sizeBytes ?? 0);
  const placeholder = !exists || dbSize < requiredBytes || body.byteLength < requiredBytes;
  const downloadRoute = await verifyDownloadRoute(rawToken, asset);
  const binaryVerified = exists && !placeholder && validation.valid;
  const countedDownloadable = binaryVerified && downloadRoute.valid;
  return {
    artifact_type: asset.deliverableType?.code ?? asset.deliverableTypeId,
    asset_id_hash: shortHash(asset.id),
    file_ext: asset.fileExt,
    status: asset.status,
    download_status: asset.downloadStatus ?? null,
    availability: asset.availability ?? null,
    has_download_url: false,
    mime_type: asset.mimeType,
    db_file_size: dbSize,
    actual_file_size: body.byteLength,
    required_min_bytes: requiredBytes,
    exists,
    placeholder,
    binary_validation_result: validation.valid,
    binary_validation_errors: validation.errors ?? [],
    quality_status: quality.status,
    download_route_valid: downloadRoute.valid,
    download_route_status: downloadRoute.http_status,
    download_route_content_type: downloadRoute.content_type,
    download_route_errors: downloadRoute.errors,
    counted_downloadable: countedDownloadable,
    downloadable: countedDownloadable,
    pdf_valid: asset.fileExt === "pdf" ? validation.valid : null,
    zip_valid: asset.fileExt === "zip" ? validation.valid : null,
    png_valid: asset.fileExt === "png" ? validation.valid : null
  };
}

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      assets: { include: { deliverableType: true }, orderBy: { createdAt: "asc" } },
      downloadTokens: { include: { downloadTokenAssets: true }, orderBy: { createdAt: "desc" } },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });

  if (!order) {
    console.log(JSON.stringify({ verdict: "FAIL", failed_checks: ["order_not_found"] }, null, 2));
    process.exitCode = 1;
    return;
  }

  const inspected = [];
  const rawDiagnosticToken = await createDiagnosticToken(order, order.assets);
  for (const asset of order.assets) {
    inspected.push(await inspectAsset(asset, rawDiagnosticToken));
  }

  const activeToken = order.downloadTokens.find((token) => token.status === "active");
  const latestEmail = order.emailLogs[0] ?? null;
  const assetsCount = inspected.length;
  const downloadableCount = inspected.filter((asset) => asset.downloadable).length;
  const placeholderCount = inspected.filter((asset) => asset.placeholder).length;
  const pdfValid = inspected.filter((asset) => asset.file_ext === "pdf").every((asset) => asset.pdf_valid === true);
  const zipValid = inspected.filter((asset) => asset.file_ext === "zip").every((asset) => asset.zip_valid === true);
  const pngValid = inspected.filter((asset) => asset.file_ext === "png").every((asset) => asset.png_valid === true);
  const vaultReady = Boolean(activeToken && activeToken.downloadTokenAssets.length >= 8);
  const emailSent = latestEmail?.status === "sent";
  const customerDeliveryStatus = vaultReady && emailSent ? "vault_ready" : vaultReady ? "email_delivery_attention" : "not_ready";
  const contradictoryState = order.paymentStatus === "paid" && vaultReady && customerDeliveryStatus === "not_ready" ? "yes" : "no";
  const emailStatusAcceptable = emailSent || customerDeliveryStatus === "email_delivery_attention";

  const failedChecks = [];
  if (assetsCount !== 8) failedChecks.push(`assets_count_expected_8_actual_${assetsCount}`);
  if (downloadableCount !== 8) failedChecks.push(`downloadable_count_expected_8_actual_${downloadableCount}`);
  if (placeholderCount !== 0) failedChecks.push(`placeholder_count_expected_0_actual_${placeholderCount}`);
  if (!pdfValid) failedChecks.push("pdf_invalid");
  if (!zipValid) failedChecks.push("zip_invalid");
  if (!pngValid) failedChecks.push("png_invalid");
  if (!["vault_ready", "email_delivery_attention"].includes(customerDeliveryStatus)) {
    failedChecks.push(`customer_delivery_status_${customerDeliveryStatus}`);
  }
  if (contradictoryState !== "no") failedChecks.push("contradictory_state");
  if (!emailStatusAcceptable) failedChecks.push("email_status_not_sent_or_attention");

  const result = {
    verdict: failedChecks.length === 0 ? "PASS" : "FAIL",
    order_number: order.orderNumber,
    payment_status: order.paymentStatus,
    internal_fulfillment_status: order.fulfillmentStatus,
    customer_delivery_status: customerDeliveryStatus,
    vault_ready: vaultReady,
    assets_count: assetsCount,
    downloadable_count: downloadableCount,
    placeholder_count: placeholderCount,
    pdf_valid: pdfValid,
    zip_valid: zipValid,
    png_valid: pngValid,
    contradictory_state: contradictoryState,
    latest_email_status: latestEmail?.status ?? "missing",
    latest_email_provider: latestEmail?.provider ?? "missing",
    artifact_downloadability_debug: inspected.map((asset) => ({
      artifact_type: asset.artifact_type,
      asset_id_hash: asset.asset_id_hash,
      status: asset.status,
      download_status: asset.download_status,
      availability: asset.availability,
      has_download_url: asset.has_download_url ? "yes" : "no",
      mime_type: asset.mime_type,
      db_file_size: asset.db_file_size,
      actual_file_size: asset.actual_file_size,
      placeholder: asset.placeholder ? "yes" : "no",
      binary_validation_result: asset.binary_validation_result ? "passed" : "failed",
      download_route_valid: asset.download_route_valid ? "yes" : "no",
      download_route_status: asset.download_route_status,
      download_route_content_type: asset.download_route_content_type,
      counted_downloadable: asset.counted_downloadable ? "yes" : "no",
      validation_errors: [...asset.binary_validation_errors, ...asset.download_route_errors]
    })),
    failed_checks: failedChecks
  };
  console.log(JSON.stringify(result, null, 2));
  if (failedChecks.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ verdict: "FAIL", reason: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
NODE
