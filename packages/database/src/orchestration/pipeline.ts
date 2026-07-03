import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

import { ulid } from "ulid";

import type {
  ExpectedAssetContract,
  OrchestrationAsset,
  OrchestrationManifest,
  OrchestrationOutboxEvent,
  OrchestrationOrder,
  OrchestrationOrderItem,
  OrchestrationRepository
} from "./types";

export const REQUIRED_DELIVERABLES = [
  "crest_variant_1_png",
  "crest_variant_2_png",
  "crest_variant_3_png",
  "transparent_crest_png",
  "symbol_explanation_pdf",
  "heritage_certificate_pdf",
  "family_story_pdf",
  "download_package_zip"
] as const;

const MIN_CUSTOMER_ARTIFACT_BYTES = 10 * 1024;
const ARTIFACT_BUCKET = "private-assets";
const ARTIFACT_BOUNDARY_STATEMENT =
  "This is a personalized symbolic keepsake. It is not a legal heraldic grant, noble title claim, or certified genealogical record.";

export async function processOrderPaidOutbox(input: {
  outboxEvent: OrchestrationOutboxEvent;
  repository: OrchestrationRepository;
  now?: Date;
}): Promise<{ manifest: OrchestrationManifest; generation_job_id: string; created: boolean }> {
  if (input.outboxEvent.event_type !== "order.paid") {
    throw new Error("unsupported_outbox_event");
  }

  const payload = input.outboxEvent.payload_json;
  const orderId = stringField(payload.order_id);
  const orderItemId = stringField(payload.order_item_id);
  const order = await input.repository.findOrder(orderId);
  const orderItem = await input.repository.findOrderItem(orderItemId);
  if (!order || !orderItem) throw new Error("order_or_item_not_found");

  const existingManifest = await input.repository.findManifestByOrderItem(orderId, orderItemId);
  const existingJob = await input.repository.findGenerationJobByOrderItem(orderId, orderItemId);
  if (existingManifest && existingJob) {
    await input.repository.markOutboxPublished(input.outboxEvent.id, iso(input.now));
    return { manifest: existingManifest, generation_job_id: existingJob.id, created: false };
  }

  const timestamp = iso(input.now);
  const job =
    existingJob ??
    (await input.repository.createGenerationJob({
      id: ulid(),
      order_id: order.id,
      order_item_id: orderItem.id,
      product_id: orderItem.product_id,
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      created_at: timestamp,
      updated_at: timestamp
    }));
  const manifest =
    existingManifest ??
    (await input.repository.createManifest({
      id: ulid(),
      order_id: order.id,
      order_item_id: orderItem.id,
      generation_job_id: job.id,
      house_id: stringOrNull(payload.house_id),
      identity_version_id: stringOrNull(payload.identity_version_id),
      product_code: orderItem.product_code,
      package_code: orderItem.package_code,
      expected_assets: createExpectedAssets(),
      generated_assets: [],
      missing_required_assets: [...REQUIRED_DELIVERABLES],
      optional_assets: [
        createMeaningAttachment(meaningInputFromOrder({ order, orderItem, payload }), input.now ?? new Date())
      ],
      failed_assets: [],
      manifest_status: "pending",
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: null
    }));

  await input.repository.updateOrderStatus({
    order_id: order.id,
    order_status: order.payment_status === "paid" ? "processing" : order.order_status,
    fulfillment_status: "queued"
  });
  await input.repository.markOutboxPublished(input.outboxEvent.id, timestamp);
  return { manifest, generation_job_id: job.id, created: true };
}

export async function runManifestDrivenGeneration(input: {
  manifest_id: string;
  repository: OrchestrationRepository;
  now?: Date;
}): Promise<{
  manifest: OrchestrationManifest;
  assets: OrchestrationAsset[];
  download_token_id: string;
  raw_token_for_email_only: string;
}> {
  const manifest = await findManifest(input.repository, input.manifest_id);
  const order = await input.repository.findOrder(manifest.order_id);
  if (!order) throw new Error("order_not_found");
  const timestamp = iso(input.now);
  let current = await input.repository.updateManifest({
    ...manifest,
    manifest_status: "in_progress",
    updated_at: timestamp
  });
  await input.repository.updateOrderStatus({
    order_id: manifest.order_id,
    order_status: order.payment_status === "paid" ? "processing" : order.order_status,
    fulfillment_status: "generating"
  });

  const createdAssets: OrchestrationAsset[] = [];
  const tools = loadArtifactTooling();
  const storage = new tools.LocalPrivateStorageAdapter();
  const artifactContext = createArtifactContext({ manifest: current, order });
  const generatedBodies = new Map<string, ArtifactBody>();
  for (const deliverable of REQUIRED_DELIVERABLES.filter((code) => code !== "download_package_zip")) {
    const materialized = await createMaterializedAsset({
      manifest: current,
      deliverable_code: deliverable,
      context: artifactContext,
      storage,
      generatedBodies,
      now: input.now
    });
    const asset = await input.repository.createAsset(materialized.asset);
    generatedBodies.set(deliverable, materialized.body);
    createdAssets.push(asset);
    current = await markManifestAssetGenerated(input.repository, current, asset.id, deliverable, input.now);
  }

  const nonZipMissing = current.missing_required_assets.filter((code) => code !== "download_package_zip");
  if (nonZipMissing.length > 0) throw new Error("zip_required_asset_missing");
  const zipMaterialized = await createMaterializedAsset({
    manifest: current,
    deliverable_code: "download_package_zip",
    context: artifactContext,
    storage,
    generatedBodies,
    now: input.now
  });
  const zipAsset = await input.repository.createAsset(zipMaterialized.asset);
  generatedBodies.set("download_package_zip", zipMaterialized.body);
  createdAssets.push(zipAsset);
  current = await markManifestAssetGenerated(input.repository, current, zipAsset.id, "download_package_zip", input.now);
  current = await completeManifestIfReady(input.repository, current, input.now);
  const completion = await completeOrderDelivery({
    repository: input.repository,
    manifest: current,
    now: input.now
  });
  const job = await input.repository.findGenerationJobByOrderItem(current.order_id, current.order_item_id);
  if (job) {
    await input.repository.updateGenerationJob({
      ...job,
      status: "completed",
      updated_at: timestamp
    });
  }
  return {
    manifest: current,
    assets: createdAssets,
    download_token_id: completion.download_token_id,
    raw_token_for_email_only: completion.raw_token_for_email_only
  };
}

