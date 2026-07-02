import { createHash, randomBytes } from "node:crypto";

import type { StorageProviderAdapter } from "./types";

export const DOWNLOAD_VAULT_DISCLAIMER =
  "Your collection is a personalized, AI-generated, heritage-inspired symbolic design and is not an official, legally granted, or historically certified coat of arms.";

export type DownloadVaultErrorCode =
  | "download_token_invalid"
  | "download_token_expired"
  | "download_token_revoked"
  | "download_limit_exceeded"
  | "asset_not_available"
  | "asset_not_linked_to_token"
  | "signed_url_creation_failed"
  | "order_not_found"
  | "internal_error";

export type DownloadEventType =
  | "page_view"
  | "file_download"
  | "signed_url_created"
  | "denied";

export type DownloadTokenStatus = "active" | "expired" | "revoked";

export interface DownloadAssetRecord {
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

export interface DownloadTokenRecord {
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

export interface DownloadEventRecord {
  id: string;
  download_token_id: string;
  order_id: string;
  asset_id: string | null;
  event_type: DownloadEventType;
  ip_hash: string | null;
  user_agent_hash: string | null;
  created_at: Date;
}

export interface DownloadVaultRepository {
  createToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord>;
  findTokenByHash(tokenHash: string): Promise<DownloadTokenRecord | null>;
  updateToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord>;
  linkTokenToAssets(input: { download_token_id: string; asset_ids: string[] }): Promise<void>;
  listAssetsForToken(downloadTokenId: string): Promise<DownloadAssetRecord[]>;
  getMeaningContextForToken?(downloadTokenId: string): Promise<DownloadMeaningContext | null>;
  findLinkedAsset(input: {
    download_token_id: string;
    asset_id: string;
  }): Promise<DownloadAssetRecord | null>;
  createEvent(input: DownloadEventRecord): Promise<DownloadEventRecord>;
}

export interface CreateDownloadTokenInput {
  order_id: string;
  order_number: string;
  asset_ids: string[];
  expires_in_days?: number;
  max_downloads?: number;
  now?: Date;
}

export interface CreateDownloadTokenJobInput {
  order_id: string;
  order_number: string;
  asset_ids: string[];
  expires_in_days?: number;
  max_downloads?: number;
}

export interface CreateDownloadTokenOutput {
  download_token_id: string;
  raw_token_for_internal_delivery_only: string;
  token_hash: string;
  expires_at: Date;
  linked_asset_count: number;
}

export interface DownloadVaultSummary {
  order_number: string;
  download_token_status: DownloadTokenStatus;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  assets_ready: boolean;
  assets_summary: Array<{
    asset_id: string;
    deliverable_code: string;
    friendly_name: string;
    asset_type: string;
    available: boolean;
    status: string;
  }>;
  meaning_profile?: Record<string, unknown> | null;
  collection_content?: Record<string, unknown> | null;
  disclaimer: string;
}

export interface DownloadMeaningContext {
  meaning_profile: Record<string, unknown> | null;
  collection_content: Record<string, unknown> | null;
}

export interface DownloadAssetListItem {
  asset_id: string;
  deliverable_code: string;
  friendly_name: string;
  asset_type: string;
  file_ext: string;
  mime_type: string;
  size_bytes: number;
  available: boolean;
  status: string;
}

export class DownloadVaultError extends Error {
  constructor(
    readonly code: DownloadVaultErrorCode,
    message = code
  ) {
    super(message);
    this.name = "DownloadVaultError";
  }
}

export class InMemoryDownloadVaultRepository implements DownloadVaultRepository {
  public readonly tokens: DownloadTokenRecord[] = [];
  public readonly tokenAssets: Array<{ download_token_id: string; asset_id: string }> = [];
  public readonly assets: DownloadAssetRecord[] = [];
  public readonly events: DownloadEventRecord[] = [];

  constructor(input: { assets?: DownloadAssetRecord[] } = {}) {
    this.assets.push(...(input.assets ?? []));
  }

  async createToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord> {
    this.tokens.push(input);
    return input;
  }

  async findTokenByHash(tokenHash: string): Promise<DownloadTokenRecord | null> {
    return this.tokens.find((token) => token.token_hash === tokenHash) ?? null;
  }

  async updateToken(input: DownloadTokenRecord): Promise<DownloadTokenRecord> {
    const index = this.tokens.findIndex((token) => token.id === input.id);
    if (index === -1) {
      throw new DownloadVaultError("download_token_invalid");
    }
    this.tokens[index] = input;
    return input;
  }

  async linkTokenToAssets(input: { download_token_id: string; asset_ids: string[] }): Promise<void> {
    for (const assetId of input.asset_ids) {
      this.tokenAssets.push({
        download_token_id: input.download_token_id,
        asset_id: assetId
      });
    }
  }

