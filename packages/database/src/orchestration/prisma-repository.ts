import { ulid } from "ulid";

import type {
  ExpectedAssetContract,
  FailedAssetContract,
  GeneratedAssetContract,
  OrchestrationAsset,
  OrchestrationDownloadToken,
  OrchestrationEmailLog,
  OrchestrationGenerationJob,
  OrchestrationManifest,
  OrchestrationOrder,
  OrchestrationOrderItem,
  OrchestrationRepository
} from "./types";

type PrismaDelegate = {
  findUnique(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
};

type PrismaOrchestrationClient = {
  order: PrismaDelegate;
  orderItem: PrismaDelegate;
  generationManifest: PrismaDelegate;
  generationJob: PrismaDelegate;
  asset: PrismaDelegate;
  assetDeliverableLink: PrismaDelegate;
  packageDeliverable: PrismaDelegate;
  deliverableType: PrismaDelegate;
  downloadToken: PrismaDelegate;
  downloadTokenAsset: PrismaDelegate;
  emailLog: PrismaDelegate;
  outboxEvent: PrismaDelegate;
};

export class PrismaOrchestrationRepository implements OrchestrationRepository {
  constructor(private readonly db: PrismaOrchestrationClient) {}

  async findOrder(orderId: string): Promise<OrchestrationOrder | null> {
    const row = await this.db.order.findUnique({ where: { id: orderId } });
    return row ? mapOrder(row) : null;
  }

  async findOrderItem(orderItemId: string): Promise<OrchestrationOrderItem | null> {
    const row = await this.db.orderItem.findUnique({
      where: { id: orderItemId },
      include: { product: true, package: true }
    });
    return row ? mapOrderItem(row) : null;
  }

  async listOrderItemsByOrder(orderId?: string): Promise<OrchestrationOrderItem[]> {
    const rows = await this.db.orderItem.findMany({
      where: orderId ? { orderId } : undefined,
      include: { product: true, package: true }
    });
    return rows.map(mapOrderItem);
  }

  async findManifestById(manifestId: string): Promise<OrchestrationManifest | null> {
    const row = await this.db.generationManifest.findUnique({ where: { id: manifestId } });
    return row ? mapManifest(row) : null;
  }

  async findManifestByOrderItem(
    orderId: string,
    orderItemId: string
  ): Promise<OrchestrationManifest | null> {
    const row = await this.db.generationManifest.findFirst({ where: { orderId, orderItemId } });
    return row ? mapManifest(row) : null;
  }

  async createManifest(input: OrchestrationManifest): Promise<OrchestrationManifest> {
    const existing = await this.findManifestByOrderItem(input.order_id, input.order_item_id);
    if (existing) return existing;
    const row = await this.db.generationManifest.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        orderItemId: input.order_item_id,
        generationJobId: input.generation_job_id,
        houseId: input.house_id,
        identityVersionId: input.identity_version_id,
        productCode: input.product_code,
        packageCode: input.package_code,
        expectedAssetsJson: input.expected_assets,
        generatedAssetsJson: input.generated_assets,
        missingRequiredAssets: input.missing_required_assets,
        optionalAssetsJson: input.optional_assets,
        failedAssetsJson: input.failed_assets,
        status: input.manifest_status,
        createdAt: new Date(input.created_at),
        updatedAt: new Date(input.updated_at),
        completedAt: input.completed_at ? new Date(input.completed_at) : null
      }
    });
    return mapManifest(row);
  }

  async updateManifest(input: OrchestrationManifest): Promise<OrchestrationManifest> {
    const row = await this.db.generationManifest.update({
      where: { id: input.id },
      data: {
        generatedAssetsJson: input.generated_assets,
        missingRequiredAssets: input.missing_required_assets,
        optionalAssetsJson: input.optional_assets,
        failedAssetsJson: input.failed_assets,
        status: input.manifest_status,
        updatedAt: new Date(input.updated_at),
        completedAt: input.completed_at ? new Date(input.completed_at) : null
      }
    });
    return mapManifest(row);
  }

  async findGenerationJobByOrderItem(
    orderId: string,
    orderItemId: string
  ): Promise<OrchestrationGenerationJob | null> {
    const row = await this.db.generationJob.findFirst({ where: { orderId, orderItemId } });
    return row ? mapGenerationJob(row) : null;
  }

  async createGenerationJob(
    input: OrchestrationGenerationJob
  ): Promise<OrchestrationGenerationJob> {
    const existing = await this.findGenerationJobByOrderItem(input.order_id, input.order_item_id);
    if (existing) return existing;
    const row = await this.db.generationJob.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        orderItemId: input.order_item_id,
        productId: input.product_id,
        status: input.status,
        priority: 0,
        attempts: input.attempts,
        maxAttempts: input.max_attempts,
        createdAt: new Date(input.created_at),
        updatedAt: new Date(input.updated_at)
      }
    });
    return mapGenerationJob(row);
  }

  async updateGenerationJob(
    input: OrchestrationGenerationJob
  ): Promise<OrchestrationGenerationJob> {
    const row = await this.db.generationJob.update({
      where: { id: input.id },
      data: {
        status: input.status,
        attempts: input.attempts,
        maxAttempts: input.max_attempts,
        updatedAt: new Date(input.updated_at),
        completedAt: input.status === "completed" ? new Date(input.updated_at) : undefined
      }
    });
    return mapGenerationJob(row);
  }

  async createAsset(input: OrchestrationAsset): Promise<OrchestrationAsset> {
    const deliverable = await this.findDeliverableForAsset(input);
    const existing = deliverable.packageDeliverableId
      ? await this.db.asset.findFirst({
          where: {
            orderId: input.order_id,
            assetDeliverableLinks: { some: { packageDeliverableId: deliverable.packageDeliverableId } }
          }
        })
      : await this.db.asset.findFirst({
          where: { orderId: input.order_id, deliverableTypeId: deliverable.deliverableTypeId }
        });
    if (existing) return mapAsset(existing, input.deliverable_code);

    const row = await this.db.asset.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        orderItemId: input.order_item_id,
        generationJobId: input.generation_job_id,
        deliverableTypeId: deliverable.deliverableTypeId,
        assetType: input.asset_type,
        assetKind: input.asset_kind,
        status: input.status,
        storageProvider: input.storage_provider,
        storageBucket: input.storage_bucket,
        storageKey: input.storage_key,
        fileName: input.file_name,
        mimeType: input.mime_type,
        fileExt: input.file_ext,
        sizeBytes: BigInt(input.size_bytes),
        checksumSha256: input.checksum_sha256,
        createdAt: new Date(input.created_at),
        updatedAt: new Date(input.created_at)
      }
    });
    await this.db.assetDeliverableLink.create({
      data: {
        id: ulid(),
        assetId: recordString(row, "id"),
        packageDeliverableId: deliverable.packageDeliverableId,
        deliverableTypeId: deliverable.deliverableTypeId,
        createdAt: new Date(input.created_at)
      }
    });
    return mapAsset(row, input.deliverable_code);
  }

  async listAssetsByOrder(orderId: string): Promise<OrchestrationAsset[]> {
    const rows = await this.db.asset.findMany({
      where: { orderId },
      include: {
        deliverableType: true,
        assetDeliverableLinks: { include: { packageDeliverable: true } }
      }
    });
    return rows.map((row) => mapAsset(row));
  }

  async createDownloadToken(
    input: OrchestrationDownloadToken
  ): Promise<OrchestrationDownloadToken> {
    const existing = await this.findDownloadTokenByOrder(input.order_id);
    if (existing) return existing;
    const row = await this.db.downloadToken.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        tokenHash: input.token_hash,
        status: input.status,
        expiresAt: new Date(input.expires_at),
        maxDownloads: input.max_downloads,
        downloadCount: input.download_count,
        createdBy: "system",
        createdAt: new Date(input.created_at)
      }
    });
    for (const assetId of input.asset_ids) {
      await this.db.downloadTokenAsset.create({
        data: { id: ulid(), downloadTokenId: input.id, assetId, createdAt: new Date(input.created_at) }
      });
    }
    return mapDownloadToken(row, input.asset_ids);
  }

  async findDownloadTokenByOrder(orderId: string): Promise<OrchestrationDownloadToken | null> {
    const row = await this.db.downloadToken.findFirst({
      where: { orderId },
      include: { downloadTokenAssets: true }
    });
    return row ? mapDownloadToken(row) : null;
  }

  async createEmailLog(input: OrchestrationEmailLog): Promise<OrchestrationEmailLog> {
    const existing = await this.db.emailLog.findFirst({
      where: {
        orderId: input.order_id,
        provider: input.provider,
        payloadJson: { path: ["download_token_id"], equals: input.payload_json.download_token_id }
      }
    });
    if (existing) return mapEmailLog(existing);
    const row = await this.db.emailLog.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        provider: input.provider,
        recipientEmailHash: input.recipient_email_hash,
        status: input.status,
        payloadJson: input.payload_json,
        createdAt: new Date(input.created_at),
        sentAt: input.sent_at ? new Date(input.sent_at) : null
      }
    });
    return mapEmailLog(row);
  }

  async listEmailLogsByOrder(orderId: string): Promise<OrchestrationEmailLog[]> {
    const rows = await this.db.emailLog.findMany({ where: { orderId } });
    return rows.map(mapEmailLog);
  }

  async updateOrderStatus(input: {
    order_id: string;
    order_status?: string;
    fulfillment_status?: string;
    completed_at?: string | null;
  }): Promise<OrchestrationOrder> {
    const row = await this.db.order.update({
      where: { id: input.order_id },
      data: {
        orderStatus: input.order_status,
        fulfillmentStatus: input.fulfillment_status,
        completedAt: input.completed_at === undefined ? undefined : input.completed_at ? new Date(input.completed_at) : null,
        updatedAt: new Date()
      }
    });
    return mapOrder(row);
  }

  async markOutboxPublished(outboxEventId: string, nowIso: string): Promise<void> {
    await this.db.outboxEvent.update({
      where: { id: outboxEventId },
      data: { status: "published", publishedAt: new Date(nowIso) }
    });
  }

  private async findDeliverableForAsset(input: OrchestrationAsset): Promise<{
    deliverableTypeId: string;
    packageDeliverableId: string | null;
  }> {
    const packageDeliverable = await this.db.packageDeliverable.findFirst({
      where: {
        deliverableCode: input.deliverable_code,
        package: { orderItems: { some: { id: input.order_item_id } } }
      },
      include: { deliverableType: true }
    });
    if (packageDeliverable) {
      return {
        deliverableTypeId: recordString(packageDeliverable, "deliverableTypeId"),
        packageDeliverableId: recordString(packageDeliverable, "id")
      };
    }

    const deliverableType = await this.findDeliverableType(input.deliverable_code);
    return {
      deliverableTypeId: deliverableType.id,
      packageDeliverableId: null
    };
  }

  private async findDeliverableType(deliverableCode: string): Promise<{ id: string; code: string }> {
    const row = await this.db.deliverableType.findUnique({ where: { code: deliverableCode } });
    if (!row) throw new Error(`deliverable_type_not_found:${deliverableCode}`);
    return { id: recordString(row, "id"), code: recordString(row, "code") };
  }
}

