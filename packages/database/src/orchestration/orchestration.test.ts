import { describe, expect, it } from "vitest";

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

describe("DB-backed orchestration foundation", () => {
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

  it("runs manifest-driven generation through assets, token, email, and order completion", async () => {
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
    expect(result.manifest).toMatchObject({
      manifest_status: "completed",
      missing_required_assets: [],
      failed_assets: []
    });
    expect(repository.downloadTokens.size).toBe(1);
    expect(repository.emailLogs.size).toBe(1);
    expect(result.raw_token_for_email_only).toBeTruthy();
    expect(JSON.stringify([...repository.downloadTokens.values()])).not.toContain(
      result.raw_token_for_email_only
    );
    expect(JSON.stringify([...repository.emailLogs.values()])).not.toContain(
      result.raw_token_for_email_only
    );
    expect(repository.orders.get("order_1")).toMatchObject({
      order_status: "completed",
      fulfillment_status: "completed",
      completed_at: now.toISOString()
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
      }
    });
    expect(summary.assets).toHaveLength(REQUIRED_DELIVERABLES.length);
    expect(summary.assets[0]?.masked_storage_key).toContain("***");
    expect(summary.download_token).toMatchObject({
      status: "active",
      token_hash_present: true
    });
    expect(summary.email_logs[0]).toMatchObject({ status: "sent" });
    expect(serialized).not.toContain("raw_token");
    expect(serialized).not.toContain("signed_url");
    expect(serialized).not.toContain("rendered_prompt");
  });

  it("email failure does not mark order failed after manifest completion", async () => {
    const repository = createRepository();
    const outbox = repository.outboxEvents.get("outbox_1");
    if (!outbox) throw new Error("missing_outbox");
    const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });

    const result = await runManifestDrivenGeneration({
      manifest_id: manifest.id,
      repository,
      now,
      failEmail: true
    });

    expect(result.email_log.status).toBe("failed");
    expect(repository.orders.get("order_1")).toMatchObject({
      order_status: "completed",
      fulfillment_status: "completed"
    });
  });
});

async function completedRepository() {
  const repository = createRepository();
  const outbox = repository.outboxEvents.get("outbox_1");
  if (!outbox) throw new Error("missing_outbox");
  const { manifest } = await processOrderPaidOutbox({ outboxEvent: outbox, repository, now });
  await runManifestDrivenGeneration({ manifest_id: manifest.id, repository, now });
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
