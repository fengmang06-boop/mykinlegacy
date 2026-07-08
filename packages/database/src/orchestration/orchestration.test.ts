import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InMemoryOrchestrationRepository,
  REQUIRED_DELIVERABLES,
  getAdminDbVisibilitySummary,
  getOrderGenerationSummary,
  processOrderPaidOutbox,
  runManifestDrivenGeneration
} from "./index";
import type {
  OrchestrationOrder,
  OrchestrationOrderItem,
  OrchestrationOutboxEvent
} from "./types";

const now = new Date("2026-06-29T00:00:00.000Z");
const originalLocalStorageDir = process.env.LOCAL_STORAGE_DIR;
const originalLrePromptAllowlist = process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST;
const originalAiImageProvider = process.env.LRE_IMAGE_GENERATION_PROVIDER;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalOpenAiImageModel = process.env.OPENAI_IMAGE_MODEL;
const originalOpenAiImageSize = process.env.OPENAI_IMAGE_SIZE;
const originalOpenAiImageQuality = process.env.OPENAI_IMAGE_QUALITY;
const originalFetch = globalThis.fetch;
let localStorageDir = "";

describe("DB-backed orchestration foundation", () => {
  beforeEach(async () => {
    localStorageDir = await mkdtemp(join(tmpdir(), "mykinlegacy-orchestration-"));
    process.env.LOCAL_STORAGE_DIR = localStorageDir;
    delete process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST;
    delete process.env.LRE_IMAGE_GENERATION_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_SIZE;
    delete process.env.OPENAI_IMAGE_QUALITY;
    globalThis.fetch = originalFetch;
  });

  afterEach(async () => {
    process.env.LOCAL_STORAGE_DIR = originalLocalStorageDir;
    if (originalLrePromptAllowlist === undefined) {
      delete process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST;
    } else {
      process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST = originalLrePromptAllowlist;
    }
    restoreEnv("LRE_IMAGE_GENERATION_PROVIDER", originalAiImageProvider);
    restoreEnv("OPENAI_API_KEY", originalOpenAiApiKey);
    restoreEnv("OPENAI_IMAGE_MODEL", originalOpenAiImageModel);
    restoreEnv("OPENAI_IMAGE_SIZE", originalOpenAiImageSize);
    restoreEnv("OPENAI_IMAGE_QUALITY", originalOpenAiImageQuality);
    globalThis.fetch = originalFetch;
    await rm(localStorageDir, { recursive: true, force: true });
  });

  it("turns order.paid outbox into exactly one manifest and generation job", async () => {
    const repository = createRepository();
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");

    const first = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });
    const second = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(repository.manifests.size).toBe(1);
    expect(repository.generationJobs.size).toBe(1);
    expect(first.manifest.optional_assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attachment_type: "meaning_engine",
          meaning_profile: expect.objectContaining({
            source_level: "customer_confirmed",
            boundary_statement: expect.stringContaining("personalized symbolic keepsake")
          })
        })
      ])
    );
    expect(repository.outboxEvents.get("outbox_1")).toMatchObject({ status: "published" });
    expect(repository.orders.get("order_1")).toMatchObject({
      order_status: "processing",
      fulfillment_status: "queued"
    });
  });

  it("runs manifest-driven generation through assets and token before email-confirmed completion", async () => {
    const repository = createRepository();
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    expect(result.assets.map((asset) => asset.deliverable_code).sort()).toEqual(
      [...REQUIRED_DELIVERABLES].sort()
    );
    expect(result.assets.every((asset) => asset.public_url === null)).toBe(true);
    expect(result.assets.every((asset) => asset.status === "available")).toBe(true);
    expect(
      result.assets
        .filter((asset) => asset.file_ext === "png" || asset.file_ext === "pdf")
        .filter((asset) => asset.size_bytes <= 10 * 1024)
        .map((asset) => ({ deliverable_code: asset.deliverable_code, size_bytes: asset.size_bytes }))
    ).toEqual([]);
    expect(result.assets.every((asset) => asset.size_bytes !== 100)).toBe(true);
    const pdfAsset = result.assets.find((asset) => asset.deliverable_code === "family_story_pdf");
    const certificatePdfAsset = result.assets.find(
      (asset) => asset.deliverable_code === "heritage_certificate_pdf"
    );
    const symbolGuidePdfAsset = result.assets.find(
      (asset) => asset.deliverable_code === "symbol_explanation_pdf"
    );
    const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
    const zipAsset = result.assets.find((asset) => asset.deliverable_code === "download_package_zip");
    if (!certificatePdfAsset || !pdfAsset || !symbolGuidePdfAsset || !pngAsset || !zipAsset) {
      throw new Error("expected_artifacts_missing");
    }
    const certificateText = (await readStoredAsset(certificatePdfAsset)).toString("latin1");
    const pdfBody = await readStoredAsset(pdfAsset);
    const symbolGuidePdfBody = await readStoredAsset(symbolGuidePdfAsset);
    const symbolGuideText = symbolGuidePdfBody.toString("latin1");
    const pngBody = await readStoredAsset(pngAsset);
    const zipBody = await readStoredAsset(zipAsset);
    expect(pdfBody.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfBody.toString("latin1")).toContain("House of Alder");
    expect(pdfBody.toString("latin1")).toContain("Legacy, Designed.");
    expect(pdfBody.toString("latin1")).toContain("Prepared for:");
    expect(pdfBody.toString("latin1")).toContain("Family Story");
    expect(pdfBody.toString("latin1")).toContain("Memory and Legacy");
    expect(pdfBody.toString("latin1")).not.toContain("personalized symbolic keepsake");
    expect(certificateText).toContain("Collection Name");
    expect(certificateText).toContain("Recipient");
    expect(certificateText).toContain("Crest");
    expect(certificateText).toContain("Archive Number");
    expect(certificateText).toContain("Official Seal");
    expect(certificateText).toContain("Ceremony Statement");
    expect(certificateText).not.toContain("Meaning:");
    expect(certificateText).not.toContain("Family Story");
    expect(certificateText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(2);
    expect(pdfBody.toString("latin1")).not.toMatch(
      /proves your ancestry|official family crest|legally granted arms|noble bloodline/i
    );
    expect(pdfBody.toString("latin1")).not.toMatch(
      /House of Unknown|Certificate Text|Meaning Themes|Archive Reflection|undefined|null|raw json|placeholder/i
    );
    expect(symbolGuidePdfBody.subarray(0, 4).toString()).toBe("%PDF");
    expect(symbolGuidePdfBody.byteLength).toBeGreaterThan(10 * 1024);
    expect(symbolGuideText).toContain("pdf_layout_version=premium_v4");
    expect(symbolGuideText).toContain("Meaning:");
    expect(symbolGuideText).toContain("Why chosen:");
    expect(symbolGuideText).toContain("Emotional role:");
    expect(symbolGuideText).toContain("Relationship to family:");
    expect(symbolGuideText).not.toContain("Preservation and Sharing Note");
    expect(symbolGuideText).not.toContain("personalized symbolic keepsake");
    expect(symbolGuideText).not.toMatch(/House of Unknown|Unknown|undefined|null|raw json|debug|placeholder/i);
    expect(symbolGuideText.match(/Meaning:/g) ?? []).toHaveLength(
      new Set(
        result.manifest.optional_assets
          .flatMap((attachment) =>
            typeof attachment === "object" && attachment && "collection_content" in attachment
              ? ((attachment.collection_content as { symbol_guide?: Array<{ symbol?: string }> }).symbol_guide ?? [])
              : []
          )
          .map((symbol) => symbol.symbol)
      ).size
    );
    expect(pngBody.subarray(1, 4).toString()).toBe("PNG");
    expect(pngBody.byteLength).toBeGreaterThan(10 * 1024);
    expect(pngBody.readUInt32BE(16)).toBe(1254);
    expect(pngBody.readUInt32BE(20)).toBe(1254);
    expect(pngBody.toString("latin1")).toContain("artwork_template=shield_legacy_crest_v1");
    expect(pngBody.toString("latin1")).toContain("artwork_mode=recovered_official_asset");
    expect(pngBody.toString("latin1")).toContain("official_asset_id=01a-classic-shield-legacy");
    const pngBodies = await Promise.all(
      result.assets
        .filter((asset) => asset.file_ext === "png")
        .sort((a, b) => a.deliverable_code.localeCompare(b.deliverable_code))
        .map((asset) => readStoredAsset(asset))
    );
    expect(new Set(pngBodies.map((body) => body.toString("base64"))).size).toBe(3);
    for (const asset of result.assets.filter((item) => item.file_ext === "pdf")) {
      const body = await readStoredAsset(asset);
      const text = body.toString("latin1");
      expect(text).toContain("MyKinLegacy");
      expect(text).toContain("Legacy, Designed.");
      expect(text).not.toMatch(/House of Unknown|Unknown|undefined|null|raw json|debug|placeholder/i);
    }
    expect(zipBody.toString("latin1")).toContain("How to use this archive");
    expect(zipBody.toString("latin1")).toContain("Printing and keeping");
    expect(zipBody.toString("latin1")).toContain("Boundary statement");
    expect(zipBody.toString("latin1")).toContain("personalized symbolic keepsake");
    const zipEntries = listZipEntries(zipBody);
    expect(zipEntries[0]).toBe("MyKinLegacy-Private-Legacy-Collection/00-Welcome/Welcome.txt");
    expect(zipEntries).toEqual(
      expect.arrayContaining([
        "MyKinLegacy-Private-Legacy-Collection/00-Welcome/Welcome.txt",
        "MyKinLegacy-Private-Legacy-Collection/01-Certificate/Private-Archive-Certificate.pdf",
        "MyKinLegacy-Private-Legacy-Collection/02-Crest-Artwork/Crest-Artwork-01.png",
        "MyKinLegacy-Private-Legacy-Collection/02-Crest-Artwork/Crest-Artwork-02.png",
        "MyKinLegacy-Private-Legacy-Collection/02-Crest-Artwork/Crest-Artwork-03.png",
        "MyKinLegacy-Private-Legacy-Collection/03-Family-Story/Family-Story.pdf",
        "MyKinLegacy-Private-Legacy-Collection/04-Symbol-Guide/Symbol-Guide.pdf"
      ])
    );
    expect(zipEntries.join("\n")).not.toContain("Transparent-Crest-Artwork");
    expect(result.assets.map((asset) => asset.file_name)).toEqual(
      expect.arrayContaining([
        "Private-Archive-Certificate.pdf",
        "Family-Story.pdf",
        "Symbol-Guide.pdf",
        "Crest-Artwork-01.png",
        "Complete-Collection-Archive.zip"
      ])
    );
    expect(result.assets.map((asset) => asset.file_name).join("\n")).not.toMatch(/pdf\.pdf|png\.png/i);
    expect(result.manifest).toMatchObject({
      manifest_status: "completed",
      missing_required_assets: [],
      failed_assets: []
    });
    expect(repository.downloadTokens.size).toBe(1);
    expect(repository.emailLogs.size).toBe(0);
    expect(result.raw_token_for_email_only).toBeTruthy();
    expect(JSON.stringify([...repository.downloadTokens.values()])).not.toContain(
      result.raw_token_for_email_only
    );
    expect(repository.orders.get("order_1")).toMatchObject({
      order_status: "processing",
      fulfillment_status: "generating",
      completed_at: null
    });
  }, 15_000);

  it("uses the LRE prompt bridge for allowlisted manifest-driven PNG repair", async () => {
    const repository = createRepository();
    process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST = "AHL-20260629-ORCH";
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
    if (!pngAsset) throw new Error("png_asset_missing");
    const pngText = (await readStoredAsset(pngAsset)).toString("latin1");

    expect(pngText).toContain("prompt_source=lre_prompt");
    expect(pngText).toContain("pve_passed=true");
    expect(pngText).toMatch(/pve_score=(9[5-9]|100)\b/);
    expect(pngText).toMatch(/lre_prompt_sha256=[a-f0-9]{64}/);
    expect(pngText).toContain("selected_prompt=LRE Prompt Builder:");
    expect(pngText).toContain("Primary composition:");
  }, 15_000);

  it("uses a configured AI image provider for allowlisted LRE PNG artifacts", async () => {
    const repository = createRepository();
    process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST = "AHL-20260629-ORCH";
    process.env.LRE_IMAGE_GENERATION_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
    process.env.OPENAI_IMAGE_SIZE = "1024x1024";
    process.env.OPENAI_IMAGE_QUALITY = "high";
    const providerBody = createProviderTestPngBuffer({
      variant: "provider-ai-image",
      house_name: "Provider House",
      symbols: ["shield", "tree", "laurel"]
    });
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          id: "openai_image_test_1",
          data: [{ b64_json: providerBody.toString("base64") }]
        })
      }) as Response;

    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
    if (!pngAsset) throw new Error("png_asset_missing");
    const pngText = (await readStoredAsset(pngAsset)).toString("latin1");

    expect(pngText).toContain("artwork_mode=ai_image_provider");
    expect(pngText).toContain("prompt_source=lre_prompt");
    expect(pngText).toContain("image_provider=openai");
    expect(pngText).toContain("image_model=gpt-image-1");
    expect(pngText).toContain("provider_request_id=openai_image_test_1");
    expect(pngText).toContain("fallback_used=false");
  }, 15_000);

  it("falls back to the deterministic renderer when configured AI image generation fails", async () => {
    const repository = createRepository();
    process.env.LRE_IMAGE_PROMPT_ORDER_ALLOWLIST = "AHL-20260629-ORCH";
    process.env.LRE_IMAGE_GENERATION_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "provider unavailable" } })
      }) as Response;

    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
    if (!pngAsset) throw new Error("png_asset_missing");
    const pngText = (await readStoredAsset(pngAsset)).toString("latin1");

    expect(pngText).toContain("artwork_mode=recovered_official_asset");
    expect(pngText).toContain("official_asset_id=01a-classic-shield-legacy");
    expect(pngText).toContain("prompt_source=lre_prompt");
    expect(pngText).toContain("image_provider=openai");
    expect(pngText).toContain("fallback_used=true");
    expect(pngText).toContain("bridge_error=openai_image_http_500");
  }, 15_000);

  it("sanitizes unknown family labels before generating customer PDF artifacts", async () => {
    const repository = createRepository();
    const order = repository.orders.get("order_1");
    if (!order) throw new Error("missing_order");
    order.order_inputs = [
      {
        input_schema_version: "house_dna_snapshot.v1",
        input_json: {
          house_dna: {
            house_name: "House of Unknown",
            surname: "Unknown",
            family_values: ["unity"],
            symbols: ["shield", "tree", "knot"],
            colors: { primary: ["deep_navy", "gold", "ivory"] },
            emotional_tone: ["warm", "archival"],
            visual_style: "classic_heritage"
          }
        },
        normalized_input_json: {},
        locale: "en-US"
      }
    ];
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    const pdfAssets = result.assets.filter((asset) => asset.file_ext === "pdf");
    expect(pdfAssets).toHaveLength(3);
    for (const asset of pdfAssets) {
      const text = (await readStoredAsset(asset)).toString("latin1");
      expect(text).toContain("Your Family Legacy");
      expect(text).not.toMatch(/\bHouse of Unknown\b|\bUnknown\b/);
    }
  }, 15_000);

  it("applies LRE text to one allowlisted order without changing PNG generation", async () => {
    const originalAllowlist = process.env.LRE_PRODUCT_EXPERIENCE_ORDER_ALLOWLIST;
    process.env.LRE_PRODUCT_EXPERIENCE_ORDER_ALLOWLIST = "AHL-20260629-ORCH";
    try {
      const repository = createRepository();
      const outbox = repository.outboxEvents.get("outbox_1");
      if (!outbox) throw new Error("missing_outbox");
      const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

      const result = await runManifestDrivenGeneration({
        manifest_id: manifest.id,
        repository,
        now
      });

      const summary = await getOrderGenerationSummary({ order_id: "order_1", repository });
      expect(summary.generation_manifest?.collection_content).toMatchObject({
        lre_text_integration: expect.objectContaining({
          enabled: true,
          mode: "single_order_allowlist",
          png_generation_changed: false,
          payment_email_vault_changed: false
        }),
        share_caption: expect.stringContaining("private symbolic keepsake"),
        readme_note: expect.stringContaining("LRE text pass")
      });

      const certificateAsset = result.assets.find((asset) => asset.deliverable_code === "heritage_certificate_pdf");
      const familyStoryAsset = result.assets.find((asset) => asset.deliverable_code === "family_story_pdf");
      const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
      const zipAsset = result.assets.find((asset) => asset.deliverable_code === "download_package_zip");
      if (!certificateAsset || !familyStoryAsset || !pngAsset || !zipAsset) throw new Error("expected_artifacts_missing");

      const certificateText = (await readStoredAsset(certificateAsset)).toString("latin1");
      const familyStoryText = (await readStoredAsset(familyStoryAsset)).toString("latin1");
      const pngText = (await readStoredAsset(pngAsset)).toString("latin1");
      const zipText = (await readStoredAsset(zipAsset)).toString("latin1");

      expect(certificateText).toContain("Ceremony Statement");
      expect(certificateText).not.toContain("personal in authority");
      expect(familyStoryText).toContain("Nothing here asks the family to believe invented history");
      expect(zipText).toContain("This archive includes an LRE text pass");
      expect(pngText).toContain("artwork_template=shield_legacy_crest_v1");
      expect(pngText).toContain("artwork_mode=recovered_official_asset");
      expect(pngText).toContain("official_asset_id=01a-classic-shield-legacy");
      expect(pngText).not.toContain("LRE text pass");
    } finally {
      if (originalAllowlist === undefined) {
        delete process.env.LRE_PRODUCT_EXPERIENCE_ORDER_ALLOWLIST;
      } else {
        process.env.LRE_PRODUCT_EXPERIENCE_ORDER_ALLOWLIST = originalAllowlist;
      }
    }
  }, 15_000);

  it("returns safe customer order status without private fields", async () => {
    const repository = await completedRepository();
    const summary = await getOrderGenerationSummary({ order_id: "order_1", repository });
    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      payment_status: "paid",
      fulfillment_status: "completed",
      download_ready: true,
      friendly_progress_status: "download_ready"
    });
    expect(summary.generation_manifest).toMatchObject({
      expected_assets_count: REQUIRED_DELIVERABLES.length,
      generated_assets_count: REQUIRED_DELIVERABLES.length,
      failed_assets_count: 0,
      meaning_profile: {
        source_level: "customer_confirmed"
      },
      collection_content: {
        house_meaning_summary: expect.any(String),
        family_story: expect.any(String),
        certificate_text: expect.any(String),
        collection_letter: expect.any(String),
        design_basis: expect.any(String),
        boundary_statement: expect.stringContaining("not an official coat of arms")
      }
    });
    expect(serialized).not.toContain("storage_key");
    expect(serialized).not.toContain("rendered_prompt");
    expect(serialized).not.toContain("signed_url");
    expect(serialized).not.toContain("raw_token");
  }, 15_000);

  it("returns DB-backed admin summaries with masked storage keys", async () => {
    const repository = await completedRepository();
    const summary = await getAdminDbVisibilitySummary({ order_id: "order_1", repository });
    const serialized = JSON.stringify(summary);

    expect(summary.manifest).toMatchObject({
      manifest_status: "completed",
      meaning_profile: {
        source_level: "customer_confirmed"
      },
      collection_content: {
        house_meaning_summary: expect.any(String),
        symbol_guide: expect.any(Array)
      }
    });
    expect(summary.assets).toHaveLength(REQUIRED_DELIVERABLES.length);
    expect(summary.assets[0]?.masked_storage_key).toContain("***");
    expect(summary.download_token).toMatchObject({
      status: "active",
      token_hash_present: true
    });
    expect(summary.email_logs).toHaveLength(0);
    expect(serialized).not.toContain("raw_token");
    expect(serialized).not.toContain("signed_url");
    expect(serialized).not.toContain("rendered_prompt");
  }, 15_000);

  it("does not mark order completed before the worker confirms email delivery", async () => {
    const repository = createRepository();
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now
    });

    expect(repository.orders.get("order_1")).toMatchObject({
      order_status: "processing",
      fulfillment_status: "generating",
      completed_at: null
    });
  }, 15_000);

  it("repairs existing placeholder assets in place when generation is rerun", async () => {
    const repository = await completedRepository();
    const manifest = [...repository.manifests.values()][0];
    if (!manifest) throw new Error("missing_manifest");
    const original = [...repository.assets.values()].find(
      (asset) => asset.deliverable_code === "family_story_pdf"
    );
    if (!original) throw new Error("missing_family_story_asset");

    repository.assets.set(original.id, {
      ...original,
      size_bytes: 100,
      checksum_sha256: "0".repeat(64),
      storage_key: "orders/placeholder/family_story_pdf.pdf"
    });

    await runManifestDrivenGeneration({ manifest_id: manifest.id, repository, now });
    const repaired = repository.assets.get(original.id);

    expect(repaired?.id).toBe(original.id);
    expect(repaired?.deliverable_code).toBe("family_story_pdf");
    expect(repaired?.size_bytes).toBeGreaterThan(1024);
    expect(repaired?.storage_key).not.toBe("orders/placeholder/family_story_pdf.pdf");
    expect(repository.downloadTokens.size).toBeGreaterThanOrEqual(2);
  }, 15_000);
});