export async function completeOrderDelivery(input: {
  repository: OrchestrationRepository;
  manifest: OrchestrationManifest;
  now?: Date;
}): Promise<{ download_token_id: string; raw_token_for_email_only: string }> {
  if (input.manifest.manifest_status !== "completed") throw new Error("manifest_not_completed");
  const order = await input.repository.findOrder(input.manifest.order_id);
  if (!order) throw new Error("order_not_found");
  const assets = await input.repository.listAssetsByOrder(order.id);
  const requiredAssets = assets.filter((asset) =>
    REQUIRED_DELIVERABLES.includes(asset.deliverable_code as never)
  );
  if (requiredAssets.length < REQUIRED_DELIVERABLES.length) throw new Error("required_assets_missing");
  const rawToken = randomBytes(32).toString("base64url");
  const token = await input.repository.createDownloadToken({
    id: ulid(),
    order_id: order.id,
    token_hash: sha256(rawToken),
    status: "active",
    expires_at: new Date((input.now ?? new Date()).getTime() + 30 * 24 * 60 * 60_000).toISOString(),
    max_downloads: 20,
    download_count: 0,
    asset_ids: requiredAssets.map((asset) => asset.id),
    created_at: iso(input.now)
  });
  return { download_token_id: token.id, raw_token_for_email_only: rawToken };
}

export async function getOrderGenerationSummary(input: {
  order_id: string;
  repository: OrchestrationRepository;
}) {
  const order = await input.repository.findOrder(input.order_id);
  if (!order) throw new Error("order_not_found");
  const orderItems = await findOrderItems(input.repository, order.id);
  const manifest = orderItems[0]
    ? await input.repository.findManifestByOrderItem(order.id, orderItems[0].id)
    : null;
  const token = await input.repository.findDownloadTokenByOrder(order.id);
  return {
    order_number: order.order_number,
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    generation_manifest: manifest
      ? {
          manifest_id: manifest.id,
          manifest_status: manifest.manifest_status,
          expected_assets_count: manifest.expected_assets.length,
          generated_assets_count: manifest.generated_assets.length,
          failed_assets_count: manifest.failed_assets.length,
          meaning_profile: meaningProfileSummary(manifest),
          collection_content: collectionContentSummary(manifest)
        }
      : null,
    download_ready: Boolean(token && manifest?.manifest_status === "completed"),
    download_vault_available: Boolean(token),
    friendly_progress_status: friendlyProgress(order.fulfillment_status)
  };
}

export async function getAdminDbVisibilitySummary(input: {
  order_id: string;
  repository: OrchestrationRepository;
}) {
  const order = await input.repository.findOrder(input.order_id);
  if (!order) throw new Error("order_not_found");
  const orderItems = await findOrderItems(input.repository, order.id);
  const manifest = orderItems[0]
    ? await input.repository.findManifestByOrderItem(order.id, orderItems[0].id)
    : null;
  const assets = await input.repository.listAssetsByOrder(order.id);
  const token = await input.repository.findDownloadTokenByOrder(order.id);
  const emailLogs = await input.repository.listEmailLogsByOrder(order.id);
  return {
    order: {
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.order_status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status
    },
    manifest: manifest
      ? {
          manifest_id: manifest.id,
          manifest_status: manifest.manifest_status,
          generated_assets: manifest.generated_assets,
          failed_assets: manifest.failed_assets,
          missing_required_assets: manifest.missing_required_assets,
          meaning_profile: meaningProfileSummary(manifest),
          collection_content: collectionContentSummary(manifest)
        }
      : null,
    assets: assets.map((asset) => ({
      asset_id: asset.id,
      deliverable_code: asset.deliverable_code,
      status: asset.status,
      public_url: asset.public_url,
      masked_storage_key: maskStorageKey(asset.storage_key)
    })),
    download_token: token
      ? {
          token_id: token.id,
          status: token.status,
          asset_count: token.asset_ids.length,
          token_hash_present: Boolean(token.token_hash)
        }
      : null,
    email_logs: emailLogs.map((log) => ({
      email_log_id: log.id,
      provider: log.provider,
      status: log.status,
      payload_json: log.payload_json
    }))
  };
}

export function createExpectedAssets(): ExpectedAssetContract[] {
  return REQUIRED_DELIVERABLES.map((deliverableCode) => ({
    deliverable_code: deliverableCode,
    asset_type: deliverableCode.endsWith("_pdf")
      ? "pdf"
      : deliverableCode.endsWith("_zip")
        ? "archive"
        : "image",
    format: deliverableCode.endsWith("_pdf") ? "pdf" : deliverableCode.endsWith("_zip") ? "zip" : "png",
    required: true,
    quantity: 1,
    output_requirements: {
      private_storage: true,
      server_side_text: !deliverableCode.includes("crest_variant")
    },
    validation_rules: {
      no_public_url: true,
      no_text_in_image: deliverableCode.includes("png")
    },
    retry_policy: { max_attempts: 3 }
  }));
}

