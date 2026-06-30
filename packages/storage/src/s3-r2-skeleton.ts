import { createHash } from "node:crypto";

import type { PutObjectInput, PutObjectOutput, StorageObjectRef, StorageProviderAdapter } from "./types";

export class DisabledObjectStorageAdapter implements StorageProviderAdapter {
  public readonly provider_code: string;

  constructor(providerCode: "s3" | "r2") {
    this.provider_code = providerCode;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectOutput> {
    const body = input.body ? Buffer.from(input.body) : Buffer.alloc(0);
    return {
      storage_provider: this.provider_code,
      storage_bucket: input.bucket,
      storage_key: input.storage_key,
      size_bytes: body.byteLength,
      checksum_sha256: createHash("sha256").update(body).digest("hex"),
      mime_type: input.content_type,
      public_url: null
    };
  }

  async getObject(_input: StorageObjectRef): Promise<Buffer> {
    throw new Error(`${this.provider_code}_adapter_disabled`);
  }

  async deleteObject(_input: StorageObjectRef): Promise<void> {
    return undefined;
  }

  async objectExists(_input: StorageObjectRef): Promise<boolean> {
    return false;
  }

  async createSignedUrl(input: StorageObjectRef & { expires_in_seconds: number }): Promise<string> {
    return `${this.provider_code}://signed-url-disabled/${input.storage_key}?expires=${input.expires_in_seconds}`;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: false, errors: [`${this.provider_code}_adapter_disabled`] };
  }
}