async function completedRepository() {
  const repository = createRepository();
  const outbox = repository.outboxEvents.get("outbox_1");
  if (!outbox) throw new Error("missing_outbox");
  const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });
  await runManifestDrivenGeneration({ manifest_id: manifest.id, repository, now });
  await repository.updateOrderStatus({
    order_id: "order_1",
    order_status: "completed",
    fulfillment_status: "completed",
    completed_at: now.toISOString()
  });
  return repository;
}

function createRepository() {
  const order: OrchestrationOrder = {
    id: "order_1",
    order_number: "AHL-20260629-ORCH",
    order_status: "paid",
    payment_status: "paid",
    fulfillment_status: "not_started",
    total_cents: 4900,
    currency: "USD",
    metadata_json: {
      house_id: "house_1",
      identity_version_id: "identity_version_1"
    },
    order_inputs: [
      {
        input_schema_version: "house_dna_snapshot.v1",
        input_json: {
          house_dna: {
            house_name: "House of Alder",
            surname: "Alder",
            family_values: ["protection", "resilience", "gratitude"],
            symbols: ["shield"],
            guardian_animals: ["lion"],
            colors: { primary: ["dark gold", "ivory"] },
            emotional_tone: ["warm", "dignified"],
            visual_style: "classic_heritage",
            motto: "Together through every season"
          }
        },
        normalized_input_json: {},
        locale: "en-US"
      }
    ],
    completed_at: null
  };
  const orderItem: OrchestrationOrderItem = {
    id: "order_item_1",
    order_id: order.id,
    product_id: "product_1",
    package_id: "package_1",
    product_code: "family_legacy_collection",
    package_code: "premium"
  };
  const outbox: OrchestrationOutboxEvent = {
    id: "outbox_1",
    event_type: "order.paid",
    aggregate_type: "order",
    aggregate_id: order.id,
    payload_json: {
      order_id: order.id,
      order_number: order.order_number,
      order_item_id: orderItem.id,
      house_id: "house_1",
      identity_version_id: "identity_version_1",
      product_code: orderItem.product_code,
      package_code: orderItem.package_code
    },
    status: "pending",
    attempts: 0,
    created_at: now.toISOString(),
    published_at: null
  };
  return new InMemoryOrchestrationRepository({
    orders: [order],
    orderItems: [orderItem],
    outboxEvents: [outbox]
  });
}

async function readStoredAsset(asset: { storage_bucket: string; storage_key: string }) {
  return readFile(join(localStorageDir, asset.storage_bucket, asset.storage_key));
}

function listZipEntries(buffer: Buffer): string[] {
  const entries: string[] = [];
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    entries.push(buffer.subarray(offset + 30, offset + 30 + fileNameLength).toString());
    offset += 30 + fileNameLength + extraLength + compressedSize;
  }
  return entries;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function createProviderTestPngBuffer(input: {
  variant: string;
  house_name: string;
  symbols: string[];
}): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require("node:fs") as { existsSync(path: string): boolean };
  const workspacePath = join(process.cwd(), "packages/storage/src/png.ts");
  const packagePath = join(process.cwd(), "../storage/src/png.ts");
  const sourcePath = existsSync(workspacePath) ? workspacePath : packagePath;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pngModule = require(sourcePath) as {
    createMvpCrestPngBuffer(input: {
      variant: string;
      house_name: string;
      symbols: string[];
    }): Buffer;
  };
  return pngModule.createMvpCrestPngBuffer(input);
}