async function markManifestAssetGenerated(
  repository: OrchestrationRepository,
  manifest: OrchestrationManifest,
  assetId: string,
  deliverableCode: string,
  now?: Date
): Promise<OrchestrationManifest> {
  const generated = manifest.generated_assets.some((asset) => asset.deliverable_code === deliverableCode)
    ? manifest.generated_assets
    : [...manifest.generated_assets, { deliverable_code: deliverableCode, asset_id: assetId }];
  const missing = manifest.expected_assets
    .filter((asset) => asset.required)
    .map((asset) => asset.deliverable_code)
    .filter((code) => !generated.some((asset) => asset.deliverable_code === code));
  return repository.updateManifest({
    ...manifest,
    generated_assets: generated,
    missing_required_assets: missing,
    manifest_status: missing.length === 0 ? "completed" : "in_progress",
    updated_at: iso(now),
    completed_at: missing.length === 0 ? iso(now) : null
  });
}

async function completeManifestIfReady(
  repository: OrchestrationRepository,
  manifest: OrchestrationManifest,
  now?: Date
): Promise<OrchestrationManifest> {
  if (manifest.missing_required_assets.length > 0 || manifest.failed_assets.length > 0) {
    return manifest;
  }
  return repository.updateManifest({
    ...manifest,
    manifest_status: "completed",
    updated_at: iso(now),
    completed_at: iso(now)
  });
}

async function findManifest(
  repository: OrchestrationRepository,
  manifestId: string
): Promise<OrchestrationManifest> {
  const manifest = await repository.findManifestById(manifestId);
  if (manifest) return manifest;
  throw new Error("manifest_not_found");
}

async function findOrderItems(repository: OrchestrationRepository, orderId?: string) {
  return repository.listOrderItemsByOrder(orderId);
}

interface ArtifactBody {
  body: Buffer;
  mime_type: string;
  file_ext: string;
  file_name: string;
  archive_path: string;
  source_text?: string;
}

interface StorageAdapter {
  putObject(input: {
    bucket: string;
    storage_key: string;
    content_type: string;
    body: Buffer;
    metadata: Record<string, string>;
    private: true;
  }): Promise<{
    storage_provider: string;
    storage_bucket: string;
    storage_key: string;
    size_bytes: number;
    checksum_sha256: string;
    mime_type: string;
  }>;
}

interface ArtifactTooling {
  LocalPrivateStorageAdapter: new () => StorageAdapter;
  buildSimplePdf(text: string): Buffer;
  buildZipBuffer(entries: Array<{ name: string; body: Buffer }>): Buffer;
  createMvpCrestPngBuffer(input: {
    variant: string;
    house_name?: string;
    symbols?: string[];
    transparent?: boolean;
  }): Buffer;
  generateReadme(input: {
    package_title: string;
    included_files: string[];
    support_note?: string;
    disclaimer: string;
  }): Promise<string>;
  listZipEntries(buffer: Buffer): string[];
  readPngMetadata(buffer: Buffer): { width: number; height: number; has_alpha: boolean };
}

interface ArtifactContext {
  order_number: string;
  house_name: string;
  motto: string | null;
  themes: Array<{ theme: string; evidence: string | null }>;
  symbols: Array<{
    symbol: string;
    meaning: string | null;
    rationale: string | null;
    why_chosen?: string | null;
    emotional_relevance?: string | null;
  }>;
  design_rationale: string[];
  story_direction: string | null;
  certificate_direction: string | null;
  collection_content: ReturnType<typeof serializeCollectionContent> | null;
}

async function createMaterializedAsset(input: {
  manifest: OrchestrationManifest;
  deliverable_code: string;
  context: ArtifactContext;
  storage: StorageAdapter;
  generatedBodies: Map<string, ArtifactBody>;
  now?: Date;
}): Promise<{ asset: OrchestrationAsset; body: ArtifactBody }> {
  const assetType = input.deliverable_code.endsWith("_pdf")
    ? "pdf"
    : input.deliverable_code.endsWith("_zip")
      ? "archive"
      : "image";
  const ext = assetType === "pdf" ? "pdf" : assetType === "archive" ? "zip" : "png";
  const id = ulid();
  const storageKey = `orders/${input.manifest.order_id}/${input.manifest.order_item_id}/${input.deliverable_code}/${id}.${ext}`;
  const artifactBody = await createArtifactBody({
    deliverable_code: input.deliverable_code,
    context: input.context,
    generatedBodies: input.generatedBodies
  });
  if (artifactBody.file_ext !== ext) throw new Error(`artifact_extension_mismatch:${input.deliverable_code}`);
  assertArtifactReady(input.deliverable_code, artifactBody);
  const stored = await input.storage.putObject({
    bucket: ARTIFACT_BUCKET,
    storage_key: storageKey,
    content_type: artifactBody.mime_type,
    body: artifactBody.body,
    metadata: { deliverable_code: input.deliverable_code },
    private: true
  });

  return {
    body: artifactBody,
    asset: {
      id,
      order_id: input.manifest.order_id,
      order_item_id: input.manifest.order_item_id,
      generation_job_id: input.manifest.generation_job_id ?? "generation_job_missing",
      deliverable_code: input.deliverable_code,
      asset_type: assetType,
      asset_kind: assetType === "archive" ? "packaged" : "generated",
      status: "available",
      storage_provider: stored.storage_provider as "local_private",
      storage_bucket: stored.storage_bucket,
      storage_key: stored.storage_key,
      file_name: artifactBody.file_name,
      mime_type: stored.mime_type,
      file_ext: artifactBody.file_ext,
      size_bytes: stored.size_bytes,
      checksum_sha256: stored.checksum_sha256,
      public_url: null,
      created_at: iso(input.now)
    }
  };
}

