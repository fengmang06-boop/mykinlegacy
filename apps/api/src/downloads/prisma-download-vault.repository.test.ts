import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PrismaDownloadVaultRepository } from "./prisma-download-vault.repository";

describe("PrismaDownloadVaultRepository", () => {
  it("maps database download token and linked assets for vault access", async () => {
    const db = createFakeDownloadDb();
    const repository = new PrismaDownloadVaultRepository(db as never);
    const token = await repository.findTokenByHash(hash("raw-token"));
    const assets = await repository.listAssetsForToken("download_token_1");

    expect(token).toMatchObject({
      id: "download_token_1",
      order_id: "order_1",
      order_number: "AHL-20260629-TEST",
      status: "active"
    });
    expect(assets).toEqual([
      expect.objectContaining({
        asset_id: "asset_1",
        deliverable_code: "download_package_zip",
        friendly_name: "Complete Collection Archive",
        public_url: null
      })
    ]);
  });

  it("records download events without exposing storage keys", async () => {
    const db = createFakeDownloadDb();
    const repository = new PrismaDownloadVaultRepository(db as never);

    const event = await repository.createEvent({
      id: "event_1",
      download_token_id: "download_token_1",
      order_id: "order_1",
      asset_id: "asset_1",
      event_type: "signed_url_created",
      ip_hash: "ip_hash",
      user_agent_hash: "ua_hash",
      created_at: new Date("2026-06-29T00:00:00.000Z")
    });

    expect(event).toMatchObject({
      id: "event_1",
      event_type: "signed_url_created",
      asset_id: "asset_1"
    });
    expect(JSON.stringify(db.state.events)).not.toContain("storage_key");
  });

  it("maps meaning context from the linked order manifest", async () => {
    const db = createFakeDownloadDb();
    const repository = new PrismaDownloadVaultRepository(db as never);

    const context = await repository.getMeaningContextForToken("download_token_1");

    expect(context?.meaning_profile).toMatchObject({
      source_level: "customer_informed",
      themes: [expect.objectContaining({ theme: "Protection" })],
      symbols: [expect.objectContaining({ symbol: "Oak" })]
    });
    expect(context?.collection_content).toMatchObject({
      house_meaning_summary: "A private symbolic keepsake.",
      symbol_guide: [expect.objectContaining({ symbol: "Oak" })]
    });
    expect(JSON.stringify(context)).not.toContain("raw-token");
  });
});

function createFakeDownloadDb() {
  const state = {
    token: {
      id: "download_token_1",
      orderId: "order_1",
      tokenHash: hash("raw-token"),
      status: "active",
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
      maxDownloads: 20,
      downloadCount: 0,
      createdAt: new Date("2026-06-29T00:00:00.000Z"),
      revokedAt: null,
      order: {
        orderNumber: "AHL-20260629-TEST",
        generationManifests: [
          {
            optionalAssetsJson: [
              {
                attachment_type: "meaning_engine",
                meaning_profile: {
                  source_level: "customer_informed",
                  meaning_themes: [{ theme: "Protection", confidence: "high", evidence: "Input." }],
                  symbol_choices: [
                    { symbol: "Oak", meaning: "Strength", rationale: "Chosen from values.", source: "internal" }
                  ],
                  design_rationale: ["Grounded composition."],
                  story_direction: "A story about care.",
                  certificate_direction: "Warm and archival.",
                  boundary_statement: "Not official arms.",
                  validation: { valid: true, quality_flags: [], banned_claims_found: [] }
                },
                collection_content: {
                  house_meaning_summary: "A private symbolic keepsake.",
                  symbol_guide: [
                    {
                      symbol: "Oak",
                      meaning: "Strength",
                      why_chosen: "Protection",
                      emotional_relevance: "Steady family anchor"
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    },
    asset: {
      id: "asset_1",
      orderId: "order_1",
      deliverableTypeId: "deliverable_1",
      assetType: "archive",
      status: "available",
      storageProvider: "local_private",
      storageBucket: "private-assets",
      storageKey: "orders/order_1/download_package_zip.zip",
      fileName: "download_package_zip.zip",
      mimeType: "application/zip",
      fileExt: "zip",
      sizeBytes: 1024n,
      deletedAt: null,
      deliverableType: { code: "download_package_zip" }
    },
    events: [] as unknown[]
  };

  return {
    state,
    downloadToken: {
      findUnique: async () => state.token,
      create: async (args: unknown) => ({
        ...((args as { data: Record<string, unknown> }).data),
        order: state.token.order
      }),
      update: async (args: unknown) => {
        Object.assign(state.token, (args as { data: unknown }).data);
        return state.token;
      }
    },
    downloadTokenAsset: {
      findMany: async () => [{ downloadTokenId: "download_token_1", assetId: "asset_1", asset: state.asset }],
      findFirst: async () => ({ downloadTokenId: "download_token_1", assetId: "asset_1", asset: state.asset }),
      create: async (args: unknown) => (args as { data: unknown }).data
    },
    asset: {
      findUnique: async () => state.asset,
      findFirst: async () => state.asset,
      findMany: async () => [state.asset],
      create: async (args: unknown) => (args as { data: unknown }).data,
      update: async (args: unknown) => (args as { data: unknown }).data
    },
    downloadEvent: {
      create: async (args: unknown) => {
        const data = (args as { data: unknown }).data;
        state.events.push(data);
        return data;
      }
    }
  };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
