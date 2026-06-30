import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

import type { PutObjectInput, PutObjectOutput, StorageObjectRef, StorageProviderAdapter } from "./types";
import { calculateChecksumSha256 } from "./utils";

export class LocalPrivateStorageAdapter implements StorageProviderAdapter {
  public readonly provider_code = "local_private";
  private readonly rootDir: string;

  constructor(rootDir = process.env.LOCAL_STORAGE_DIR ?? "./.local-storage") {
    this.rootDir = resolve(rootDir);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectOutput> {
    if (input.private !== true) {
      throw new Error("storage_object_must_be_private");
    }

    const body = input.body
      ? Buffer.isBuffer(input.body)
        ? input.body
        : Buffer.from(input.body)
      : await readFile(input.file_path ?? "");
    const targetPath = this.resolveStoragePath(input.bucket, input.storage_key);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, body);

    return {
      storage_provider: this.provider_code,
      storage_bucket: input.bucket,
      storage_key: input.storage_key,
      size_bytes: body.byteLength,
      checksum_sha256: calculateChecksumSha256(body),
      mime_type: input.content_type,
      public_url: null
    };
  }

  async getObject(input: StorageObjectRef): Promise<Buffer> {
    return readFile(this.resolveStoragePath(input.storage_bucket, input.storage_key));
  }

  async deleteObject(input: StorageObjectRef): Promise<void> {
    await rm(this.resolveStoragePath(input.storage_bucket, input.storage_key), {
      force: true
    });
  }

  async objectExists(input: StorageObjectRef): Promise<boolean> {
    try {
      await stat(this.resolveStoragePath(input.storage_bucket, input.storage_key));
      return true;
    } catch {
      return false;
    }
  }

  async createSignedUrl(input: StorageObjectRef & { expires_in_seconds: number }): Promise<string> {
    return `local-private://${input.storage_bucket}/${input.storage_key}?expires=${input.expires_in_seconds}`;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  private resolveStoragePath(bucket: string, storageKey: string): string {
    const target = resolve(join(this.rootDir, bucket, storageKey));
    if (!target.startsWith(this.rootDir)) {
      throw new Error("storage_key_outside_private_root");
    }
    return normalize(target);
  }
}