async function createArtifactBody(input: {
  deliverable_code: string;
  context: ArtifactContext;
  generatedBodies: Map<string, ArtifactBody>;
}): Promise<ArtifactBody> {
  const tools = loadArtifactTooling();
  if (input.deliverable_code.endsWith("_png")) {
    const body = tools.createMvpCrestPngBuffer({
      variant: input.deliverable_code,
      house_name: input.context.house_name,
      symbols: input.context.symbols.map((symbol) => symbol.symbol).filter(Boolean),
      transparent: input.deliverable_code === "transparent_crest_png"
    });
    return {
      body,
      mime_type: "image/png",
      file_ext: "png",
      file_name: safeFileName(input.context.house_name, input.deliverable_code, "png"),
      archive_path: pngArchivePath(input.context.house_name, input.deliverable_code)
    };
  }

  if (input.deliverable_code.endsWith("_pdf")) {
    const sourceText = pdfTextForDeliverable(input.deliverable_code, input.context);
    assertContentQuality(input.deliverable_code, sourceText, input.context);
    const body = tools.buildSimplePdf(sourceText);
    return {
      body,
      mime_type: "application/pdf",
      file_ext: "pdf",
      file_name: safeFileName(input.context.house_name, input.deliverable_code, "pdf"),
      archive_path: `documents/${safeFileName(input.context.house_name, input.deliverable_code, "pdf")}`,
      source_text: sourceText
    };
  }

  if (input.deliverable_code === "download_package_zip") {
    const sourceEntries = REQUIRED_DELIVERABLES.filter((code) => code !== "download_package_zip").map((code) => {
      const artifact = input.generatedBodies.get(code);
      if (!artifact) throw new Error(`zip_required_asset_missing:${code}`);
      return { name: artifact.archive_path, body: artifact.body };
    });
    const readme = await tools.generateReadme({
      package_title: `${input.context.house_name} Private Legacy Collection`,
      included_files: sourceEntries.map((entry) => entry.name),
      support_note: "Contact support@mykinlegacy.com with your order number if you need help.",
      disclaimer: ARTIFACT_BOUNDARY_STATEMENT
    });
    const body = tools.buildZipBuffer([
      ...sourceEntries,
      {
        name: "read-me/read-me.txt",
        body: Buffer.from(readme)
      }
    ]);
    return {
      body,
      mime_type: "application/zip",
      file_ext: "zip",
      file_name: safeFileName(input.context.house_name, input.deliverable_code, "zip"),
      archive_path: safeFileName(input.context.house_name, input.deliverable_code, "zip")
    };
  }

  throw new Error(`unsupported_deliverable:${input.deliverable_code}`);
}

function assertArtifactReady(deliverableCode: string, artifact: ArtifactBody): void {
  const tools = loadArtifactTooling();
  if (artifact.file_ext === "png") {
    const metadata = tools.readPngMetadata(artifact.body);
    if (
      artifact.body.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      metadata.width < 256 ||
      metadata.height < 256 ||
      artifact.body.byteLength < MIN_CUSTOMER_ARTIFACT_BYTES
    ) {
      throw new Error(`artifact_not_ready:${deliverableCode}`);
    }
    return;
  }

  if (artifact.file_ext === "pdf") {
    const text = artifact.body.toString("latin1");
    const failures: string[] = [];
    if (artifact.body.subarray(0, 5).toString() !== "%PDF-") failures.push("pdf_header_invalid");
    if (artifact.body.byteLength < MIN_CUSTOMER_ARTIFACT_BYTES) failures.push(`pdf_too_small:${artifact.body.byteLength}`);
    if (!text.includes("%%EOF")) failures.push("pdf_eof_missing");
    if (!pdfStartXrefValid(artifact.body)) failures.push("pdf_xref_invalid");
    if (!text.includes("MyKinLegacy")) failures.push("brand_missing");
    if (!text.includes("personalized symbolic keepsake")) failures.push("boundary_missing");
    if (failures.length > 0) {
      throw new Error(`artifact_not_ready:${deliverableCode}:${failures.join(",")}`);
    }
    if (artifact.source_text) {
      assertContentQuality(deliverableCode, artifact.source_text);
    }
    return;
  }

  if (artifact.file_ext === "zip") {
    const entries = tools.listZipEntries(artifact.body);
    const requiredEntries = [
      "crest-artwork",
      "documents",
      "read-me/read-me.txt"
    ];
    if (
      artifact.body.subarray(0, 4).toString("hex") !== "504b0304" ||
      artifact.body.byteLength < 20 * 1024 ||
      !zipEndOfCentralDirectoryValid(artifact.body) ||
      !requiredEntries.every((entry) => entries.some((actual) => actual.startsWith(entry)))
    ) {
      throw new Error(`artifact_not_ready:${deliverableCode}`);
    }
  }
}

function pdfStartXrefValid(body: Buffer): boolean {
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/s.exec(body.toString("latin1"));
  if (!match) return false;
  const offset = Number(match[1]);
  return Number.isInteger(offset) && offset >= 0 && offset < body.byteLength && body.subarray(offset, offset + 4).toString("latin1") === "xref";
}

function zipEndOfCentralDirectoryValid(body: Buffer): boolean {
  const minimumOffset = Math.max(0, body.byteLength - 65557);
  for (let offset = body.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (offset >= 0 && body.readUInt32LE(offset) === 0x06054b50) return true;
  }
  return false;
}

function assertContentQuality(
  deliverableCode: string,
  sourceText: string,
  context?: Pick<ArtifactContext, "symbols">
): void {
  const failures = contentQualityFailures(sourceText, context);
  if (failures.length > 0) {
    throw new Error(`content_quality_failed:${deliverableCode}:${failures.join(",")}`);
  }
}

