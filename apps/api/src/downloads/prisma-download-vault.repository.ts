import { ulid } from "ulid";

type DownloadTokenStatus = "active" | "expired" | "revoked";
type DownloadEventType = "page_view" | "file_download" | "signed_url_created" | "denied";

interface DownloadAssetRecord {
  asset_id: string;
  order_id: string;
  deliverable_code: string;
  friendly_name: string;
  asset_type: "image" | "pdf" | "archive" | "preview";
  file_ext: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  storage_provider: string;
  storage_bucket: string;
  storage_key: string;
  public_url: null;
  deleted_at?: Date | null;
}

interface DownloadTokenRecord {
  id: string;
  order_id: string;
  order_number: string;
  token_hash: string;
  status: DownloadTokenStatus;
  expires_at: Date;
  max_downloads: number;
  download_count: number;
  created_at: Date;
  revoked_at: Date | null;
}

interface DownloadEventRecord {
  id: string;
  download_token_id: string;
  order_id: string;
  asset_id: string | null;
  event_type: DownloadEventType;
  ip_hash: string | null;
  user_agent_hash: string | null;
  created_at: Date;
}

interface DownloadVaultRepository {
  createToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord>;
  findTokenByHash(tokenHash: string): Promise<DownloadTokenRecord | null>;
  updateToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord>;
  linkTokenToAssets(input: { download_token_id: string; asset_ids: string[] }): Promise<void>;
  listAssetsForToken(downloadTokenId: string): Promise<DownloadAssetRecord[]>;
  findLinkedAsset(input: {
    download_token_id: string;
    asset_id: string;
  }): Promise<DownloadAssetRecord | null>;
  createEvent(input: DownloadEventRecord): Promise<DownloadEventRecord>;
}

type PrismaDelegate = {
  findUnique(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
};

type PrismaDownloadClient = {
  downloadToken: PrismaDelegate;
  downloadTokenAsset: PrismaDelegate;
  asset: PrismaDelegate;
  downloadEvent: PrismaDelegate;
};

export class PrismaDownloadVaultRepository implements DownloadVaultRepository {
  constructor(private readonly db: PrismaDownloadClient) {}

  async createToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord> {
    const existing = await this.findTokenByHash(input.token_hash);
    if (existing) return existing;

    const row = await this.db.downloadToken.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        tokenHash: input.token_hash,
        status: input.status,
        expiresAt: input.expires_at,
        maxDownloads: input.max_downloads,
        downloadCount: input.download_count,
        createdBy: "system",
        createdAt: input.created_at,
        revokedAt: input.revoked_at
      },
      include: { order: true }
    });
    await this.linkTokenToAssets({
      download_token_id: input.id,
      asset_ids: []
    });
    return mapToken(row, input.order_number);
  }

  async findTokenByHash(tokenHash: string): Promise<DownloadTokenRecord | null> {
    const row = await this.db.downloadToken.findUnique({
      where: { tokenHash },
      include: { order: true }
    });
    return row ? mapToken(row) : null;
  }

  async updateToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord> {
    const row = await this.db.downloadToken.update({
      where: { id: input.id },
      data: {
        status: input.status,
        expiresAt: input.expires_at,
        maxDownloads: input.max_downloads,
        downloadCount: input.download_count,
        revokedAt: input.revoked_at
      },
      include: { order: true }
    });
    return mapToken(row, input.order_number);
  }

  async linkTokenToAssets(input: { download_token_id: string; asset_ids: string[] }): Promise<void> {
    for (const assetId of input.asset_ids) {
      await this.db.downloadTokenAsset.create({
        data: {
          id: createLocalId(),
          downloadTokenId: input.download_token_id,
          assetId,
          createdAt: new Date()
        }
      });
    }
  }

  async listAssetsForToken(downloadTokenId: string): Promise<DownloadAssetRecord[]> {
    const rows = await this.db.downloadTokenAsset.findMany({
      where: { downloadTokenId },
      include: { asset: { include: { deliverableType: true } } }
    });
    return rows.map((row) => mapAsset(recordObject(row, "asset")));
  }

  async findLinkedAsset(input: {
    download_token_id: string;
    asset_id: string;
  }): Promise<DownloadAssetRecord | null> {
    const row = await this.db.downloadTokenAsset.findFirst({
      where: { downloadTokenId: input.download_token_id, assetId: input.asset_id },
      include: { asset: { include: { deliverableType: true } } }
    });
    return row ? mapAsset(recordObject(row, "asset")) : null;
  }

  async createEvent(input: DownloadEventRecord): Promise<DownloadEventRecord> {
    const row = await this.db.downloadEvent.create({
      data: {
        id: input.id,
        downloadTokenId: input.download_token_id,
        orderId: input.order_id,
        assetId: input.asset_id,
        eventType: input.event_type,
        ipHash: input.ip_hash,
        userAgentHash: input.user_agent_hash,
        createdAt: input.created_at
      }
    });
    return {
      id: recordString(row, "id"),
      download_token_id: recordString(row, "downloadTokenId"),
      order_id: recordString(row, "orderId"),
      asset_id: recordStringOrNull(row, "assetId"),
      event_type: recordString(row, "eventType") as DownloadEventRecord["event_type"],
      ip_hash: recordStringOrNull(row, "ipHash"),
      user_agent_hash: recordStringOrNull(row, "userAgentHash"),
      created_at: recordDate(row, "createdAt")
    };
  }
}

