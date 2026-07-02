import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";

import { ApiException, type ApiErrorCode } from "../common/api-error";
import { DOWNLOAD_VAULT_REPOSITORY } from "./download-vault.provider";

interface DownloadVaultRepository {
  createToken(input: unknown): Promise<unknown>;
  findTokenByHash(tokenHash: string): Promise<unknown | null>;
  updateToken(input: unknown): Promise<unknown>;
  linkTokenToAssets(input: unknown): Promise<void>;
  listAssetsForToken(downloadTokenId: string): Promise<unknown[]>;
  getMeaningContextForToken?(downloadTokenId: string): Promise<unknown | null>;
  findLinkedAsset(input: unknown): Promise<unknown | null>;
  createEvent(input: unknown): Promise<unknown>;
}

interface StorageProviderAdapter {
  provider_code: string;
  createSignedUrl(input: unknown): Promise<string>;
}

interface StorageModule {
  createSignedAssetUrl(input: unknown): Promise<SignedUrlResponse>;
  getDownloadVault(input: unknown): Promise<DownloadVaultResponse>;
  listDownloadAssets(input: unknown): Promise<DownloadAssetResponse[]>;
  InMemoryDownloadVaultRepository: new () => DownloadVaultRepository;
  LocalPrivateStorageAdapter: new () => StorageProviderAdapter;
}

export interface DownloadVaultResponse {
  order_number: string;
  download_token_status: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  assets_ready: boolean;
  assets_summary: Array<Record<string, unknown>>;
  meaning_profile?: Record<string, unknown> | null;
  collection_content?: Record<string, unknown> | null;
  disclaimer: string;
}

export interface DownloadAssetResponse {
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

export interface SignedUrlResponse {
  asset_id: string;
  signed_url: string;
  expires_at: string;
}

@Injectable()
export class DownloadsService {
  private readonly storageModule: StorageModule;
  private readonly repository: DownloadVaultRepository;
  private readonly storage: StorageProviderAdapter;

  constructor(
    @Optional()
    @Inject(DOWNLOAD_VAULT_REPOSITORY)
    repository?: DownloadVaultRepository,
    @Optional()
    storage?: StorageProviderAdapter,
    @Optional()
    storageModule?: StorageModule
  ) {
    this.storageModule = storageModule ?? requireStorage();
    this.repository = repository ?? new this.storageModule.InMemoryDownloadVaultRepository();
    this.storage = storage ?? new this.storageModule.LocalPrivateStorageAdapter();
  }

  getVault(token: string, context: { ip?: string | null; userAgent?: string | null } = {}) {
    return this.wrapDownloadError(() =>
      this.storageModule.getDownloadVault({
        raw_token: token,
        repository: this.repository,
        ip: context.ip,
        user_agent: context.userAgent
      })
    );
  }

  listAssets(token: string) {
    return this.wrapDownloadError(() =>
      this.storageModule.listDownloadAssets({
        raw_token: token,
        repository: this.repository
      })
    );
  }

  createSignedUrl(
    token: string,
    assetId: string,
    context: { ip?: string | null; userAgent?: string | null } = {}
  ) {
    return this.wrapDownloadError(() =>
      this.storageModule.createSignedAssetUrl({
        raw_token: token,
        asset_id: assetId,
        repository: this.repository,
        storage: this.storage,
        expires_in_seconds: 600,
        ip: context.ip,
        user_agent: context.userAgent
      })
    );
  }

  private async wrapDownloadError<T>(handler: () => Promise<T>): Promise<T> {
    try {
      return await handler();
    } catch (error) {
      if (isDownloadVaultError(error)) {
        throw new ApiException({
          errorCode: error.code,
          message: error.code,
          userMessage: this.userMessage(error.code),
          status: this.statusCode(error.code),
          retryable: false,
          severity: "medium"
        });
      }
      throw error;
    }
  }

  private statusCode(code: string): HttpStatus {
    if (code === "download_token_invalid") {
      return HttpStatus.NOT_FOUND;
    }
    if (
      code === "download_token_expired" ||
      code === "download_token_revoked" ||
      code === "download_limit_exceeded" ||
      code === "asset_not_linked_to_token"
    ) {
      return HttpStatus.FORBIDDEN;
    }
    if (code === "asset_not_available") {
      return HttpStatus.CONFLICT;
    }
    return HttpStatus.BAD_REQUEST;
  }

  private userMessage(code: string): string {
    if (code === "download_token_invalid") {
      return "This download link is invalid or no longer available.";
    }
    if (code === "download_token_expired") {
      return "This download link has expired.";
    }
    if (code === "download_token_revoked") {
      return "This download link has been revoked.";
    }
    if (code === "download_limit_exceeded") {
      return "This download link has reached its download limit.";
    }
    if (code === "asset_not_available") {
      return "This file is not available for download yet.";
    }
    return "The requested download cannot be completed.";
  }
}

function isDownloadVaultError(error: unknown): error is { code: ApiErrorCode } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

function requireStorage(): StorageModule {
  try {
    const requirePackage = eval("require") as (specifier: string) => StorageModule;
    return requirePackage("@ai-heritage/storage");
  } catch {
    const requirePackage = eval("require") as (specifier: string) => StorageModule;
    return requirePackage("../../../../packages/storage/src");
  }
}