function contentQualityFailures(
  sourceText: string,
  context?: Pick<ArtifactContext, "symbols">
): string[] {
  const failures: string[] = [];
  if (/\bHouse of Unknown\b/i.test(sourceText) || /\bUnknown\b/i.test(sourceText)) failures.push("unknown_label");
  if (/\bundefined\b/i.test(sourceText)) failures.push("undefined_label");
  if (/\bnull\b/i.test(sourceText)) failures.push("null_label");
  if (/\b(Certificate Text|Meaning Themes|Archive Reflection|debug|raw json|placeholder)\b/i.test(sourceText)) {
    failures.push("debug_label");
  }
  if (/[{[]\s*"[^"]+"\s*:/s.test(sourceText)) failures.push("raw_json_detected");
  if (!sourceText.includes("personalized symbolic keepsake")) failures.push("boundary_statement_missing");
  if (sourceText.replace(/\s+/g, " ").trim().length < 900) failures.push("content_too_short");
  const headings = [...sourceText.matchAll(/^([A-Za-z][A-Za-z\s]+)$/gm)].map((match) => match[1]?.trim().toLowerCase());
  const duplicates = headings.filter((heading, index) => heading && headings.indexOf(heading) !== index);
  if (duplicates.length > 0) failures.push("repeated_sections");
  if (context) {
    const symbols = context.symbols.map((symbol) => symbol.symbol.toLowerCase());
    if (new Set(symbols).size !== symbols.length) failures.push("repeated_symbol_blocks");
  }
  return [...new Set(failures)];
}

function createArtifactContext(input: {
  manifest: OrchestrationManifest;
  order: OrchestrationOrder;
}): ArtifactContext {
  const attachment = meaningAttachment(input.manifest);
  const profile = recordObject(attachment, "meaning_profile");
  const content = collectionContentSummary(input.manifest);
  const customerInputs = recordObject(profile, "customer_inputs");
  const orderInput = input.order.order_inputs?.[0];
  const houseDna = firstRecord(
    recordObject(orderInput?.input_json, "house_dna"),
    orderInput?.normalized_input_json
  );
  const surname = stringOrNull(recordValue(houseDna, "surname")) ?? stringOrNull(recordValue(customerInputs, "surname"));
  const houseName = customerFacingFamilyName({
    house_name: stringOrNull(recordValue(houseDna, "house_name")) ?? stringOrNull(recordValue(customerInputs, "house_name")),
    surname,
    recipient: stringOrNull(recordValue(customerInputs, "recipient"))
  });
  const symbols = dedupeContextSymbols([
    ...(content?.symbol_guide ?? []).map((symbol) => ({
      symbol: symbol.symbol ?? "Symbol",
      meaning: symbol.meaning,
      rationale: symbol.why_chosen,
      why_chosen: symbol.why_chosen,
      emotional_relevance: symbol.emotional_relevance
    })),
    ...recordArray<Record<string, unknown>>(profile, "symbol_choices").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")) ?? "shield",
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      rationale: stringOrNull(recordValue(symbol, "rationale"))
    }))
  ]).slice(0, 5);

  return {
    order_number: input.order.order_number,
    house_name: houseName,
    motto: stringOrNull(recordValue(houseDna, "motto")),
    themes: recordArray<Record<string, unknown>>(profile, "meaning_themes").map((theme) => ({
      theme: stringOrNull(recordValue(theme, "theme")) ?? "family meaning",
      evidence: stringOrNull(recordValue(theme, "evidence"))
    })),
    symbols,
    design_rationale: stringArray(recordValue(profile, "design_rationale")),
    story_direction: stringOrNull(recordValue(profile, "story_direction")),
    certificate_direction: stringOrNull(recordValue(profile, "certificate_direction")),
    collection_content: content
  };
}

function pdfTextForDeliverable(deliverableCode: string, context: ArtifactContext): string {
  if (deliverableCode === "heritage_certificate_pdf") {
    return pdfDocumentText({
      title: "Heritage Certificate",
      subtitle: "A private symbolic keepsake prepared for family recognition and remembrance.",
      context,
      sections: [
        ["Presented for", context.house_name],
        ["Collection", `${context.house_name} Private Legacy Collection`],
        ["Meaning Statement", context.collection_content?.certificate_text ?? certificateFallback(context)],
        ["Symbolic Elements", symbolBulletText(context)],
        ["Archive Note", "Prepared as a private archival keepsake for personal gifting, keeping, and family remembrance."]
      ]
    });
  }

  if (deliverableCode === "family_story_pdf") {
    return pdfDocumentText({
      title: "Family Story",
      subtitle: "A warm narrative companion for the private legacy collection.",
      context,
      sections: [
        ["Opening Letter", context.collection_content?.collection_letter ?? letterFallback(context)],
        ["What This Collection Represents", context.collection_content?.family_story ?? storyFallback(context)],
        ["Values Carried Forward", themeBulletText(context)],
        ["Closing Keepsake Message", closingKeepsakeMessage(context)]
      ]
    });
  }

  return pdfDocumentText({
    title: "Symbol Guide",
    subtitle: "The meaning behind each symbol chosen for this family collection.",
    context,
    sections: [
      ["The Meaning Behind This Collection", meaningSummary(context)],
      ["Symbols Chosen for Your Family", symbolGuideText(context)],
      ["Why It Was Designed This Way", context.collection_content?.design_basis ?? designFallback(context)],
      ["How the Certificate Should Feel", context.certificate_direction ?? "Private, warm, archival, and suitable for family keeping."]
    ]
  });
}