function mapOrder(row: unknown): OrchestrationOrder {
  return {
    id: recordString(row, "id"),
    order_number: recordString(row, "orderNumber"),
    order_status: recordString(row, "orderStatus"),
    payment_status: recordString(row, "paymentStatus"),
    fulfillment_status: recordString(row, "fulfillmentStatus"),
    total_cents: Number(recordValue(row, "totalCents")),
    currency: recordString(row, "currency"),
    metadata_json: recordJson(row, "metadataJson"),
    completed_at: isoOrNull(recordValue(row, "completedAt"))
  };
}

function mapOrderItem(row: unknown): OrchestrationOrderItem {
  const snapshot = recordJson(row, "productSnapshotJson");
  const product = recordObject(row, "product");
  const productPackage = recordObject(row, "package");
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    product_id: recordString(row, "productId"),
    package_id: recordString(row, "packageId"),
    product_code: stringFromRecord(snapshot, "product_code") ?? stringFromRecord(product, "code") ?? "unknown_product",
    package_code: stringFromRecord(snapshot, "package_code") ?? stringFromRecord(productPackage, "code") ?? "unknown_package"
  };
}

function mapManifest(row: unknown): OrchestrationManifest {
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    order_item_id: recordString(row, "orderItemId"),
    generation_job_id: recordStringOrNull(row, "generationJobId"),
    house_id: recordStringOrNull(row, "houseId"),
    identity_version_id: recordStringOrNull(row, "identityVersionId"),
    product_code: recordString(row, "productCode"),
    package_code: recordString(row, "packageCode"),
    expected_assets: recordArray<ExpectedAssetContract>(row, "expectedAssetsJson"),
    generated_assets: recordArray<GeneratedAssetContract>(row, "generatedAssetsJson"),
    missing_required_assets: recordArray<string>(row, "missingRequiredAssets"),
    optional_assets: recordArray<string>(row, "optionalAssetsJson"),
    failed_assets: recordArray<FailedAssetContract>(row, "failedAssetsJson"),
    manifest_status: recordString(row, "status") as OrchestrationManifest["manifest_status"],
    created_at: iso(recordValue(row, "createdAt")),
    updated_at: iso(recordValue(row, "updatedAt")),
    completed_at: isoOrNull(recordValue(row, "completedAt"))
  };
}

