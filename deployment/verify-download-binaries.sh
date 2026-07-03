#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [ -z "$ORDER_NUMBER" ]; then
  echo "Usage: bash deployment/verify-download-binaries.sh <ORDER_NUMBER>"
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

echo "MyKinLegacy customer download binary verification"
echo "Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Order: $ORDER_NUMBER"
echo "A temporary diagnostic vault token is created but never printed."
echo "No raw vault token, customer email, storage key, or secrets are printed."
echo

compose exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { createHash, randomBytes } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const { PrismaClient } = require("./packages/database/generated/client");

const workerRequire = createRequire(path.join(process.cwd(), "apps/worker/package.json"));
const { validateArtifactBuffer } = workerRequire("@ai-heritage/storage");

const orderNumber = process.argv[2];
const prisma = new PrismaClient();

function id() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let output = "";
  for (let index = 0; index < 26; index += 1) {
    output += alphabet[(bytes[index % bytes.length] ?? 0) % alphabet.length] ?? "0";
  }
  return output;
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return hash(value).slice(0, 16);
}

async function createDiagnosticToken(order, assets) {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const token = await prisma.downloadToken.create({
    data: {
      id: id(),
      orderId: order.id,
      tokenHash: hash(rawToken),
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

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      assets: { include: { deliverableType: true }, orderBy: { createdAt: "asc" } }
    }
  });

  if (!order) {
    console.log(JSON.stringify({ ok: false, reason: "order_not_found" }, null, 2));
    process.exitCode = 1;
    return;
  }

  const assets = order.assets.filter((asset) => asset.status === "available");
  const rawToken = await createDiagnosticToken(order, assets);
  const results = [];

  for (const asset of assets) {
    const response = await fetch(`http://api:4000/api/v1/downloads/${encodeURIComponent(rawToken)}/assets/${encodeURIComponent(asset.id)}/file`);
    const body = Buffer.from(await response.arrayBuffer());
    const validation = validateArtifactBuffer({
      body,
      file_ext: asset.fileExt,
      mime_type: asset.mimeType
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentDisposition = response.headers.get("content-disposition") ?? "";
    const contentEncoding = response.headers.get("content-encoding") ?? "";
    const textPreview = body.subarray(0, 200).toString("utf8").replace(/[^\x20-\x7E]+/g, " ").trim();
    const trimmedPreview = textPreview.trimStart();
    const bodyLooksJson =
      trimmedPreview.startsWith("{") ||
      trimmedPreview.startsWith("[") ||
      trimmedPreview.startsWith("{\"request_id\"") ||
      trimmedPreview.startsWith("{\"type\":\"Buffer\"");
    const binaryTypeHasCharset =
      /^(application\/pdf|application\/zip|image\/png)\b/i.test(contentType) &&
      /charset=/i.test(contentType);
    const bodyLooksText =
      body.byteLength > 0 &&
      body.subarray(0, Math.min(body.byteLength, 32)).every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126));
    const responseWarnings = [];
    if (binaryTypeHasCharset) responseWarnings.push("binary_content_type_has_charset");
    if (bodyLooksJson) responseWarnings.push("binary_route_returned_json_body");
    if (bodyLooksText && !validation.valid) responseWarnings.push("binary_route_returned_text_body");
    results.push({
      asset_id_hash: shortHash(asset.id),
      deliverable_code: asset.deliverableType?.code ?? asset.deliverableTypeId,
      http_status: response.status,
      content_type: contentType,
      content_disposition: contentDisposition ? "present" : "missing",
      content_encoding: contentEncoding || null,
      content_length: response.headers.get("content-length"),
      body_size: body.byteLength,
      first_bytes_hex: body.subarray(0, 8).toString("hex"),
      first_200_bytes_text_preview: validation.valid ? null : textPreview.slice(0, 200),
      body_looks_json: bodyLooksJson,
      body_looks_text: bodyLooksText,
      binary_type_has_charset: binaryTypeHasCharset,
      expected_mime_type: asset.mimeType,
      signature_valid: validation.signature_valid,
      format_valid: validation.format_valid,
      valid:
        response.ok &&
        validation.valid &&
        contentType.toLowerCase() === String(asset.mimeType).toLowerCase() &&
        !binaryTypeHasCharset &&
        !bodyLooksJson,
      pdf_header_valid: validation.pdf_header_valid ?? null,
      png_header_valid: validation.png_header_valid ?? null,
      zip_header_valid: validation.zip_header_valid ?? null,
      zip_test_passed: validation.zip_test_passed ?? null,
      errors: [...validation.errors, ...responseWarnings]
    });
  }

  const failed = results.filter((result) => !result.valid);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    order_number: order.orderNumber,
    diagnostic_token_created: true,
    assets_checked: results.length,
    failed_count: failed.length,
    results
  }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
NODE