function pdfDocumentText(input: {
  title: string;
  subtitle: string;
  context: ArtifactContext;
  sections: Array<[string, string]>;
}): string {
  const expandedSections = input.sections.flatMap(([heading, body]) => [
    heading,
    body,
    ""
  ]);
  return [
    "MyKinLegacy",
    "Legacy, Designed.",
    input.title,
    input.subtitle,
    `Archive Reference: ${input.context.order_number}`,
    `Prepared for: ${input.context.house_name}`,
    input.context.motto ? `Motto: ${input.context.motto}` : "",
    "",
    "Important Note",
    ARTIFACT_BOUNDARY_STATEMENT,
    "",
    ...expandedSections,
    "Private Archive Note",
    archiveCareText(input.context)
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function meaningSummary(context: ArtifactContext): string {
  return (
    context.collection_content?.house_meaning_summary ??
    `${context.house_name} is represented through ${naturalList(context.themes.map((theme) => theme.theme), "family meaning")}. The collection uses symbolic artwork and written artifacts to preserve what the family wants to recognize, share, and carry forward.`
  );
}

function symbolGuideText(context: ArtifactContext): string {
  return context.symbols
    .map(
      (symbol) =>
        `${titleCase(symbol.symbol)}\nMeaning: ${symbol.meaning ?? "A chosen family symbol"}.\nWhy it was chosen: ${
          symbol.why_chosen ?? symbol.rationale ?? "It supports the collection's core family meaning."
        }\nHow it appears visually: This symbol is treated as part of the crest structure, framed in a restrained black and antique gold archive style.\nEmotional relevance: ${
          symbol.emotional_relevance ??
          "It gives the collection a visible reminder of the family's values, memory, and continuity."
        }`
    )
    .join("\n\n");
}

function symbolBulletText(context: ArtifactContext): string {
  return context.symbols
    .map((symbol) => `- ${titleCase(symbol.symbol)}: ${symbol.meaning ?? "symbolic family meaning"}`)
    .join("\n");
}

function themeBulletText(context: ArtifactContext): string {
  return context.themes
    .map((theme) => `- ${titleCase(theme.theme)}: ${theme.evidence ?? "Supported by the family interview details."}`)
    .join("\n");
}

function certificateFallback(context: ArtifactContext): string {
  return `Presented as a private symbolic keepsake for ${context.house_name}. This certificate honors ${naturalList(
    context.themes.map((theme) => theme.theme),
    "family meaning"
  )} and the symbols chosen to represent the family with dignity.`;
}

function storyFallback(context: ArtifactContext): string {
  return `${context.house_name} is represented as a family shaped by ${naturalList(
    context.themes.map((theme) => theme.theme),
    "connection and continuity"
  )}. This collection gathers those qualities into a private keepsake so the family can see its values reflected with warmth and care.`;
}

function letterFallback(context: ArtifactContext): string {
  return `To ${context.house_name},\n\nThis collection was prepared to recognize what ordinary gifts often cannot hold: the values, symbols, and memories that make a family feel like itself.\n\nWith care,\nMyKinLegacy`;
}

function closingKeepsakeMessage(context: ArtifactContext): string {
  return `May this collection become something the family can open again in future seasons: on birthdays, holidays, family gatherings, anniversaries, and quiet moments of remembrance. Its value is not a public claim. Its value is recognition: ${context.house_name} seeing itself with language, symbols, and care.`;
}

function designFallback(context: ArtifactContext): string {
  return `The design basis uses ${naturalList(
    context.symbols.map((symbol) => titleCase(symbol.symbol)),
    "chosen symbols"
  )} to express ${naturalList(context.themes.map((theme) => theme.theme), "family meaning")} in a private archival style.`;
}

function archiveCareText(context: ArtifactContext): string {
  return [
    "This private archive was prepared to feel gift-ready, calm, and suitable for long-term keeping.",
    "Keep this collection with family photographs, letters, keepsake boxes, or digital family archives.",
    "It was designed to be opened again on birthdays, holidays, family gatherings, anniversaries, and quiet moments of remembrance.",
    "The value of the collection is not a public claim. Its value is recognition: a family seeing itself with language, symbols, and care.",
    "Share it only with the people you choose. Preserve it in the way your family naturally keeps meaningful things.",
    `${context.house_name} is presented here as a private symbolic keepsake shaped by ${naturalList(
      context.themes.map((theme) => theme.theme),
      "family meaning"
    )}.`,
    "The purpose is to give the family a readable, gift-ready artifact that can be revisited over time without claiming public authority, legal heraldry, or certified genealogy.",
    "MyKinLegacy creates these documents as personalized symbolic keepsakes: meaningful, private, and designed to be preserved.",
    "Suggested family use: open the certificate when giving the collection as a gift, then read the story slowly with the person receiving it.",
    "Suggested family use: keep the symbol guide near the crest artwork so future readers understand why each element was chosen.",
    "Suggested family use: place the collection archive beside family photos, letters, recipes, recordings, or other private records that carry emotional weight.",
    "Suggested family use: revisit the collection when a child asks where the family comes from, what the family values, or why certain memories matter.",
    "Suggested family use: bring the collection into holidays, anniversaries, retirements, memorial moments, and family gatherings when ordinary gifts feel too small.",
    "Preservation note: the collection is intentionally private by default. It is meant to be shared by choice, not published as a public claim.",
    "Preservation note: the symbols should be read as language for family meaning, not as legal authority or certified ancestry.",
    "Preservation note: the archive reference connects these artifacts to the order record without exposing private storage paths or download tokens.",
    "Preservation note: the writing favors recognition over exaggeration, so the keepsake can remain sincere when read years from now.",
    "Preservation note: the visual style uses restraint because family meaning often feels strongest when presented with calm, dignity, and care.",
    "Preservation note: the best test of this collection is not whether it looks ornate. The test is whether the family can say, this feels like us.",
    "Preservation note: if the family adds more memories later, this collection can serve as the first chapter of a longer private archive.",
    "Archive checklist: save one copy with the full ZIP archive and another copy wherever the family keeps important digital records.",
    "Archive checklist: print the certificate on warm white paper if the collection is being given as a physical gift.",
    "Archive checklist: write the order reference near any printed copy so the family knows which private collection it belongs to.",
    "Archive checklist: pair the story document with a handwritten note if the gift is being given to a parent or grandparent.",
    "Archive checklist: keep the crest artwork separate from the explanatory documents when sharing a quick preview with relatives.",
    "Archive checklist: keep the full collection together when preserving it for children or future family members.",
    "Archive checklist: revisit the symbol guide before displaying the crest so the artwork is connected to meaning, not treated as decoration.",
    "Archive checklist: read the boundary note whenever someone asks whether this is official heraldry, legal arms, or certified genealogy.",
    "Archive checklist: use the collection as a starting point for family conversations, not as the final word on family history.",
    "Archive checklist: add real names, dates, photos, and memories over time if the family wants to build a deeper private archive.",
    "Archive checklist: let the recipient decide whether the collection should remain private, be printed, or be shared with close family.",
    "Archive checklist: preserve the original files without renaming them if the family wants a stable archival set.",
    "Archive checklist: if the family creates new memories, keep this version as a snapshot of what mattered at the time it was made.",
    "Archive checklist: if a symbol no longer feels right later, treat that as a family conversation rather than a flaw in the archive.",
    "Archive checklist: the collection is strongest when it is opened slowly, with someone who knows the stories behind the family.",
    "Archive checklist: the most meaningful use is often simple: read the letter aloud, open the crest, then talk about what feels true.",
    "Archive checklist: store the archive somewhere private enough for family meaning and accessible enough that it is not forgotten.",
    "Archive checklist: if the collection becomes part of a celebration, let it support the moment rather than dominate it.",
    "Archive checklist: when shared with children, explain that symbols are a language for meaning, not proof of rank or ancestry.",
    "Archive checklist: when shared with elders, invite corrections, stories, and memories that make the collection more personal.",
    "Conversation prompt: which value in this collection feels most true to the family right now?",
    "Conversation prompt: which symbol would a parent or grandparent recognize first, and why?",
    "Conversation prompt: what story should be added beside this collection so future readers understand the family better?",
    "Conversation prompt: which holiday, milestone, or family gathering would be the right time to open this again?",
    "Conversation prompt: what does the family hope children will remember about this season of life?",
    "Conversation prompt: which family habit, phrase, recipe, place, or object carries more meaning than outsiders would understand?",
    "Conversation prompt: who in the family quietly protected, guided, or held others together?",
    "Conversation prompt: what part of the family story deserves gratitude even if it was rarely spoken aloud?",
    "Conversation prompt: what should remain private, and what can be shared with relatives?",
    "Conversation prompt: if this collection were reopened in ten years, what would the family hope still feels true?",
    "Conversation prompt: which family place, room, workshop, garden, street, church, or kitchen still carries memory?",
    "Conversation prompt: what object would the family place beside this archive if it were displayed on a table?",
    "Conversation prompt: what sentence would a parent write inside the cover if this became a family book?",
    "Conversation prompt: which story should be recorded before it becomes harder to remember?",
    "Conversation prompt: what does the family do for each other that outsiders rarely see?",
    "Conversation prompt: which tradition should be kept even if the family changes over time?",
    "Conversation prompt: what should future children know about the people who came before them?",
    "Conversation prompt: which part of this collection feels most worth preserving?",
    "Conversation prompt: who should receive the first printed copy if the collection becomes a family gift?",
    "Conversation prompt: what value should be named aloud when the family gathers again?",
    "Conversation prompt: which small act of care best explains the family better than a formal history could?"
  ].join(" ");
}

function pngArchivePath(houseName: string, deliverableCode: string): string {
  const folder = deliverableCode === "transparent_crest_png" ? "transparent-artwork" : "crest-artwork";
  return `${folder}/${safeFileName(houseName, deliverableCode, "png")}`;
}

function safeFileName(houseName: string, deliverableCode: string, ext: string): string {
  const slug = houseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "family";
  return `${slug}-${deliverableCode.replaceAll("_", "-")}.${ext}`;
}

function customerFacingFamilyName(input: {
  house_name?: string | null;
  surname?: string | null;
  recipient?: string | null;
}): string {
  const houseName = cleanDisplayName(input.house_name);
  if (houseName) return houseName;
  const surname = cleanDisplayName(input.surname);
  if (surname) return `The ${surname} Family`;
  const recipient = cleanDisplayName(input.recipient);
  if (recipient) return `${recipient} Legacy Collection`;
  return "Your Family Legacy";
}

function cleanDisplayName(value?: string | null): string | null {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  if (!cleaned || /^(unknown|null|undefined|n\/a|none)$/i.test(cleaned)) return null;
  if (/house of unknown/i.test(cleaned)) return null;
  return cleaned.slice(0, 80);
}

function dedupeContextSymbols(symbols: ArtifactContext["symbols"]): ArtifactContext["symbols"] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    const cleaned = cleanDisplayName(symbol.symbol);
    const key = cleaned?.toLowerCase();
    if (!cleaned || !key || seen.has(key)) return false;
    seen.add(key);
    symbol.symbol = cleaned;
    return true;
  });
}

