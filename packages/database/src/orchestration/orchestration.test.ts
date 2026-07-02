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
let localStorageDir = "";

describe("DB-backed orchestration foundation", () => {
  beforeEach(async () => {
    localStorageDir = await mkdtemp(join(tmpdir(), "mykinlegacy-orchestration-"));
    process.env.LOCAL_STORAGE_DIR = localStorageDir;
  });

  afterEach(async () => {
    process.env.LOCAL_STORAGE_DIR = originalLocalStorageDir;
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
    const pngAsset = result.assets.find((asset) => asset.deliverable_code === "crest_variant_1_png");
    const zipAsset = result.assets.find((asset) => asset.deliverable_code === "download_package_zip");
    if (!pdfAsset || !pngAsset || !zipAsset) throw new Error("expected_artifacts_missing");
    const pdfBody = await readStoredAsset(pdfAsset);
    const pngBody = await readStoredAsset(pngAsset);
    const zipBody = await readStoredAsset(zipAsset);
    expect(pdfBody.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfBody.toString("latin1")).toContain("House of Alder");
    expect(pdfBody.toString("latin1")).toContain("private symbolic keepsake");
    expect(pdfBody.toString("latin1")).not.toMatch(
      /proves your ancestry|official family crest|legally granted arms|noble bloodline/i
    );
    expect(pngBody.subarray(1, 4).toString()).toBe("PNG");
    expect(listZipEntries(zipBody)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("family-story-pdf.pdf"),
        expect.stringContaining("crest-variant-1-png.png"),
        "read-me/read-me.txt"
      ])
    );
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
  });

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
  });

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
  });

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
  });

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
  });
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