function mapToken(row: unknown, fallbackOrderNumber?: string): DownloadTokenRecord {
  const order = recordObject(row, "order");
  return {
    id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    order_number: stringFromRecord(order, "orderNumber") ?? fallbackOrderNumber ?? "UNKNOWN",
    token_hash: recordString(row, "tokenHash"),
    status: recordString(row, "status") as DownloadTokenRecord["status"],
    expires_at: recordDate(row, "expiresAt"),
    max_downloads: Number(recordValue(row, "maxDownloads") ?? 0),
    download_count: Number(recordValue(row, "downloadCount") ?? 0),
    created_at: recordDate(row, "createdAt"),
    revoked_at: recordDateOrNull(row, "revokedAt")
  };
}

function mapAsset(row: unknown): DownloadAssetRecord {
  const deliverableType = recordObject(row, "deliverableType");
  const deliverableCode =
    stringFromRecord(deliverableType, "code") ?? recordString(row, "deliverableTypeId");
  return {
    asset_id: recordString(row, "id"),
    order_id: recordString(row, "orderId"),
    deliverable_code: deliverableCode,
    friendly_name: friendlyDeliverableName(deliverableCode),
    asset_type: recordString(row, "assetType") as DownloadAssetRecord["asset_type"],
    file_ext: recordString(row, "fileExt"),
    mime_type: recordString(row, "mimeType"),
    size_bytes: Number(recordValue(row, "sizeBytes") ?? 0),
    status: recordString(row, "status"),
    storage_provider: recordString(row, "storageProvider"),
    storage_bucket: recordString(row, "storageBucket"),
    storage_key: recordString(row, "storageKey"),
    public_url: null,
    deleted_at: recordDateOrNull(row, "deletedAt")
  };
}

function friendlyDeliverableName(code: string): string {
  const names: Record<string, string> = {
    crest_variant_1_png: "Crest Artwork 1",
    crest_variant_2_png: "Crest Artwork 2",
    crest_variant_3_png: "Crest Artwork 3",
    transparent_crest_png: "Transparent Crest Artwork",
    symbol_explanation_pdf: "Symbol Guide",
    heritage_certificate_pdf: "Heritage Certificate",
    family_story_pdf: "Family Story",
    download_package_zip: "Complete Collection Archive"
  };
  return (
    names[code] ??
    code
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function createLocalId(): string {
  return ulid();
}

function recordObject(row: unknown, key: string): Record<string, unknown> {
  const value = recordValue(row, key);
  return isRecord(value) ? value : {};
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

function recordDate(row: unknown, key: string): Date {
  const value = recordValue(row, key);
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  throw new Error(`missing_date:${key}`);
}

function recordDateOrNull(row: unknown, key: string): Date | null {
  const value = recordValue(row, key);
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return null;
}

function recordValue(row: unknown, key: string): unknown {
  if (!isRecord(row)) throw new Error("invalid_prisma_record");
  return row[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
