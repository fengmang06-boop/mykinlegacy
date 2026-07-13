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
  "symbol_explanation_pdf",
  "heritage_certificate_pdf",
  "family_story_pdf",
  "download_package_zip"
] as const;

const CUSTOMER_PACKAGE_DELIVERABLES = [
  "crest_variant_1_png",
  "heritage_certificate_pdf",
  "family_story_pdf",
  "symbol_explanation_pdf"
] as const;

const MIN_CUSTOMER_ARTIFACT_BYTES = 10 * 1024;
const ARTIFACT_BUCKET = "private-assets";
const PDF_LAYOUT_VERSION = "premium_v5_frameable";
const ZIP_ROOT = "MyKinLegacy-Private-Legacy-Collection";
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
  const orderItem = await input.repository.findOrderItem(manifest.order_item_id);
  if (!orderItem) throw new Error("order_item_not_found");
  const timestamp = iso(input.now);
  const refreshedMeaning = applySingleOrderLreTextIntegration(
    createMeaningAttachment(
      meaningInputFromOrder({
        order,
        orderItem,
        payload: {
          ...order.metadata_json,
          ...existingMeaningCustomerInputs(manifest)
        }
      }),
      input.now ?? new Date()
    ),
    order.order_number
  );
  const manifestWithFreshMeaning = {
    ...manifest,
    optional_assets: replaceMeaningAttachment(manifest.optional_assets, refreshedMeaning)
  };
  let current = await input.repository.updateManifest({
    ...manifestWithFreshMeaning,
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
  appendPngTextMetadata(buffer: Buffer, metadataText: string): Buffer;
  buildMvpCrestPngMetadataText(metadata?: PngPromptMetadata): string;
  createMvpCrestPngBuffer(input: {
    variant: string;
    house_name?: string;
    symbols?: string[];
    transparent?: boolean;
    prompt_metadata?: PngPromptMetadata;
  }): Buffer;
  generateReadme(input: {
    package_title: string;
    included_files: string[];
    support_note?: string;
    disclaimer: string;
  }): Promise<string>;
  listZipEntries(buffer: Buffer): string[];
  readPngMetadata(buffer: Buffer): { width: number; height: number; has_alpha: boolean; has_transparent_pixels?: boolean };
}

interface PngPromptMetadata {
  prompt_source?: "old_prompt" | "lre_prompt";
  pve_score?: number | null;
  pve_passed?: boolean;
  old_prompt_sha256?: string | null;
  lre_prompt_sha256?: string | null;
  selected_prompt?: string | null;
  negative_prompt?: string | null;
  primary_symbol?: string | null;
  secondary_symbols?: string[];
  selected_dna?: string[];
  image_generation_bridge?: string | null;
  image_provider?: string | null;
  image_model?: string | null;
  provider_request_id?: string | null;
  fallback_used?: boolean;
  bridge_error?: string | null;
}

export interface ArtifactContext {
  order_number: string;
  house_name: string;
  recipient: string | null;
  relationship: string | null;
  occasion: string | null;
  values: string[];
  memories: string[];
  motto: string | null;
  themes: Array<{ theme: string; evidence: string | null }>;
  symbols: Array<{
    symbol: string;
    meaning: string | null;
    rationale: string | null;
    why_chosen?: string | null;
    customer_input_basis?: string | null;
    visual_role?: string | null;
    artifact_role?: string | null;
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
    const promptSelection = selectPngPrompt({
      deliverable_code: input.deliverable_code,
      context: input.context
    });
    const promptMetadata: PngPromptMetadata = {
      prompt_source: promptSelection.audit.source_selected,
      pve_score: promptSelection.audit.verification_score,
      pve_passed: promptSelection.audit.pve_passed,
      old_prompt_sha256: promptSelection.audit.old_sha256,
      lre_prompt_sha256: promptSelection.audit.lre_sha256,
      selected_prompt: promptSelection.selected_prompt,
      negative_prompt: promptSelection.negative_prompt,
      primary_symbol: promptSelection.audit.primary_symbol,
      secondary_symbols: promptSelection.audit.secondary_symbols,
      selected_dna: promptSelection.audit.selected_dna
    };
    const aiImage = await tryCreateAiGeneratedPng({
      deliverable_code: input.deliverable_code,
      promptSelection,
      tools,
      promptMetadata
    });
    const body = aiImage.body ?? tools.createMvpCrestPngBuffer({
      variant: input.deliverable_code,
      house_name: input.context.house_name,
      symbols: promptSelection.symbols,
      transparent: input.deliverable_code === "transparent_crest_png",
      prompt_metadata: {
        ...promptMetadata,
        image_generation_bridge: aiImage.bridgeStatus,
        image_provider: aiImage.providerCode,
        image_model: aiImage.modelCode,
        fallback_used: aiImage.fallbackUsed,
        bridge_error: aiImage.errorCode
      }
    });
    return {
      body,
      mime_type: "image/png",
      file_ext: "png",
      file_name: customerFileName(input.deliverable_code),
      archive_path: archivePathForDeliverable(input.deliverable_code)
    };
  }

  if (input.deliverable_code.endsWith("_pdf")) {
    const sourceText = buildCustomerPublicationText(input.deliverable_code, input.context);
    assertContentQuality(input.deliverable_code, sourceText, input.context);
    const body = tools.buildSimplePdf(sourceText);
    return {
      body,
      mime_type: "application/pdf",
      file_ext: "pdf",
      file_name: customerFileName(input.deliverable_code),
      archive_path: archivePathForDeliverable(input.deliverable_code),
      source_text: sourceText
    };
  }

  if (input.deliverable_code === "download_package_zip") {
    const sourceEntries = CUSTOMER_PACKAGE_DELIVERABLES
      .map((code) => {
        const artifact = input.generatedBodies.get(code);
        if (!artifact) throw new Error(`zip_required_asset_missing:${code}`);
        return { name: artifact.archive_path, body: artifact.body };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const readme = generateCustomerPackageReadme({
      package_title: `${input.context.house_name} Private Legacy Collection`,
      included_files: sourceEntries.map((entry) => entry.name),
      support_note: [
        input.context.collection_content?.readme_note,
        "Contact support@mykinlegacy.com with your order number if you need help."
      ]
        .filter(Boolean)
        .join(" "),
      disclaimer: ARTIFACT_BOUNDARY_STATEMENT
    });
    const body = tools.buildZipBuffer([
      {
        name: `${ZIP_ROOT}/00-Welcome/Welcome.txt`,
        body: Buffer.from(readme)
      },
      ...sourceEntries
    ]);
    return {
      body,
      mime_type: "application/zip",
      file_ext: "zip",
      file_name: customerFileName(input.deliverable_code),
      archive_path: customerFileName(input.deliverable_code)
    };
  }

  throw new Error(`unsupported_deliverable:${input.deliverable_code}`);
}

function generateCustomerPackageReadme(input: {
  package_title: string;
  included_files: string[];
  support_note?: string;
  disclaimer: string;
}): string {
  return [
    "MyKinLegacy",
    "Legacy, Designed.",
    "",
    input.package_title,
    "Private Legacy Collection Archive",
    "",
    "What is included",
    ...input.included_files.map((file) => `- ${file}`),
    "",
    "Opening order",
    "1. Welcome: begin here and understand how the private collection is arranged.",
    "2. Family Legacy Certificate: begin with the primary frameable keepsake prepared for the recipient.",
    "3. Final Crest: view the standalone artwork at the center of the certificate.",
    "4. Family Story: read the emotional narrative slowly, preferably with close family nearby.",
    "5. Meaning Behind Your Crest: use this after the story to understand why this crest was created.",
    "",
    "Printing and keeping",
    "The PDF documents are intended for reading, printing, and private family preservation.",
    "The PNG artwork can be used for personal keepsake printing, family sharing, or private display.",
    "Store a copy with family photographs, letters, keepsake boxes, or a private digital archive.",
    "",
    "Privacy note",
    "This archive is private by default. Share it only with the people you choose.",
    "Do not publish private family details unless the family is comfortable doing so.",
    "",
    input.support_note ? `Support: ${input.support_note}` : "",
    "",
    "Boundary statement",
    input.disclaimer
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

interface PngPromptSelection {
  symbols: string[];
  selected_prompt: string;
  negative_prompt: string | null;
  audit: {
    enabled: boolean;
    order_number: string | null;
    source_selected: "old_prompt" | "lre_prompt";
    reason: string;
    verification_score: number | null;
    pve_passed: boolean;
    old_sha256: string;
    lre_sha256: string | null;
    primary_symbol: string | null;
    secondary_symbols: string[];
    selected_dna: string[];
  };
}

function selectPngPrompt(input: {
  deliverable_code: string;
  context: ArtifactContext;
}): PngPromptSelection {
  const symbols = input.context.symbols.map((symbol) => symbol.symbol).filter(Boolean);
  const oldPrompt = buildLegacyImagePrompt(input);
  const negativePrompt = [
    "no readable text",
    "no letters",
    "no words",
    "no motto",
    "no surname",
    "no initials",
    "no banner text",
    "no official seal",
    "no royal crown",
    "no noble title",
    "no certified genealogy"
  ].join(", ");
  const bridge = loadLrePromptReplacement();
  if (!bridge) {
    return {
      symbols,
      selected_prompt: oldPrompt,
      negative_prompt: negativePrompt,
      audit: {
        enabled: false,
        order_number: input.context.order_number,
        source_selected: "old_prompt",
        reason: "lre_prompt_bridge_unavailable",
        verification_score: null,
        pve_passed: false,
        old_sha256: sha256(oldPrompt),
        lre_sha256: null,
        primary_symbol: null,
        secondary_symbols: [],
        selected_dna: []
      }
    };
  }

  const result = bridge.applyAllowlistedLrePromptReplacement({
    job_id: `manifest_png_${input.context.order_number}_${input.deliverable_code}`,
    generation_job_id: "manifest_driven_generation",
    generation_step_id: null,
    rendered_prompt_id: `manifest_prompt_${input.context.order_number}_${input.deliverable_code}`,
    rendered_prompt: oldPrompt,
    negative_prompt: negativePrompt,
    prompt_template_version_id: "manifest_legacy_image_prompt_v1",
    identity_version_id: "manifest_identity_snapshot",
    product_code: "family_legacy_collection",
    package_code: "premium",
    deliverable_code: input.deliverable_code,
    provider_code: "manifest_local_renderer",
    model_code: "mvp_crest_renderer",
    output_requirements: {
      order_number: input.context.order_number,
      format: "png",
      private_storage: true
    },
    safety_metadata: {
      order_number: input.context.order_number,
      house_name: input.context.house_name,
      family_values: input.context.themes.map((theme) => theme.theme),
      dominant_themes: input.context.themes.map((theme) => theme.theme),
      symbols,
      visual_style: "premium private archive",
      colors: ["near-black", "antique gold", "warm ivory"],
      include_text_in_image: false
    },
    ai_provider_id: "manifest_local_renderer_provider",
    ai_model_id: "mvp_crest_renderer_model"
  });

  const selectedSymbols =
    result.audit.source_selected === "lre_prompt"
      ? [
          result.audit.primary_symbol,
          ...result.audit.secondary_symbols
        ].filter((symbol): symbol is string => Boolean(symbol))
      : symbols;

  return {
    symbols: selectedSymbols.length > 0 ? selectedSymbols : symbols,
    selected_prompt: result.input.rendered_prompt,
    negative_prompt: result.input.negative_prompt,
    audit: result.audit
  };
}

function buildLegacyImagePrompt(input: { deliverable_code: string; context: ArtifactContext }): string {
  const symbolList = input.context.symbols.map((symbol) => symbol.symbol).filter(Boolean).join(", ");
  const themes = input.context.themes.map((theme) => theme.theme).filter(Boolean).join(", ");
  return [
    `Create a symbolic family crest image for ${input.context.house_name}.`,
    `Use classic heritage styling with shield, tree, knot, laurel, and antique gold on black.`,
    `Customer symbols: ${symbolList || "shield, tree, roots"}.`,
    `Themes: ${themes || "family continuity, unity"}.`,
    `Deliverable: ${input.deliverable_code}.`,
    `Do not render readable text, names, motto, letters, official heraldry, royal symbols, noble claims, or genealogy claims.`
  ].join(" ");
}

interface AiPngBridgeResult {
  body: Buffer | null;
  bridgeStatus: string;
  providerCode: string;
  modelCode: string | null;
  fallbackUsed: boolean;
  errorCode: string | null;
}

async function tryCreateAiGeneratedPng(input: {
  deliverable_code: string;
  promptSelection: PngPromptSelection;
  tools: ArtifactTooling;
  promptMetadata: PngPromptMetadata;
}): Promise<AiPngBridgeResult> {
  if (input.promptSelection.audit.source_selected !== "lre_prompt") {
    return deterministicPngBridgeResult("old_prompt_selected", false);
  }

  if (input.promptSelection.audit.pve_passed !== true || (input.promptSelection.audit.verification_score ?? 0) < 95) {
    return deterministicPngBridgeResult("pve_not_passed", false);
  }

  if (input.deliverable_code === "transparent_crest_png") {
    return deterministicPngBridgeResult("transparent_png_kept_on_local_renderer", false);
  }

  const config = aiImageProviderConfigFromEnv();
  if (!config) {
    return deterministicPngBridgeResult("provider_not_configured", false);
  }

  if (!config.apiKey) {
    return deterministicPngBridgeResult("openai_api_key_missing", true, config);
  }

  try {
    const output = await generateOpenAiImage({
      prompt: input.promptSelection.selected_prompt,
      negative_prompt: input.promptSelection.negative_prompt,
      config
    });
    const providerBody = await imageBufferFromProviderRef(output.temporary_output_ref);
    const metadataText = [
      "MyKinLegacy symbolic crest artwork.",
      "artwork_template=shield_legacy_crest_v1;",
      "artwork_mode=ai_image_provider;",
      "theme_mapping=continuity,unity;",
      "artwork_quality=ai_provider_beta;",
      input.tools.buildMvpCrestPngMetadataText({
        ...input.promptMetadata,
        image_generation_bridge: "ai_provider",
        image_provider: config.providerCode,
        image_model: config.modelCode,
        provider_request_id: output.provider_request_id,
        fallback_used: false
      })
    ].join(" ");
    const body = input.tools.appendPngTextMetadata(providerBody, metadataText);
    input.tools.readPngMetadata(body);
    return {
      body,
      bridgeStatus: "ai_provider",
      providerCode: config.providerCode,
      modelCode: config.modelCode,
      fallbackUsed: false,
      errorCode: null
    };
  } catch (error) {
    return deterministicPngBridgeResult(safeErrorCode(error), true, config);
  }
}

function deterministicPngBridgeResult(
  bridgeStatus: string,
  fallbackUsed: boolean,
  config?: AiImageProviderConfig
): AiPngBridgeResult {
  return {
    body: null,
    bridgeStatus,
    providerCode: config?.providerCode ?? "deterministic_renderer",
    modelCode: config?.modelCode ?? "mvp_crest_renderer",
    fallbackUsed,
    errorCode: fallbackUsed ? bridgeStatus : null
  };
}

interface AiImageProviderConfig {
  providerCode: "openai";
  apiKey: string | undefined;
  modelCode: string;
  size: string;
  quality: string;
}

function aiImageProviderConfigFromEnv(): AiImageProviderConfig | null {
  const provider = (process.env.LRE_IMAGE_GENERATION_PROVIDER ?? process.env.AI_IMAGE_GENERATION_PROVIDER ?? "")
    .trim()
    .toLowerCase();
  if (provider !== "openai") return null;
  return {
    providerCode: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    modelCode: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    size: process.env.OPENAI_IMAGE_SIZE ?? "1024x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY ?? "high"
  };
}

async function generateOpenAiImage(input: {
  prompt: string;
  negative_prompt: string | null;
  config: AiImageProviderConfig;
}): Promise<{ provider_request_id: string; temporary_output_ref: string }> {
  const prompt = [
    input.prompt,
    input.negative_prompt ? `Negative instructions: ${input.negative_prompt}` : null
  ].filter(Boolean).join("\n\n");
  const requestBody = {
    model: input.config.modelCode,
    prompt,
    n: 1,
    size: input.config.size,
    quality: input.config.quality
  };
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const responseJson = await safeJson(response);
  if (!response.ok) {
    throw new Error(`openai_image_http_${response.status}_${safeProviderErrorCode(responseJson)}`);
  }

  const first = Array.isArray(responseJson.data) ? responseJson.data[0] : null;
  const b64Json = isRecord(first) && typeof first.b64_json === "string" ? first.b64_json : null;
  const url = isRecord(first) && typeof first.url === "string" ? first.url : null;
  if (!b64Json && !url) throw new Error("openai_image_missing_output");
  return {
    provider_request_id: typeof responseJson.id === "string" ? responseJson.id : `openai-image-${Date.now()}`,
    temporary_output_ref: b64Json ? `data:image/png;base64,${b64Json}` : url ?? ""
  };
}

async function imageBufferFromProviderRef(ref: string): Promise<Buffer> {
  const dataPrefix = "data:image/png;base64,";
  if (ref.startsWith(dataPrefix)) {
    return Buffer.from(ref.slice(dataPrefix.length), "base64");
  }

  if (/^https?:\/\//i.test(ref)) {
    const response = await fetch(ref);
    if (!response.ok) throw new Error(`provider_image_fetch_failed_${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("unsupported_provider_image_ref");
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(/[^a-z0-9_:-]+/gi, "_").slice(0, 120);
  }
  return "ai_provider_failed";
}

function safeProviderErrorCode(value: Record<string, unknown>): string {
  const error = isRecord(value.error) ? value.error : {};
  const parts = [
    typeof error.code === "string" ? error.code : null,
    typeof error.param === "string" ? error.param : null,
    typeof error.message === "string" ? error.message : null
  ]
    .filter(Boolean)
    .join("_");
  return (parts || "unknown_provider_error").replace(/[^a-z0-9_:-]+/gi, "_").slice(0, 90);
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function loadLrePromptReplacement(): null | {
  applyAllowlistedLrePromptReplacement(input: Record<string, unknown>): {
    input: {
      rendered_prompt: string;
      negative_prompt: string | null;
    };
    audit: PngPromptSelection["audit"];
  };
} {
  try {
    const sourceBase = process.cwd().endsWith("packages\\database") || process.cwd().endsWith("packages/database")
      ? join(process.cwd(), "..")
      : join(process.cwd(), "packages");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sourceModule = require(join(sourceBase, "ai/src/generation/lre-prompt-replacement.ts")) as {
      applyAllowlistedLrePromptReplacement?: unknown;
    };
    if (typeof sourceModule.applyAllowlistedLrePromptReplacement === "function") {
      return sourceModule as ReturnType<typeof loadLrePromptReplacement>;
    }
  } catch {
    // Fall back to built workspace package in production.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageModule = require("@ai-heritage/ai") as {
      applyAllowlistedLrePromptReplacement?: unknown;
    };
    if (typeof packageModule.applyAllowlistedLrePromptReplacement === "function") {
      return packageModule as ReturnType<typeof loadLrePromptReplacement>;
    }
  } catch {
    // Caller will use old_prompt and record bridge_unavailable.
  }

  return null;
}

function assertArtifactReady(deliverableCode: string, artifact: ArtifactBody): void {
  const tools = loadArtifactTooling();
  if (artifact.file_ext === "png") {
    const metadata = tools.readPngMetadata(artifact.body);
    const text = artifact.body.toString("latin1");
    const failures: string[] = [];
    if (artifact.body.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") failures.push("png_header_invalid");
    if (metadata.width < 640 || metadata.height < 640) failures.push("png_dimensions_too_small");
    if (artifact.body.byteLength < MIN_CUSTOMER_ARTIFACT_BYTES) failures.push(`png_too_small:${artifact.body.byteLength}`);
    const aiProviderMode = text.includes("artwork_mode=ai_image_provider");
    const recoveredOfficialMode = text.includes("artwork_mode=recovered_official_asset");
    if (!text.includes("artwork_template=shield_legacy_crest_v1")) failures.push("artwork_template_missing");
    if (!text.includes("artwork_mode=deterministic_symbolic_template") && !aiProviderMode && !recoveredOfficialMode) {
      failures.push("artwork_mode_missing");
    }
    if (text.includes("prompt_source=lre_prompt")) {
      if (!/pve_score=(9[5-9]|100)\b/.test(text)) failures.push("lre_pve_score_missing_or_low");
      if (!text.includes("pve_passed=true")) failures.push("lre_pve_not_passed");
      if (!/lre_prompt_sha256=[a-f0-9]{64}/.test(text)) failures.push("lre_prompt_hash_missing");
      if (!/selected_prompt=LRE Prompt Builder:/i.test(text)) failures.push("lre_selected_prompt_missing");
      if (aiProviderMode) {
        if (!/image_provider=(?!none\b)[a-z0-9_-]+/i.test(text)) failures.push("ai_image_provider_missing");
        if (!/image_model=(?!none\b)[a-z0-9_.:-]+/i.test(text)) failures.push("ai_image_model_missing");
        if (!text.includes("fallback_used=false")) failures.push("ai_image_fallback_flag_invalid");
      }
    } else if (!recoveredOfficialMode) {
      if (!text.includes("main_symbol=tree")) failures.push("main_symbol_missing");
      if (!text.includes("supporting_symbols=shield,knot")) failures.push("supporting_symbols_missing");
    }
    if (!text.includes("theme_mapping=continuity,unity")) failures.push("theme_mapping_missing");
    if (/png\.png/i.test(artifact.file_name)) failures.push("bad_png_file_name");
    if (deliverableCode === "transparent_crest_png" && metadata.has_transparent_pixels !== true) {
      failures.push("transparent_pixels_missing");
    }
    if (failures.length > 0) {
      throw new Error(`artifact_not_ready:${deliverableCode}:${failures.join(",")}`);
    }
    return;
  }

  if (artifact.file_ext === "pdf") {
    const text = artifact.body.toString("latin1");
    const failures: string[] = [];
    if (artifact.body.subarray(0, 5).toString() !== "%PDF-") failures.push("pdf_header_invalid");
    if (!text.includes(`pdf_layout_version=${PDF_LAYOUT_VERSION}`)) failures.push("pdf_layout_version_missing");
    if (artifact.body.byteLength < MIN_CUSTOMER_ARTIFACT_BYTES) failures.push(`pdf_too_small:${artifact.body.byteLength}`);
    if (!text.includes("%%EOF")) failures.push("pdf_eof_missing");
    if (!pdfStartXrefValid(artifact.body)) failures.push("pdf_xref_invalid");
    if (!text.includes("MyKinLegacy")) failures.push("brand_missing");
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
      `${ZIP_ROOT}/00-Welcome/Welcome.txt`,
      `${ZIP_ROOT}/01-Final-Crest/Final-Crest.png`,
      `${ZIP_ROOT}/02-Heritage-Certificate/Heritage-Certificate.pdf`,
      `${ZIP_ROOT}/03-Family-Story/Family-Story.pdf`,
      `${ZIP_ROOT}/04-Meaning-Behind-Your-Crest/Meaning-Behind-Your-Crest.pdf`
    ];
    if (
      artifact.body.subarray(0, 4).toString("hex") !== "504b0304" ||
      artifact.body.byteLength < 20 * 1024 ||
      !zipEndOfCentralDirectoryValid(artifact.body) ||
      !requiredEntries.every((entry) => entries.includes(entry)) ||
      entries.some((entry) => /(?:pdf\.pdf|png\.png|undefined|null|placeholder)/i.test(entry))
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
  const failures = contentQualityFailures(deliverableCode, sourceText, context);
  if (failures.length > 0) {
    throw new Error(`content_quality_failed:${deliverableCode}:${failures.join(",")}`);
  }
}

function contentQualityFailures(
  deliverableCode: string,
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
  if (/\b(Customer input basis|Artifact Content Version|artifact_content_version)\b/i.test(sourceText)) failures.push("raw_field_label");
  if (/\b(pdf\.pdf|png\.png)\b/i.test(sourceText)) failures.push("bad_file_name");
  if (/[{[]\s*"[^"]+"\s*:/s.test(sourceText)) failures.push("raw_json_detected");
  if (/\bYour Family Legacy\b|\bPrivate family gift\b|\bcustomer input\b|\bcustomer selected\b|\bcustomer wording\b|\bmaps to\b|\bsymbolic interpretation\b|\bthis page is not\b|\bRecorded at the time this collection was prepared\b/i.test(sourceText)) {
    failures.push("founder_forbidden_phrase");
  }
  const minimumLength: Record<string, number> = {
    heritage_certificate_pdf: 300,
    family_story_pdf: 700,
    symbol_explanation_pdf: 700
  };
  if (sourceText.replace(/\s+/g, " ").trim().length < (minimumLength[deliverableCode] ?? 700)) {
    failures.push("content_too_short");
  }
  if (deliverableCode === "heritage_certificate_pdf") {
    const required = [
      "Presented To",
      "Created For",
      "Crest",
      "Archive Number",
      "Date",
      "Signature",
      "Brand Seal",
      "Ceremony Statement"
    ];
    for (const label of required) {
      if (!sourceText.includes(label)) failures.push(`missing_certificate_field:${label.replaceAll(" ", "_").toLowerCase()}`);
    }
    if (/^(Core meaning:|Why this symbol was chosen:|Family Story|Reading Order|Printing Guidance|Preservation Note|Preservation and Sharing Note|ZIP contents|Primary Symbol|Full Crest Overview)$/im.test(sourceText)) {
      failures.push("certificate_scope_leak");
    }
  }
  if (deliverableCode === "family_story_pdf") {
    for (const label of ["Dedication", "Closing Letter"]) {
      if (!sourceText.includes(label)) failures.push(`story_missing:${label.replaceAll(" ", "_").toLowerCase()}`);
    }
    if (!/Years of Quiet Strength|A Life (?:of|Held|Worth)|The Care at the Heart|A Family Story Beginning/i.test(sourceText)) failures.push("story_missing:life_contribution");
    if (!/What (?:He|She|They|the Family|.+?) Gave(?: the Family)?|What the Family Received/i.test(sourceText)) failures.push("story_missing:family_contribution");
    if (!/Carr(?:y|ies) Forward/i.test(sourceText)) failures.push("story_missing:carry_forward");
    if (!/\b(memory|legacy|meaning|family)\b/i.test(sourceText)) failures.push("story_emotion_missing");
    if (/^(Core meaning:|Why this symbol was chosen:|Official Seal|Reading Order|Printing Guidance|Preservation Note|Preservation and Sharing Note|ZIP contents|Primary Symbol|Full Crest Overview|Archive Number)$/im.test(sourceText)) {
      failures.push("story_scope_leak");
    }
  }
  if (deliverableCode === "symbol_explanation_pdf") {
    for (const label of ["The Shield", "The Tree", "The Knot", "The Key and Guiding Star", "The Laurel Frame"]) {
      if (!sourceText.includes(label)) failures.push(`symbol_guide_missing:${label.replaceAll(" ", "_").toLowerCase()}`);
    }
    if (/\b(Meaning:|Why chosen:|Emotional role:|Relationship to family:|Primary Symbol|Secondary Symbol|Supporting Symbol|Visual reading)\b/i.test(sourceText)) failures.push("dictionary_symbol_blocks");
    if (/^(Family Story|Official Seal|Reading Order|Printing Guidance|Storage Guidance|Preservation Note|Preservation and Sharing Note|ZIP contents|Archive Number)$/im.test(sourceText)) {
      failures.push("symbol_guide_scope_leak");
    }
    for (const section of sourceText.split(/\n(?=The (?:Shield|Tree|Knot|Key and Guiding Star|Laurel Frame)\n)/).slice(1)) {
      const body = section.split(/\n/).slice(1).join(" ").trim();
      const words = body.split(/\s+/).filter(Boolean).length;
      if (words < 40 || words > 90) failures.push("symbol_explanation_word_count");
    }
  }
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
  const safeContent = sanitizeCollectionContent(collectionContentSummary(input.manifest), houseName);
  const symbols = dedupeContextSymbols([
    ...(safeContent?.symbol_guide ?? []).map((symbol) => ({
      symbol: symbol.symbol ?? "Symbol",
      meaning: symbol.meaning,
      rationale: symbol.why_chosen,
      why_chosen: symbol.why_chosen,
      customer_input_basis: symbol.customer_input_basis,
      visual_role: symbol.visual_role,
      artifact_role: symbol.artifact_role,
      emotional_relevance: symbol.emotional_relevance
    })),
    ...recordArray<Record<string, unknown>>(profile, "symbol_choices").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")) ?? "shield",
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      rationale: stringOrNull(recordValue(symbol, "rationale")),
      customer_input_basis: stringOrNull(recordValue(symbol, "customer_input_basis")),
      visual_role: stringOrNull(recordValue(symbol, "visual_role")),
      artifact_role: stringOrNull(recordValue(symbol, "artifact_role")),
      emotional_relevance: stringOrNull(recordValue(symbol, "emotional_purpose"))
    }))
  ]).slice(0, 5);

  return {
    order_number: input.order.order_number,
    house_name: houseName,
    recipient: cleanDisplayName(stringOrNull(recordValue(customerInputs, "recipient"))),
    relationship: cleanDisplayName(stringOrNull(recordValue(customerInputs, "relationship"))),
    occasion: cleanDisplayName(stringOrNull(recordValue(customerInputs, "occasion"))),
    values: stringArray(recordValue(customerInputs, "values")),
    memories: stringArray(recordValue(customerInputs, "memories")),
    motto: stringOrNull(recordValue(houseDna, "motto")),
    themes: recordArray<Record<string, unknown>>(profile, "meaning_themes").map((theme) => ({
      theme: stringOrNull(recordValue(theme, "theme")) ?? "family meaning",
      evidence: stringOrNull(recordValue(theme, "evidence"))
    })),
    symbols,
    design_rationale: stringArray(recordValue(profile, "design_rationale")),
    story_direction: stringOrNull(recordValue(profile, "story_direction")),
    certificate_direction: stringOrNull(recordValue(profile, "certificate_direction")),
    collection_content: safeContent
  };
}

export function buildCustomerPublicationText(deliverableCode: string, context: ArtifactContext): string {
  if (deliverableCode === "heritage_certificate_pdf") {
    return certificatePublicationText(context);
  }

  if (deliverableCode === "family_story_pdf") {
    return familyStoryPublicationText(context);
  }

  return meaningGuidePublicationText(context);
}

function certificatePublicationText(context: ArtifactContext): string {
  const recipient = context.recipient ?? context.house_name;
  const occasion = context.occasion ?? "A family milestone";
  const values = publicationValues(context);
  return [
    "MyKinLegacy",
    "Family Legacy Certificate",
    "",
    `Presented To: ${recipient}`,
    context.relationship ? `Relationship: ${context.relationship}` : "",
    `Created For: ${occasion}`,
    `Family Values: ${naturalList(values, "Love, unity, and legacy")}`,
    context.memories[0] ? `Personal Memory: ${context.memories[0]}` : "",
    "Crest: Final Crest",
    `Archive Number: ${context.order_number}`,
    `Date: ${formatPublicationDate(new Date())}`,
    "Signature: MyKinLegacy Legacy Curator",
    "Brand Seal: MyKinLegacy",
    "",
    "Ceremony Statement",
    ceremonyStatement(context),
    "",
    "Archive Authentication",
    `This certificate is recorded by MyKinLegacy under archive number ${context.order_number}.`,
    "",
    "Keepsake Note",
    "May it remain with the crest and family story as a lasting record of the life and values honored here."
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function ceremonyStatement(context: ArtifactContext): string {
  const recipient = context.recipient ?? context.house_name;
  const occasion = context.occasion ?? "this family milestone";
  const values = naturalList(publicationValues(context), "love, unity, and legacy").toLowerCase();
  const memory = recipientCenteredMemory(context);
  const memorySentence = memory ? ` ${memory}` : "";
  return `Presented to ${recipient} for ${occasion}, in recognition of ${values}.${memorySentence} May this certificate preserve the example and care honored by this family.`;
}

function familyStoryPublicationText(context: ArtifactContext): string {
  const recipient = context.recipient ?? context.house_name;
  const occasion = context.occasion ?? "this family milestone";
  const voice = recipientVoice(context.relationship, recipient);
  const values = naturalList(publicationValues(context), "love, unity, and legacy").toLowerCase();
  const memory = recipientCenteredMemory(context);
  const collectionStory = firstSentences(context.collection_content?.family_story ?? "", 4);
  const lifeHeading = storyLifeHeading(context, memory);
  return [
    "MyKinLegacy",
    "Family Story",
    `Recipient: ${recipient}`,
    context.relationship ? `Relationship: ${context.relationship}` : "",
    `Occasion: ${occasion}`,
    "",
    "Dedication",
    dedicationForOccasion(recipient, occasion, values),
    "",
    lifeHeading,
    memory || collectionStory || `${recipient} shaped family life through everyday choices that made care visible. ${capitalize(voice.subject)} offered ${voice.possessive} strengths without asking for recognition, and the family learned what ${values} looked like in practice.`,
    "",
    `What ${recipient} Gave the Family`,
    `${recipient}'s contribution lives in the security, warmth, and example the family received. ${capitalize(voice.possessive)} values were not abstract promises; they appeared in decisions, habits, and the way other people were made to feel seen and supported.`,
    "",
    "What the Family Carries Forward",
    `${capitalize(values)} now belong to the family as lived examples. What ${recipient} gave continues whenever the people shaped by ${voice.possessive} life keep promises, care for one another, and pass the same steadiness to the next generation.`,
    "",
    "Closing Letter",
    closingLetterForOccasion(recipient, occasion, values)
  ].filter(Boolean).join("\n");
}

function meaningGuidePublicationText(context: ArtifactContext): string {
  const recipient = context.recipient ?? context.house_name;
  const occasion = context.occasion ?? "this family milestone";
  const voice = recipientVoice(context.relationship, recipient);
  const values = naturalList(publicationValues(context), "love, unity, and legacy").toLowerCase();
  return [
    "MyKinLegacy",
    "Meaning Behind Your Crest",
    "",
    "The Shield",
    `The shield gives visible form to the care ${recipient} has placed around family. It is protective without being aggressive: a steady boundary shaped by ${values}. For ${occasion}, it recognizes the way ${voice.possessive} presence has helped others feel secure, supported, and able to move forward with confidence.`,
    "",
    "The Tree",
    `The tree represents the family life ${recipient} has helped nurture. Its trunk suggests character held steady, while its branches show the relationships and possibilities that grew around ${voice.object}. For this collection, the tree turns ${values} into a living image of shelter, continuity, and a future strengthened by ${voice.possessive} example.`,
    "",
    "The Knot",
    `The knot at the roots represents bonds formed through shared life rather than ceremony alone. Its interwoven lines acknowledge that duty, affection, memory, and family are connected in ${recipient}'s story. It honors the choices that held people together and gives ${occasion.toLowerCase()} a symbol of continuity that feels personal rather than formal.`,
    "",
    "The Key and Guiding Star",
    `The key and guiding star speak to what ${recipient} has opened for others and how ${voice.subject} has offered direction. The key suggests trust, opportunity, and a home that can be entered with confidence. The star reflects guidance through example, keeping ${voice.possessive} influence present beyond ${occasion.toLowerCase()} and into the family's next chapter.`,
    "",
    "The Laurel Frame",
    `The laurel frame marks ${occasion.toLowerCase()} with gratitude, not status. Its branches hold the crest together as a quiet recognition of ${values}. For ${recipient}, the laurel is the family's way of saying that ${voice.possessive} presence matters, ${voice.possessive} contribution is remembered, and the meaning represented here will continue.`
  ].join("\n");
}

interface RecipientVoice {
  subject: "he" | "she" | "they";
  object: "him" | "her" | "them";
  possessive: "his" | "her" | "their";
}

function recipientVoice(relationship: string | null, recipient: string): RecipientVoice {
  const evidence = `${relationship ?? ""} ${recipient}`.toLowerCase();
  if (/\b(mother|grandmother|wife|daughter|sister|aunt|woman|female)\b/.test(evidence)) {
    return { subject: "she", object: "her", possessive: "her" };
  }
  if (/\b(father|grandfather|husband|son|brother|uncle|man|male)\b/.test(evidence)) {
    return { subject: "he", object: "him", possessive: "his" };
  }
  return { subject: "they", object: "them", possessive: "their" };
}

function publicationValues(context: ArtifactContext): string[] {
  const direct = context.values.map(titleWords).filter(Boolean);
  if (direct.length > 0) return direct.slice(0, 3);
  return context.themes.map((theme) => titleWords(theme.theme)).filter(Boolean).slice(0, 3);
}

function recipientCenteredMemory(context: ArtifactContext): string | null {
  const recipient = context.recipient ?? context.house_name;
  const memory = firstSentences(context.memories[0] ?? "", 3);
  if (!memory) return null;
  return memory.replace(/^(?:he|she|they)\b/i, recipient);
}

function storyLifeHeading(context: ArtifactContext, memory: string | null): string {
  const occasion = context.occasion ?? "";
  if (/retirement/i.test(occasion) && /\b35\b|thirty-five/i.test(memory ?? "")) return "Thirty-Five Years of Quiet Strength";
  if (/retirement/i.test(occasion)) return "A Life of Steady Contribution";
  if (/christmas/i.test(occasion)) return "The Care at the Heart of Christmas";
  if (/wedding|anniversary/i.test(occasion)) return "A Family Story Beginning Together";
  if (/birthday/i.test(occasion)) return "A Life Worth Celebrating";
  return "A Life Held in Gratitude";
}

function dedicationForOccasion(recipient: string, occasion: string, values: string): string {
  if (/christmas/i.test(occasion)) {
    return `For ${recipient}, at Christmas, with gratitude for the care that turns a gathering into home. This story honors ${values} as they have been lived and shared within the family.`;
  }
  if (/wedding/i.test(occasion)) {
    return `For ${recipient}, on the occasion of a wedding and the beginning of a shared family chapter. This story honors ${values} as promises to carry forward together.`;
  }
  return `For ${recipient}, with gratitude on the occasion of ${occasion}. This story honors ${values} as qualities made visible through a life, a relationship, and the memories a family keeps.`;
}

function closingLetterForOccasion(recipient: string, occasion: string, values: string): string {
  if (/retirement/i.test(occasion)) {
    return `Dear ${recipient}, may retirement bring time to see how much your contribution has meant. The family carries your example forward with gratitude, and the ${values} you lived remain present in the way they care for one another.`;
  }
  if (/christmas/i.test(occasion)) {
    return `Dear ${recipient}, this Christmas, may you feel the gratitude held in this family. The ${values} you have shared are part of what brings everyone home to one another, and that gift will continue through every season ahead.`;
  }
  if (/wedding/i.test(occasion)) {
    return `Dear ${recipient}, may this wedding mark the beginning of a family life shaped by ${values}. What begins here can become a legacy through the promises you keep and the home you build together.`;
  }
  return `Dear ${recipient}, on ${occasion}, may this collection make the family's gratitude visible. The ${values} honored here remain part of what others recognize, remember, and carry forward with love.`;
}

function titleWords(value: string): string {
  return value.trim().replace(/\b\w/g, (character) => character.toUpperCase());
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
}

function firstSentences(value: string, count: number): string {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ")
    .trim();
}

function formatPublicationDate(value: Date): string {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function customerFileName(deliverableCode: string): string {
  const names: Record<string, string> = {
    heritage_certificate_pdf: "Heritage-Certificate.pdf",
    family_story_pdf: "Family-Story.pdf",
    symbol_explanation_pdf: "Meaning-Behind-Your-Crest.pdf",
    crest_variant_1_png: "Final-Crest.png",
    crest_variant_2_png: "Crest-Artwork-02.png",
    crest_variant_3_png: "Crest-Artwork-03.png",
    download_package_zip: "Complete-Collection-Archive.zip"
  };
  return names[deliverableCode] ?? `${deliverableCode}.${deliverableCode.endsWith("_png") ? "png" : "pdf"}`;
}

function archivePathForDeliverable(deliverableCode: string): string {
  const paths: Record<string, string> = {
    crest_variant_1_png: `${ZIP_ROOT}/01-Final-Crest/Final-Crest.png`,
    heritage_certificate_pdf: `${ZIP_ROOT}/02-Heritage-Certificate/Heritage-Certificate.pdf`,
    crest_variant_2_png: `${ZIP_ROOT}/_Internal-Crest-Variants/Crest-Artwork-02.png`,
    crest_variant_3_png: `${ZIP_ROOT}/_Internal-Crest-Variants/Crest-Artwork-03.png`,
    family_story_pdf: `${ZIP_ROOT}/03-Family-Story/Family-Story.pdf`,
    symbol_explanation_pdf: `${ZIP_ROOT}/04-Meaning-Behind-Your-Crest/Meaning-Behind-Your-Crest.pdf`
  };
  return paths[deliverableCode] ?? `${ZIP_ROOT}/${customerFileName(deliverableCode)}`;
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
  return "Family Keepsake";
}

function cleanDisplayName(value?: string | null): string | null {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  if (!cleaned || isUnsafeDisplayLabel(cleaned)) return null;
  return cleaned.slice(0, 80);
}

function isUnsafeDisplayLabel(value: string): boolean {
  return /^(unknown|null|undefined|n\/a|none)$/i.test(value) || /\bHouse of Unknown\b/i.test(value);
}

function sanitizeCollectionContent(
  content: ReturnType<typeof serializeCollectionContent> | null,
  safeFamilyName: string
): ReturnType<typeof serializeCollectionContent> | null {
  if (!content) return null;
  return {
    ...content,
    collection_name: sanitizeArtifactText(content.collection_name, safeFamilyName),
    family_display_name: sanitizeArtifactText(content.family_display_name, safeFamilyName),
    house_meaning_summary: sanitizeArtifactText(content.house_meaning_summary, safeFamilyName),
    symbol_guide: content.symbol_guide.map((symbol) => ({
      ...symbol,
      symbol: sanitizeArtifactText(symbol.symbol, safeFamilyName),
      meaning: sanitizeArtifactText(symbol.meaning, safeFamilyName),
      why_chosen: sanitizeArtifactText(symbol.why_chosen, safeFamilyName),
      customer_input_basis: sanitizeArtifactText(symbol.customer_input_basis, safeFamilyName),
      visual_role: sanitizeArtifactText(symbol.visual_role, safeFamilyName),
      artifact_role: sanitizeArtifactText(symbol.artifact_role, safeFamilyName),
      emotional_relevance: sanitizeArtifactText(symbol.emotional_relevance, safeFamilyName)
    })),
    family_story: sanitizeArtifactText(content.family_story, safeFamilyName),
    certificate_text: sanitizeArtifactText(content.certificate_text, safeFamilyName),
    collection_letter: sanitizeArtifactText(content.collection_letter, safeFamilyName),
    design_basis: sanitizeArtifactText(content.design_basis, safeFamilyName),
    share_caption: sanitizeArtifactText(content.share_caption, safeFamilyName),
    readme_note: sanitizeArtifactText(content.readme_note, safeFamilyName),
    boundary_statement: sanitizeArtifactText(content.boundary_statement, safeFamilyName)
  };
}

function sanitizeArtifactText<T extends string | null>(value: T, safeFamilyName: string): T {
  if (typeof value !== "string") return value;
  return value
    .replace(/\bHouse of Unknown\b/gi, safeFamilyName)
    .replace(/\bUnknown\b/g, "the family")
    .replace(/\bYour Family Legacy\b/gi, safeFamilyName)
    .replace(/\bPrivate family gift\b/gi, "family keepsake")
    .replace(/\bcustomer inputs?\b/gi, "family details")
    .replace(/\bcustomer selected\b/gi, "the family chose")
    .replace(/\bcustomer wording(?: included)?\b/gi, "the family memory")
    .replace(/\bmaps to\b/gi, "reflects")
    .replace(/\bsymbolic interpretation\b/gi, "personal meaning")
    .replace(/\bthis page is not\b/gi, "this page avoids")
    .replace(/\bRecorded at the time this collection was prepared\b/gi, "Prepared for this family occasion") as T;
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

function replaceMeaningAttachment(
  optionalAssets: OrchestrationManifest["optional_assets"],
  nextAttachment: Record<string, unknown>
): OrchestrationManifest["optional_assets"] {
  const withoutMeaning = optionalAssets.filter(
    (item) => !(isRecord(item) && item.attachment_type === "meaning_engine")
  );
  return [nextAttachment, ...withoutMeaning];
}

function existingMeaningCustomerInputs(manifest: OrchestrationManifest): Record<string, unknown> {
  const profile = recordObject(meaningAttachment(manifest), "meaning_profile");
  const customerInputs = recordObject(profile, "customer_inputs");
  return {
    recipient: recordValue(customerInputs, "recipient"),
    relationship: recordValue(customerInputs, "relationship"),
    occasion: recordValue(customerInputs, "occasion"),
    family_memories: recordValue(customerInputs, "memories")
  };
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
  const storedCustomerInputs = recordObject(orderInput?.input_json, "customer_inputs");
  const values = stringArray(recordValue(houseDna, "family_values"));
  const symbols = [
    ...stringArray(recordValue(houseDna, "symbols")),
    ...stringArray(recordValue(houseDna, "guardian_animals")),
    ...stringArray(recordValue(houseDna, "preferred_elements"))
  ];
  const colors = colorArray(recordValue(houseDna, "colors"));
  return {
    recipient: stringOrNull(recordValue(input.payload, "recipient"))
      ?? stringOrNull(recordValue(storedCustomerInputs, "recipient")),
    relationship: stringOrNull(recordValue(input.payload, "relationship"))
      ?? stringOrNull(recordValue(storedCustomerInputs, "relationship")),
    occasion: stringOrNull(recordValue(input.payload, "occasion"))
      ?? stringOrNull(recordValue(storedCustomerInputs, "occasion")),
    values,
    memories: firstNonEmptyStringArray(
      recordValue(input.payload, "family_memories"),
      recordValue(storedCustomerInputs, "family_memories")
    ),
    preferred_tone: [
      ...stringArray(recordValue(houseDna, "emotional_tone")),
      stringOrNull(recordValue(houseDna, "visual_style"))
    ].filter((value): value is string => Boolean(value)),
    symbols,
    colors,
    surname: stringOrNull(recordValue(houseDna, "surname")),
    house_name: stringOrNull(recordValue(houseDna, "house_name")),
    motto: stringOrNull(recordValue(houseDna, "motto")),
    order_number: input.order.order_number,
    source_level: orderInput ? "customer_confirmed" as const : "minimal" as const
  };
}

function createMeaningAttachment(input: Record<string, unknown>, now: Date): Record<string, unknown> {
  const meaningModule = loadMeaningEngine();
  return meaningModule.createMeaningManifestAttachment(input, now) as Record<string, unknown>;
}

function applySingleOrderLreTextIntegration(attachment: Record<string, unknown>, orderNumber: string): Record<string, unknown> {
  const allowlist = (process.env.LRE_PRODUCT_EXPERIENCE_ORDER_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowlist.includes(orderNumber)) return attachment;

  const content = isRecord(attachment.collection_content) ? attachment.collection_content : {};
  return {
    ...attachment,
    collection_content: {
      ...content,
      certificate_text: [
        stringOrNull(recordValue(content, "certificate_text")),
        "This private archive certificate is personal in authority: it reflects the family evidence provided for this order and does not claim public rank, official arms, or certified ancestry."
      ]
        .filter(Boolean)
        .join(" "),
      family_story: [
        "Nothing here asks the family to believe invented history; the story stays close to the values, memories, and symbols the family chose to preserve.",
        stringOrNull(recordValue(content, "family_story"))
      ]
        .filter(Boolean)
        .join(" "),
      share_caption:
        stringOrNull(recordValue(content, "share_caption")) ??
        "A private symbolic keepsake shaped around family meaning, made to be kept and shared only by choice.",
      readme_note: [
        stringOrNull(recordValue(content, "readme_note")),
        "This archive includes an LRE text pass for one controlled order. Payment, email, vault, and PNG generation were not changed."
      ]
        .filter(Boolean)
        .join(" "),
      lre_text_integration: {
        enabled: true,
        mode: "single_order_allowlist",
        png_generation_changed: false,
        payment_email_vault_changed: false
      }
    }
  };
}

function loadArtifactTooling(): ArtifactTooling {
  try {
    // Prefer source storage helpers during package-level tests before workspace dist outputs are rebuilt.
    const sourceBase = process.cwd().endsWith("packages\\database") || process.cwd().endsWith("packages/database")
      ? join(process.cwd(), "..")
      : join(process.cwd(), "packages");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storageSource = require(join(sourceBase, "storage/src/index.ts")) as Omit<ArtifactTooling, "buildSimplePdf">;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfPackage = require("@ai-heritage/pdf") as Pick<ArtifactTooling, "buildSimplePdf">;
    if (typeof storageSource.generateReadme === "function" && typeof storageSource.createMvpCrestPngBuffer === "function") {
      return {
        ...storageSource,
        buildSimplePdf: pdfPackage.buildSimplePdf
      };
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
    // Prefer source during package-level tests before workspace dist outputs are rebuilt.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../domain/src/meaning/rules.ts") as {
      createMeaningManifestAttachment(input: Record<string, unknown>, now: Date): unknown;
    };
  } catch {
    // Fall back to built workspace packages in production.
  }

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
    // Throw below.
  }
  throw new Error("meaning_engine_module_unavailable");
}

function meaningProfileSummary(manifest: OrchestrationManifest) {
  const attachment = manifest.optional_assets.find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  if (!isRecord(attachment)) return null;
  const profile = recordObject(attachment, "meaning_profile");
  return {
    source_level: stringOrNull(recordValue(profile, "source_level")),
    legacy_identity: recordObject(profile, "legacy_identity"),
    themes: recordArray<Record<string, unknown>>(profile, "meaning_themes").map((theme) => ({
      theme: stringOrNull(recordValue(theme, "theme")),
      confidence: stringOrNull(recordValue(theme, "confidence")),
      evidence: stringOrNull(recordValue(theme, "evidence")),
      why_inferred: stringOrNull(recordValue(theme, "why_inferred")),
      customer_input_basis: stringOrNull(recordValue(theme, "customer_input_basis")),
      artifact_effect: stringOrNull(recordValue(theme, "artifact_effect"))
    })),
    symbols: recordArray<Record<string, unknown>>(profile, "symbol_choices").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")),
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      rationale: stringOrNull(recordValue(symbol, "rationale")),
      source: stringOrNull(recordValue(symbol, "source")),
      customer_input_basis: stringOrNull(recordValue(symbol, "customer_input_basis")),
      visual_role: stringOrNull(recordValue(symbol, "visual_role")),
      artifact_role: stringOrNull(recordValue(symbol, "artifact_role")),
      emotional_purpose: stringOrNull(recordValue(symbol, "emotional_purpose"))
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
    artifact_content_version: stringOrNull(recordValue(content, "artifact_content_version")),
    collection_name: stringOrNull(recordValue(content, "collection_name")),
    family_display_name: stringOrNull(recordValue(content, "family_display_name")),
    house_meaning_summary: stringOrNull(recordValue(content, "house_meaning_summary")),
    symbol_guide: recordArray<Record<string, unknown>>(content, "symbol_guide").map((symbol) => ({
      symbol: stringOrNull(recordValue(symbol, "symbol")),
      meaning: stringOrNull(recordValue(symbol, "meaning")),
      why_chosen: stringOrNull(recordValue(symbol, "why_chosen")),
      customer_input_basis: stringOrNull(recordValue(symbol, "customer_input_basis")),
      visual_role: stringOrNull(recordValue(symbol, "visual_role")),
      artifact_role: stringOrNull(recordValue(symbol, "artifact_role")),
      emotional_relevance: stringOrNull(recordValue(symbol, "emotional_relevance"))
    })),
    family_story: stringOrNull(recordValue(content, "family_story")),
    certificate_text: stringOrNull(recordValue(content, "certificate_text")),
    collection_letter: stringOrNull(recordValue(content, "collection_letter")),
    design_basis: stringOrNull(recordValue(content, "design_basis")),
    share_caption: stringOrNull(recordValue(content, "share_caption")),
    readme_note: stringOrNull(recordValue(content, "readme_note")),
    lre_text_integration: recordObject(content, "lre_text_integration"),
    boundary_statement: stringOrNull(recordValue(content, "boundary_statement")),
    content_quality: recordObject(content, "content_quality")
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

function firstNonEmptyStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    const strings = stringArray(value);
    if (strings.length > 0) return strings;
  }
  return [];
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
