import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createErrorContract } from "../common/api-error";
import { DownloadsService } from "./downloads.service";

describe("downloads public API service", () => {
  it("returns vault response without private storage fields", async () => {
    const { service, rawToken } = await createServiceFixture();
    const vault = await service.getVault(rawToken, {
      ip: "203.0.113.20",
      userAgent: "Unit Test"
    });

    expect(vault).toMatchObject({
      order_number: "AH-1001",
      download_token_status: "active",
      assets_ready: true
    });
    expect(JSON.stringify(vault)).not.toContain("storage_key");
    expect(JSON.stringify(vault)).not.toContain("token_hash");
    expect(JSON.stringify(vault)).not.toContain("signed_url");
  });

  it("returns asset list without signed URL or storage key", async () => {
    const { service, rawToken } = await createServiceFixture();
    const assets = await service.listAssets(rawToken);

    expect(assets[0]).toMatchObject({
      asset_id: "asset_1",
      deliverable_code: "crest_variant_1_png",
      available: true
    });
    expect(JSON.stringify(assets)).not.toContain("signed_url");
    expect(JSON.stringify(assets)).not.toContain("storage_key");
  });

  it("returns short signed URL only from signed-url endpoint path", async () => {
    const { service, rawToken, repository } = await createServiceFixture();
    const signed = await service.createSignedUrl(rawToken, "asset_1");

    expect(signed.signed_url).toBe("/api/v1/downloads/raw_token_once/assets/asset_1/file");
    expect(signed.expires_at).toBeTruthy();
    expect(JSON.stringify(repository.events)).not.toContain("local-private://");
  });

  it("streams linked private asset bytes through the public download endpoint", async () => {
    const { service, rawToken } = await createServiceFixture();
    const file = await service.getAssetFile(rawToken, "asset_1");

    expect(file).toMatchObject({
      asset_id: "asset_1",
      file_name: "crest-variant-1.png",
      mime_type: "image/png"
    });
    expect(file.body.byteLength).toBeGreaterThan(512);
    expect(JSON.stringify(file)).not.toContain("storage_key");
  });

  it("uses ErrorContract v1.1 envelope for invalid tokens", async () => {
    const { service } = await createServiceFixture();

    try {
      await service.getVault("invalid");
      throw new Error("expected failure");
    } catch (error) {
      const contract = createErrorContract(error as Error);
      expect(contract).toMatchObject({
        contract_version: "1.1",
        error_code: "download_token_invalid"
      });
    }
  });
});

