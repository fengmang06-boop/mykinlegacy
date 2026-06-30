import { createHash, randomBytes } from "node:crypto";

import { ulid } from "ulid";

import type {
  ExpectedAssetContract,
  OrchestrationAsset,
  OrchestrationEmailLog,
  OrchestrationManifest,
  OrchestrationOutboxEvent,
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
      optional_assets: [],
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
  failEmail?: boolean;
}): Promise<{
  manifest: OrchestrationManifest;
  assets: OrchestrationAsset[];
  download_token_id: string;
  email_log: OrchestrationEmailLog;
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
  for (const deliverable of REQUIRED_DELIVERABLES.filter((code) => code !== "download_package_zip")) {
    const asset = await input.repository.createAsset(createAssetRecord({ manifest: current, deliverable_code: deliverable, now: input.now }));
    createdAssets.push(asset);
    current = await markManifestAssetGenerated(input.repository, current, asset.id, deliverable, input.now);
  }

  const nonZipMissing = current.missing_required_assets.filter((code) => code !== "download_package_zip");
  if (nonZipMissing.length > 0) throw new Error("zip_required_asset_missing");
  const zipAsset = await input.repository.createAsset(createAssetRecord({ manifest: current, deliverable_code: "download_package_zip", now: input.now }));
  createdAssets.push(zipAsset);
  current = await markManifestAssetGenerated(input.repository, current, zipAsset.id, "download_package_zip", input.now);
  current = await completeManifestIfReady(input.repository, current, input.now);
  const completion = await completeOrderDelivery({
    repository: input.repository,
    manifest: current,
    now: input.now,
    failEmail: input.failEmail
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
    email_log: completion.email_log
  };
}

export async function completeOrderDelivery(input: {
  repository: OrchestrationRepository;
  manifest: OrchestrationManifest;
  now?: Date;
  failEmail?: boolean;
}): Promise<{ download_token_id: string; raw_token_for_email_only: string; email_log: OrchestrationEmailLog }> {
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
  const emailLog = await input.repository.createEmailLog({
    id: ulid(),
    order_id: order.id,
    provider: "mock",
    recipient_email_hash: sha256(`${order.id}:customer@example.test`),
    status: input.failEmail ? "failed" : "sent",
    payload_json: {
      order_number: order.order_number,
      download_token_id: token.id,
      masked_download_vault_link: `/download/[redacted]`,
      vault_link_only: true
    },
    created_at: iso(input.now),
    sent_at: input.failEmail ? null : iso(input.now)
  });
  await input.repository.updateOrderStatus({
    order_id: order.id,
    order_status: order.payment_status === "paid" ? "completed" : order.order_status,
    fulfillment_status: "completed",
    completed_at: iso(input.now)
  });
  return { download_token_id: token.id, raw_token_for_email_only: rawToken, email_log: emailLog };
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
          failed_assets_count: manifest.failed_assets.length
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
          missing_required_assets: manifest.missing_required_assets
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

function createAssetRecord(input: {
  manifest: OrchestrationManifest;
  deliverable_code: string;
  now?: Date;
}): OrchestrationAsset {
  const assetType = input.deliverable_code.endsWith("_pdf")
    ? "pdf"
    : input.deliverable_code.endsWith("_zip")
      ? "archive"
      : "image";
  const ext = assetType === "pdf" ? "pdf" : assetType === "archive" ? "zip" : "png";
  const id = ulid();
  const storageKey = `orders/${input.manifest.order_id}/${input.manifest.order_item_id}/${input.deliverable_code}/${id}.${ext}`;
  return {
    id,
    order_id: input.manifest.order_id,
    order_item_id: input.manifest.order_item_id,
    generation_job_id: input.manifest.generation_job_id ?? "generation_job_missing",
    deliverable_code: input.deliverable_code,
    asset_type: assetType,
    asset_kind: assetType === "archive" ? "packaged" : "generated",
    status: "available",
    storage_provider: "local_private",
    storage_bucket: "private-assets",
    storage_key: storageKey,
    file_name: `${input.deliverable_code}.${ext}`,
    mime_type: assetType === "pdf" ? "application/pdf" : assetType === "archive" ? "application/zip" : "image/png",
    file_ext: ext,
    size_bytes: 100,
    checksum_sha256: sha256(storageKey),
    public_url: null,
    created_at: iso(input.now)
  };
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