function mapGenerationJob(row: unknown): OrchestrationGenerationJob {
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    order_item_id: recordString(row, "orderItemId"),
    product_id: recordString(row, "productId"),
    status: recordString(row, "status") as OrchestrationGenerationJob["status"],
    attempts: Number(recordValue(row, "attempts")),
    max_attempts: Number(recordValue(row, "maxAttempts")),
    created_at: iso(recordValue(row, "createdAt")),
    updated_at: iso(recordValue(row, "updatedAt"))
  };
}

function mapAsset(row: unknown, deliverableCode?: string): OrchestrationAsset {
  const deliverableType = recordObject(row, "deliverableType");
  const deliverableLinks = recordArray<Record<string, unknown>>(row, "assetDeliverableLinks");
  const packageDeliverable = deliverableLinks
    .map((link) => recordObject(link, "packageDeliverable"))
    .find((item) => stringFromRecord(item, "deliverableCode"));
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    order_item_id: recordStringOrNull(row, "orderItemId") ?? "order_item_missing",
    generation_job_id: recordStringOrNull(row, "generationJobId") ?? "generation_job_missing",
    deliverable_code:
      deliverableCode ??
      stringFromRecord(packageDeliverable ?? {}, "deliverableCode") ??
      stringFromRecord(deliverableType, "code") ??
      recordString(row, "deliverableTypeId"),
    asset_type: recordString(row, "assetType") as OrchestrationAsset["asset_type"],
    asset_kind: recordString(row, "assetKind") as OrchestrationAsset["asset_kind"],
    status: recordString(row, "status") as OrchestrationAsset["status"],
    storage_provider: recordString(row, "storageProvider") as OrchestrationAsset["storage_provider"],
    storage_bucket: recordString(row, "storageBucket"),
    storage_key: recordString(row, "storageKey"),
    file_name: recordString(row, "fileName"),
    mime_type: recordString(row, "mimeType"),
    file_ext: recordString(row, "fileExt"),
    size_bytes: Number(recordValue(row, "sizeBytes")),
    checksum_sha256: recordStringOrNull(row, "checksumSha256") ?? "",
    public_url: null,
    created_at: iso(recordValue(row, "createdAt"))
  };
}

