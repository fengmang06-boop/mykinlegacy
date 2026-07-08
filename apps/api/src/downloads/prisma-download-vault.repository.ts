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
  getMeaningContextForToken(downloadTokenId: string): Promise<DownloadMeaningContext | null>;
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

interface DownloadMeaningContext {
  meaning_profile: Record<string, unknown> | null;
  collection_content: Record<string, unknown> | null;
}

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

  async getMeaningContextForToken(downloadTokenId: string): Promise<DownloadMeaningContext | null> {
    const row = await this.db.downloadToken.findUnique({
      where: { id: downloadTokenId },
      include: {
        order: {
          include: {
            generationManifests: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
    if (!isRecord(row)) return null;
    const order = recordObject(row, "order");
    const manifests = recordArray(order, "generationManifests");
    const manifest = isRecord(manifests[0]) ? manifests[0] : {};
    const optionalAssets = recordArray(manifest, "optionalAssetsJson");
    const attachment = optionalAssets.find(
      (item) => isRecord(item) && item.attachment_type === "meaning_engine"
    );
    if (!isRecord(attachment)) return null;
    return {
      meaning_profile: meaningProfileSummary(recordObject(attachment, "meaning_profile")),
      collection_content: collectionContentSummary(recordObject(attachment, "collection_content"))
    };
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

function meaningProfileSummary(profile: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.keys(profile).length) return null;
  const validation = recordObject(profile, "validation");
  return {
    source_level: stringOrNull(profile.source_level),
    themes: recordArray(profile, "meaning_themes").map((theme) => {
      const record = isRecord(theme) ? theme : {};
      return {
        theme: stringOrNull(record.theme),
        confidence: stringOrNull(record.confidence),
        evidence: stringOrNull(record.evidence)
      };
    }),
    symbols: recordArray(profile, "symbol_choices").map((symbol) => {
      const record = isRecord(symbol) ? symbol : {};
      return {
        symbol: stringOrNull(record.symbol),
        meaning: stringOrNull(record.meaning),
        rationale: stringOrNull(record.rationale),
        source: stringOrNull(record.source)
      };
    }),
    design_rationale: stringArray(profile.design_rationale),
    story_direction: stringOrNull(profile.story_direction),
    certificate_direction: stringOrNull(profile.certificate_direction),
    boundary_statement: stringOrNull(profile.boundary_statement),
    validation: {
      valid: validation.valid === true,
      quality_flags: stringArray(validation.quality_flags),
      banned_claims_found: stringArray(validation.banned_claims_found)
    }
  };
}

function collectionContentSummary(content: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.keys(content).length) return null;
  return {
    house_meaning_summary: stringOrNull(content.house_meaning_summary),
    symbol_guide: recordArray(content, "symbol_guide").map((symbol) => {
      const record = isRecord(symbol) ? symbol : {};
      return {
        symbol: stringOrNull(record.symbol),
        meaning: stringOrNull(record.meaning),
        why_chosen: stringOrNull(record.why_chosen),
        emotional_relevance: stringOrNull(record.emotional_relevance)
      };
    }),
    family_story: stringOrNull(content.family_story),
    certificate_text: stringOrNull(content.certificate_text),
    collection_letter: stringOrNull(content.collection_letter),
    design_basis: stringOrNull(content.design_basis),
    boundary_statement: stringOrNull(content.boundary_statement)
  };
}

function friendlyDeliverableName(code: string): string {
  const names: Record<string, string> = {
    crest_variant_1_png: "Final Crest",
    crest_variant_2_png: "Internal Crest Variant 2",
    crest_variant_3_png: "Internal Crest Variant 3",
    symbol_explanation_pdf: "Meaning Behind Your Crest",
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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordArray(row: unknown, key: string): unknown[] {
  const value = isRecord(row) ? row[key] : null;
  return Array.isArray(value) ? value : [];
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