function meaningAttachment(manifest: OrchestrationManifest): Record<string, unknown> {
  const attachment = manifest.optional_assets.find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  return isRecord(attachment) ? attachment : {};
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function naturalList(values: string[], fallback: string): string {
  const clean = values.map((value) => value.trim()).filter(Boolean);
  if (clean.length === 0) return fallback;
  if (clean.length === 1) return clean[0] ?? fallback;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function friendlyProgress(fulfillmentStatus: string): string {
  if (fulfillmentStatus === "completed") return "download_ready";
  if (fulfillmentStatus === "generating") return "generating_assets";
  if (fulfillmentStatus === "queued") return "generation_queued";
  return "waiting_for_generation";
}

function maskStorageKey(value: string): string {
  const parts = value.split("/");
  return parts.length > 2 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

function meaningInputFromOrder(input: {
  order: OrchestrationOrder;
  orderItem: OrchestrationOrderItem;
  payload: Record<string, unknown>;
}) {
  const orderInput = input.order.order_inputs?.[0];
  const houseDna = firstRecord(
    recordObject(orderInput?.input_json, "house_dna"),
    orderInput?.normalized_input_json
  );
  const values = stringArray(recordValue(houseDna, "family_values"));
  const symbols = [
    ...stringArray(recordValue(houseDna, "symbols")),
    ...stringArray(recordValue(houseDna, "guardian_animals")),
    ...stringArray(recordValue(houseDna, "preferred_elements"))
  ];
  const colors = colorArray(recordValue(houseDna, "colors"));
  return {
    recipient: stringOrNull(recordValue(input.payload, "recipient")),
    occasion: stringOrNull(recordValue(input.payload, "occasion")),
    values,
    memories: stringArray(recordValue(input.payload, "family_memories")),
    preferred_tone: [
      ...stringArray(recordValue(houseDna, "emotional_tone")),
      stringOrNull(recordValue(houseDna, "visual_style"))
    ].filter((value): value is string => Boolean(value)),
    symbols,
    colors,
    surname: stringOrNull(recordValue(houseDna, "surname")),
    house_name: stringOrNull(recordValue(houseDna, "house_name")),
    motto: stringOrNull(recordValue(houseDna, "motto")),
    source_level: orderInput ? "customer_confirmed" as const : "minimal" as const
  };
}

function createMeaningAttachment(input: Record<string, unknown>, now: Date): Record<string, unknown> {
  const meaningModule = loadMeaningEngine();
  return meaningModule.createMeaningManifestAttachment(input, now) as Record<string, unknown>;
}

function loadArtifactTooling(): ArtifactTooling {
  try {
    // Prefer source during package-level tests before workspace dist outputs are rebuilt.
    const sourceBase = process.cwd().endsWith("packages\\database") || process.cwd().endsWith("packages/database")
      ? join(process.cwd(), "..")
      : join(process.cwd(), "packages");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfSource = require(join(sourceBase, "pdf/src/index.ts")) as Pick<ArtifactTooling, "buildSimplePdf">;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storageSource = require(join(sourceBase, "storage/src/index.ts")) as Omit<ArtifactTooling, "buildSimplePdf">;
    if (typeof storageSource.createMvpCrestPngBuffer === "function") {
      return { ...storageSource, buildSimplePdf: pdfSource.buildSimplePdf };
    }
  } catch {
    // Fall back to built workspace packages in production.
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfPackage = require("@ai-heritage/pdf") as Pick<ArtifactTooling, "buildSimplePdf">;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const storagePackage = require("@ai-heritage/storage") as Omit<ArtifactTooling, "buildSimplePdf">;
  return { ...storagePackage, buildSimplePdf: pdfPackage.buildSimplePdf };
}

function loadMeaningEngine(): {
  createMeaningManifestAttachment(input: Record<string, unknown>, now: Date): unknown;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const workspaceModule = require("@ai-heritage/domain") as {
      createMeaningManifestAttachment(input: Record<string, unknown>, now: Date): unknown;
    };
    const sample =
      typeof workspaceModule.createMeaningManifestAttachment === "function"
        ? workspaceModule.createMeaningManifestAttachment({}, new Date(0))
        : null;
    if (isRecord(sample) && isRecord(sample.collection_content)) {
      return workspaceModule;
    }
  } catch {
    // Fall back to source below for package-level tests before domain dist is rebuilt.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../domain/src/meaning/rules.ts") as {
      createMeaningManifestAttachment(input: Record<string, unknown>, now: Date): unknown;
    };
  } catch {
    throw new Error("meaning_engine_module_unavailable");
  }
}

function meaningProfileSummary(manifest: OrchestrationManifest) {
  const attachment = manifest.optional_assets.find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  if (!isRecord(attachment)) return null;
  const profile = recordObject(attachment, "meaning_profile");
  return {
    source_level: stringOrNull(recordValue(profile, "source_level")),
    themes: recordArray<Record<string, unknown>>(profile, "meaning_themes").map((theme) => ({
      theme: stringOrNull(recordValue(theme, "theme")),
      confidence: stringOrNull(recordValue(theme, "confidence")),
      evidence: stringOrNull(recordValue(theme, "evidence"))
    })),
    symbols: recordArray<Record<string, unknown>>(profile, "symbol_choices").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")),
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      rationale: stringOrNull(recordValue(symbol, "rationale")),
      source: stringOrNull(recordValue(symbol, "source"))
    })),
    design_rationale: stringArray(recordValue(profile, "design_rationale")),
    story_direction: stringOrNull(recordValue(profile, "story_direction")),
    certificate_direction: stringOrNull(recordValue(profile, "certificate_direction")),
    boundary_statement: stringOrNull(recordValue(profile, "boundary_statement")),
    validation: recordObject(profile, "validation")
  };
}