function mapDownloadToken(row: unknown, assetIds?: string[]): OrchestrationDownloadToken {
  const links = recordArray<Record<string, unknown>>(row, "downloadTokenAssets");
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    token_hash: recordString(row, "tokenHash"),
    status: recordString(row, "status") as OrchestrationDownloadToken["status"],
    expires_at: iso(recordValue(row, "expiresAt")),
    max_downloads: Number(recordValue(row, "maxDownloads") ?? 0),
    download_count: Number(recordValue(row, "downloadCount")),
    asset_ids: assetIds ?? links.map((link) => recordString(link, "assetId")),
    created_at: iso(recordValue(row, "createdAt"))
  };
}

function mapEmailLog(row: unknown): OrchestrationEmailLog {
  return {
    id: recordString(row, "id"),
    order_id: recordStringOrNull(row, "orderId") ?? "",
    provider: recordString(row, "provider") as "mock",
    recipient_email_hash: recordString(row, "recipientEmailHash"),
    status: recordString(row, "status") as OrchestrationEmailLog["status"],
    payload_json: recordJson(row, "payloadJson"),
    created_at: iso(recordValue(row, "createdAt")),
    sent_at: isoOrNull(recordValue(row, "sentAt"))
  };
}

function recordObject(row: unknown, key: string): Record<string, unknown> {
  const value = recordValue(row, key);
  return isRecord(value) ? value : {};
}

function recordJson(row: unknown, key: string): Record<string, unknown> {
  const value = recordValue(row, key);
  return isRecord(value) ? value : {};
}

function recordArray<T>(row: unknown, key: string): T[] {
  const value = recordValue(row, key);
  return Array.isArray(value) ? (value as T[]) : [];
}

function recordString(row: unknown, key: string): string {
  const value = recordValue(row, key);
  if (typeof value !== "string") throw new Error(`missing_string:${key}`);
  return value;
}

function recordStringOrNull(row: unknown, key: string): string | null {
  const value = recordValue(row, key);
  return typeof value === "string" ? value : null;
}

function stringFromRecord(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function recordValue(row: unknown, key: string): unknown {
  if (!isRecord(row)) throw new Error("invalid_prisma_record");
  return row[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new Error("invalid_date");
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return iso(value);
}
