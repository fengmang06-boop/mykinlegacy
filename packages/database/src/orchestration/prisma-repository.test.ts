import { describe, expect, it, vi } from "vitest";

import { PrismaOrchestrationRepository } from "./prisma-repository";
import type { OrchestrationAsset } from "./types";

describe("PrismaOrchestrationRepository", () => {
  it("maps package deliverable codes to shared deliverable types without collapsing variants", async () => {
    const db = {
      asset: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => args.data)
      },
      assetDeliverableLink: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => args.data)
      },
      packageDeliverable: {
        findFirst: vi.fn(async (args: { where: { deliverableCode: string } }) => ({
          id: args.where.deliverableCode === "crest_variant_1_png" ? "package_deliverable_1" : "package_deliverable_2",
          deliverableTypeId: "deliverable_type_crest",
          deliverableType: { id: "deliverable_type_crest", code: "crest_variant_png" }
        }))
      },
      deliverableType: {
        findUnique: vi.fn()
      }
    };
    const repository = new PrismaOrchestrationRepository(db as never);

    await repository.createAsset(createAsset("crest_variant_1_png"));
    await repository.createAsset(createAsset("crest_variant_2_png"));

    expect(db.deliverableType.findUnique).not.toHaveBeenCalled();
    expect(db.asset.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        orderId: "order_1",
        assetDeliverableLinks: { some: { packageDeliverableId: "package_deliverable_1" } }
      }
    });
    expect(db.asset.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        orderId: "order_1",
        assetDeliverableLinks: { some: { packageDeliverableId: "package_deliverable_2" } }
      }
    });
    expect(db.assetDeliverableLink.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          packageDeliverableId: "package_deliverable_1",
          deliverableTypeId: "deliverable_type_crest"
        })
      })
    );
    expect(db.assetDeliverableLink.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          packageDeliverableId: "package_deliverable_2",
          deliverableTypeId: "deliverable_type_crest"
        })
      })
    );
  });

  it("returns package deliverable codes when listing assets for delivery completion", async () => {
    const db = {
      asset: {
        findMany: vi.fn(async () => [
          {
            ...createPrismaAsset("crest_variant_1_png"),
            deliverableType: { id: "deliverable_type_crest", code: "crest_variant_png" },
            assetDeliverableLinks: [
              {
                packageDeliverable: {
                  id: "package_deliverable_1",
                  deliverableCode: "crest_variant_1_png"
                }
              }
            ]
          }
        ])
      }
    };
    const repository = new PrismaOrchestrationRepository(db as never);

    const assets = await repository.listAssetsByOrder("order_1");

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      deliverable_code: "crest_variant_1_png",
      asset_type: "image",
      public_url: null
    });
  });
});

function createAsset(deliverableCode: string): OrchestrationAsset {
  return {
    id: `asset_${deliverableCode}`,
    order_id: "order_1",
    order_item_id: "order_item_1",
    generation_job_id: "generation_job_1",
    deliverable_code: deliverableCode,
    asset_type: "image",
    asset_kind: "generated",
    status: "available",
    storage_provider: "local_private",
    storage_bucket: "private-assets",
    storage_key: `orders/order_1/order_item_1/${deliverableCode}/asset.png`,
    file_name: `${deliverableCode}.png`,
    mime_type: "image/png",
    file_ext: "png",
    size_bytes: 100,
    checksum_sha256: "a".repeat(64),
    public_url: null,
    created_at: "2026-07-01T00:00:00.000Z"
  };
}

function createPrismaAsset(deliverableCode: string) {
  const asset = createAsset(deliverableCode);
  return {
    id: asset.id,
    orderId: asset.order_id,
    orderItemId: asset.order_item_id,
    generationJobId: asset.generation_job_id,
    deliverableTypeId: "deliverable_type_crest",
    assetType: asset.asset_type,
    assetKind: asset.asset_kind,
    status: asset.status,
    storageProvider: asset.storage_provider,
    storageBucket: asset.storage_bucket,
    storageKey: asset.storage_key,
    fileName: asset.file_name,
    mimeType: asset.mime_type,
    fileExt: asset.file_ext,
    sizeBytes: BigInt(asset.size_bytes),
    checksumSha256: asset.checksum_sha256,
    createdAt: new Date(asset.created_at)
  };
}