function collectionContentSummary(manifest: OrchestrationManifest) {
  const attachment = manifest.optional_assets.find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  if (!isRecord(attachment)) return null;
  const content = recordObject(attachment, "collection_content");
  if (!Object.keys(content).length) return null;
  return serializeCollectionContent(content);
}

function serializeCollectionContent(content: Record<string, unknown>) {
  return {
    house_meaning_summary: stringOrNull(recordValue(content, "house_meaning_summary")),
    symbol_guide: recordArray<Record<string, unknown>>(content, "symbol_guide").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")),
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      why_chosen: stringOrNull(recordValue(symbol, "why_chosen")),
      emotional_relevance: stringOrNull(recordValue(symbol, "emotional_relevance"))
    })),
    family_story: stringOrNull(recordValue(content, "family_story")),
    certificate_text: stringOrNull(recordValue(content, "certificate_text")),
    collection_letter: stringOrNull(recordValue(content, "collection_letter")),
    design_basis: stringOrNull(recordValue(content, "design_basis")),
    boundary_statement: stringOrNull(recordValue(content, "boundary_statement"))
  };
}

function firstRecord(...values: unknown[]): Record<string, unknown> {
  return values.find(isRecord) ?? {};
}

function recordObject(record: unknown, key: string): Record<string, unknown> {
  const value = recordValue(record, key);
  return isRecord(value) ? value : {};
}

function recordArray<T>(record: unknown, key: string): T[] {
  const value = recordValue(record, key);
  return Array.isArray(value) ? (value as T[]) : [];
}

function recordValue(record: unknown, key: string): unknown {
  return isRecord(record) ? record[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function colorArray(value: unknown): string[] {
  if (!isRecord(value)) return [];
  return [
    ...stringArray(value.primary),
    ...stringArray(value.secondary),
    ...stringArray(value.metallic),
    ...stringArray(value.accent)
  ];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stringField(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("missing_string_field");
  return value;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function iso(date?: Date): string {
  return (date ?? new Date()).toISOString();
}