  async listAssetsForToken(downloadTokenId: string): Promise<DownloadAssetRecord[]> {
    const linkedIds = new Set(
      this.tokenAssets
        .filter((link) => link.download_token_id === downloadTokenId)
        .map((link) => link.asset_id)
    );
    return this.assets.filter((asset) => linkedIds.has(asset.asset_id));
  }

  async findLinkedAsset(input: {
    download_token_id: string;
    asset_id: string;
  }): Promise<DownloadAssetRecord | null> {
    const linked = this.tokenAssets.some(
      (link) =>
        link.download_token_id === input.download_token_id && link.asset_id === input.asset_id
    );
    if (!linked) {
      return null;
    }
    return this.assets.find((asset) => asset.asset_id === input.asset_id) ?? null;
  }

  async createEvent(input: DownloadEventRecord): Promise<DownloadEventRecord> {
    this.events.push(input);
    return input;
  }
}

export function createDownloadToken(
  input: CreateDownloadTokenInput,
  repository: DownloadVaultRepository
): Promise<CreateDownloadTokenOutput> {
  const now = input.now ?? new Date();
  const rawToken = createRawDownloadToken();
  const tokenHash = hashDownloadToken(rawToken);
  const expiresAt = new Date(now.getTime() + (input.expires_in_days ?? 30) * 24 * 60 * 60 * 1000);
  const downloadTokenId = randomDownloadId();

  return repository
    .createToken({
      id: downloadTokenId,
      order_id: input.order_id,
      order_number: input.order_number,
      token_hash: tokenHash,
      status: "active",
      expires_at: expiresAt,
      max_downloads: input.max_downloads ?? 20,
      download_count: 0,
      created_at: now,
      revoked_at: null
    })
    .then(async () => {
      await repository.linkTokenToAssets({
        download_token_id: downloadTokenId,
        asset_ids: input.asset_ids
      });

      return {
        download_token_id: downloadTokenId,
        raw_token_for_internal_delivery_only: rawToken,
        token_hash: tokenHash,
        expires_at: expiresAt,
        linked_asset_count: input.asset_ids.length
      };
    });
}

export async function createDownloadTokenJob(
  input: CreateDownloadTokenJobInput,
  dependencies: { downloadRepository: DownloadVaultRepository }
): Promise<CreateDownloadTokenOutput> {
  return createDownloadToken(input, dependencies.downloadRepository);
}

export function hashDownloadToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function validateDownloadToken(input: {
  raw_token: string;
  repository: DownloadVaultRepository;
  now?: Date;
}): Promise<DownloadTokenRecord> {
  const token = await input.repository.findTokenByHash(hashDownloadToken(input.raw_token));
  if (!token) {
    throw new DownloadVaultError("download_token_invalid");
  }

  checkRevocation(token);
  checkExpiration(token, input.now ?? new Date());
  checkMaxDownloads(token);

  return token;
}

export async function revokeDownloadToken(input: {
  raw_token: string;
  repository: DownloadVaultRepository;
  now?: Date;
}): Promise<DownloadTokenRecord> {
  const token = await validateDownloadToken(input);
  return input.repository.updateToken({
    ...token,
    status: "revoked",
    revoked_at: input.now ?? new Date()
  });
}

export async function getDownloadVault(input: {
  raw_token: string;
  repository: DownloadVaultRepository;
  ip?: string | null;
  user_agent?: string | null;
  now?: Date;
}): Promise<DownloadVaultSummary> {
  const token = await validateDownloadToken(input);
  const assets = await input.repository.listAssetsForToken(token.id);
  const meaningContext = input.repository.getMeaningContextForToken
    ? await input.repository.getMeaningContextForToken(token.id)
    : null;
  await recordDownloadEvent({
    repository: input.repository,
    token,
    asset_id: null,
    event_type: "page_view",
    ip: input.ip,
    user_agent: input.user_agent,
    now: input.now
  });

  return {
    order_number: token.order_number,
    download_token_status: token.status,
    expires_at: token.expires_at.toISOString(),
    download_count: token.download_count,
    max_downloads: token.max_downloads,
    assets_ready: assets.every(isAssetAvailable),
    assets_summary: assets.map((asset) => ({
      asset_id: asset.asset_id,
      deliverable_code: asset.deliverable_code,
      friendly_name: asset.friendly_name,
      asset_type: asset.asset_type,
      available: isAssetAvailable(asset),
      status: asset.status
    })),
    meaning_profile: meaningContext?.meaning_profile ?? null,
    collection_content: meaningContext?.collection_content ?? null,
    disclaimer: DOWNLOAD_VAULT_DISCLAIMER
  };
}

export async function listDownloadAssets(input: {
  raw_token: string;
  repository: DownloadVaultRepository;
  now?: Date;
}): Promise<DownloadAssetListItem[]> {
  const token = await validateDownloadToken(input);
  const assets = await input.repository.listAssetsForToken(token.id);
  return assets.map((asset) => ({
    asset_id: asset.asset_id,
    deliverable_code: asset.deliverable_code,
    friendly_name: asset.friendly_name,
    asset_type: asset.asset_type,
    file_ext: asset.file_ext,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    available: isAssetAvailable(asset),
    status: asset.status
  }));
}

export async function createSignedAssetUrl(input: {
  raw_token: string;
  asset_id: string;
  repository: DownloadVaultRepository;
  storage: StorageProviderAdapter;
  expires_in_seconds?: number;
  ip?: string | null;
  user_agent?: string | null;
  now?: Date;
}): Promise<{ asset_id: string; signed_url: string; expires_at: string }> {
  const token = await validateDownloadToken(input);
  const asset = await input.repository.findLinkedAsset({
    download_token_id: token.id,
    asset_id: input.asset_id
  });

  if (!asset) {
    await recordDownloadEvent({
      repository: input.repository,
      token,
      asset_id: input.asset_id,
      event_type: "denied",
      ip: input.ip,
      user_agent: input.user_agent,
      now: input.now
    });
    throw new DownloadVaultError("asset_not_linked_to_token");
  }

  if (!isAssetAvailable(asset)) {
    await recordDownloadEvent({
      repository: input.repository,
      token,
      asset_id: asset.asset_id,
      event_type: "denied",
      ip: input.ip,
      user_agent: input.user_agent,
      now: input.now
    });
    throw new DownloadVaultError("asset_not_available");
  }

  const expiresInSeconds = input.expires_in_seconds ?? 600;
  try {
    const signedUrl = await input.storage.createSignedUrl({
      storage_provider: asset.storage_provider,
      storage_bucket: asset.storage_bucket,
      storage_key: asset.storage_key,
      expires_in_seconds: expiresInSeconds
    });
    await recordDownloadEvent({
      repository: input.repository,
      token,
      asset_id: asset.asset_id,
      event_type: "signed_url_created",
      ip: input.ip,
      user_agent: input.user_agent,
      now: input.now
    });
    await incrementDownloadCount({ repository: input.repository, token });

    return {
      asset_id: asset.asset_id,
      signed_url: signedUrl,
      expires_at: new Date((input.now ?? new Date()).getTime() + expiresInSeconds * 1000).toISOString()
    };
  } catch (error) {
    if (error instanceof DownloadVaultError) {
      throw error;
    }
    throw new DownloadVaultError("signed_url_creation_failed");
  }
}

export async function recordDownloadEvent(input: {
  repository: DownloadVaultRepository;
  token: DownloadTokenRecord;
  asset_id: string | null;
  event_type: DownloadEventType;
  ip?: string | null;
  user_agent?: string | null;
  now?: Date;
}): Promise<DownloadEventRecord> {
  return input.repository.createEvent({
    id: randomDownloadId(),
    download_token_id: input.token.id,
    order_id: input.token.order_id,
    asset_id: input.asset_id,
    event_type: input.event_type,
    ip_hash: input.ip ? hashSensitiveValue(input.ip) : null,
    user_agent_hash: input.user_agent ? hashSensitiveValue(input.user_agent) : null,
    created_at: input.now ?? new Date()
  });
}

export async function incrementDownloadCount(input: {
  repository: DownloadVaultRepository;
  token: DownloadTokenRecord;
}): Promise<DownloadTokenRecord> {
  return input.repository.updateToken({
    ...input.token,
    download_count: input.token.download_count + 1
  });
}

export function checkMaxDownloads(token: DownloadTokenRecord): void {
  if (token.download_count >= token.max_downloads) {
    throw new DownloadVaultError("download_limit_exceeded");
  }
}

export function checkExpiration(token: DownloadTokenRecord, now = new Date()): void {
  if (token.status === "expired" || token.expires_at.getTime() <= now.getTime()) {
    throw new DownloadVaultError("download_token_expired");
  }
}

export function isAssetAvailable(asset: DownloadAssetRecord): boolean {
  return (
    asset.public_url === null &&
    !asset.deleted_at &&
    (asset.status === "available" || asset.status === "available_for_download") &&
    asset.size_bytes >= minimumDownloadableBytes(asset.file_ext)
  );
}

function minimumDownloadableBytes(fileExt: string): number {
  if (fileExt === "zip") return 20 * 1024;
  if (fileExt === "png" || fileExt === "pdf") return 10 * 1024;
  return 1024;
}

export function hashSensitiveValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function checkRevocation(token: DownloadTokenRecord): void {
  if (token.status === "revoked" || token.revoked_at) {
    throw new DownloadVaultError("download_token_revoked");
  }
}

function createRawDownloadToken(): string {
  return randomBytes(32).toString("base64url");
}

function randomDownloadId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let output = "";
  for (let i = 0; i < 26; i += 1) {
    output += alphabet[(bytes[i % bytes.length] ?? 0) % alphabet.length] ?? "0";
  }
  return output;
}