async function createServiceFixture() {
  const storageModule = requireStorageModule();
  type ServiceRepository = NonNullable<ConstructorParameters<typeof DownloadsService>[0]> & {
    events: unknown[];
  };
  type ServiceStorage = NonNullable<ConstructorParameters<typeof DownloadsService>[1]>;
  type ServiceStorageModule = NonNullable<ConstructorParameters<typeof DownloadsService>[2]>;
  const repository = new storageModule.InMemoryDownloadVaultRepository({
    assets: [
      {
        asset_id: "asset_1",
        order_id: "order_1",
        deliverable_code: "crest_variant_1_png",
        friendly_name: "Crest Variant 1",
        asset_type: "image",
        file_ext: "png",
        mime_type: "image/png",
        size_bytes: 2048,
        status: "available",
        storage_provider: "local_private",
        storage_bucket: "private-assets",
        storage_key: "orders/order_1/item_1/asset_1.png",
        public_url: null,
        deleted_at: null
      }
    ]
  }) as unknown as ServiceRepository;
  const created = await storageModule.createDownloadToken(
    { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
    repository
  );

  return {
    repository,
    rawToken: created.raw_token_for_internal_delivery_only,
    service: new DownloadsService(
      repository,
      new storageModule.LocalPrivateStorageAdapter() as ServiceStorage,
      storageModule as unknown as ServiceStorageModule
    )
  };
}

function requireStorageModule() {
  return {
    InMemoryDownloadVaultRepository: FakeDownloadRepository,
    LocalPrivateStorageAdapter: FakeStorageAdapter,
    async createDownloadToken(input: unknown, repository: unknown) {
      const typedInput = input as { order_id: string; order_number: string; asset_ids: string[] };
      const typedRepository = repository as FakeDownloadRepository;
      const rawToken = "raw_token_once";
      typedRepository.tokens.push({
        id: "download_token_1",
        order_id: typedInput.order_id,
        order_number: typedInput.order_number,
        token_hash: hash(rawToken),
        status: "active",
        expires_at: new Date("2026-07-29T00:00:00.000Z"),
        max_downloads: 20,
        download_count: 0,
        revoked_at: null
      });
      typedRepository.tokenAssets.push({
        download_token_id: "download_token_1",
        asset_id: "asset_1"
      });
      return {
        download_token_id: "download_token_1",
        raw_token_for_internal_delivery_only: rawToken
      };
    },
    async getDownloadVault(input: unknown) {
      const { token, repository } = validateFakeToken(input);
      repository.events.push({ event_type: "page_view", ip_hash: hash("ip") });
      return {
        order_number: token.order_number,
        download_token_status: token.status,
        expires_at: token.expires_at.toISOString(),
        download_count: token.download_count,
        max_downloads: token.max_downloads,
        assets_ready: true,
        assets_summary: [{ asset_id: "asset_1", deliverable_code: "crest_variant_1_png" }],
        disclaimer: "disclaimer"
      };
    },
    async listDownloadAssets(input: unknown) {
      validateFakeToken(input);
      return [
        {
          asset_id: "asset_1",
          deliverable_code: "crest_variant_1_png",
          friendly_name: "Crest Variant 1",
          asset_type: "image",
          file_ext: "png",
          mime_type: "image/png",
          size_bytes: 100,
          available: true,
          status: "available"
        }
      ];
    },
    async createSignedAssetUrl(input: unknown) {
      const typedInput = input as { asset_id: string; repository: FakeDownloadRepository };
      const { repository } = validateFakeToken(input);
      repository.events.push({ event_type: "signed_url_created" });
      return {
        asset_id: typedInput.asset_id,
        signed_url: "local-private://private-assets/redacted?expires=600",
        expires_at: "2026-06-29T00:10:00.000Z"
      };
    }
  };
}

class FakeDownloadRepository {
  public readonly tokens: Array<{
    id: string;
    order_id: string;
    order_number: string;
    token_hash: string;
    status: string;
    expires_at: Date;
    max_downloads: number;
    download_count: number;
    revoked_at: Date | null;
  }> = [];
  public readonly tokenAssets: Array<{ download_token_id: string; asset_id: string }> = [];
  public readonly events: unknown[] = [];

  constructor(public readonly input: unknown) {}

  findTokenByHash = async (tokenHash: string) => {
    return this.tokens.find((token) => token.token_hash === tokenHash) ?? null;
  };

  findLinkedAsset = async (input: { download_token_id: string; asset_id: string }) => {
    const linked = this.tokenAssets.some(
      (item) =>
        item.download_token_id === input.download_token_id && item.asset_id === input.asset_id
    );
    if (!linked) return null;
    const assets = (this.input as { assets?: unknown[] }).assets ?? [];
    return (
      assets.find(
        (asset) =>
          typeof asset === "object" &&
          asset !== null &&
          "asset_id" in asset &&
          asset.asset_id === input.asset_id
      ) ?? null
    );
  };
}

class FakeStorageAdapter {
  public readonly provider_code = "local_private";

  async createSignedUrl() {
    return "local-private://private-assets/redacted?expires=600";
  }

  async getObject() {
    return Buffer.from("PNG".repeat(1024));
  }
}

function validateFakeToken(input: unknown) {
  const typedInput = input as { raw_token: string; repository: FakeDownloadRepository };
  const token = typedInput.repository.tokens.find(
    (item) => item.token_hash === hash(typedInput.raw_token)
  );
  if (!token) {
    throw Object.assign(new Error("download_token_invalid"), {
      code: "download_token_invalid"
    });
  }
  return { token, repository: typedInput.repository };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
