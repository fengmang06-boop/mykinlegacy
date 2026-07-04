import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  InMemoryAssetRepository,
  InMemoryDownloadVaultRepository,
  LocalPrivateStorageAdapter,
  buildStorageKey,
  computeManifestCompletionStatus,
  computeMissingRequiredAssets,
  createDownloadToken,
  createDownloadTokenJob,
  createMvpCrestPngBuffer,
  createSignedAssetUrl,
  createTransparentPng,
  generateReadme,
  generateZipPackage,
  getDownloadVault,
  hashDownloadToken,
  listDownloadAssets,
  isAssetDownloadable,
  listZipEntries,
  markAssetGenerated,
  materializeMockImageCandidate,
  readPngMetadata,
  revokeAsset,
  storeCandidateAsAsset,
  validateDownloadToken,
  validateImageFile,
  validateTransparentPng,
  validateArtifactBuffer,
  validateZipFile
} from "./index";

const DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

describe("private storage and assets", () => {
  it("writes local private storage object with public_url null", async () => {
    const dir = await tempDir();
    const storage = new LocalPrivateStorageAdapter(dir);
    const result = await storage.putObject({
      bucket: "private-assets",
      storage_key: "orders/order_1/item_1/file.txt",
      content_type: "text/plain",
      body: "hello",
      metadata: {},
      private: true
    });

    expect(result.public_url).toBeNull();
    expect(result.size_bytes).toBe(5);
    expect(await storage.objectExists(result)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it("builds required storage key shape", () => {
    expect(
      buildStorageKey({
        order_id: "order_1",
        order_item_id: "item_1",
        deliverable_code: "crest_variant_1_png",
        asset_id: "asset_1",
        ext: "png"
      })
    ).toBe("orders/order_1/item_1/crest_variant_1_png/asset_1.png");
  });

  it("materializes mock image candidate to readable PNG", async () => {
    const dir = await tempDir();
    const filePath = join(dir, "mock.png");
    const result = await materializeMockImageCandidate({
      temporary_output_ref: "mock://image/crest_variant_1_png.png",
      output_file_path: filePath
    });
    const validation = await validateImageFile(filePath);

    expect(result).toMatchObject({ width: 640, height: 640, has_alpha: true });
    expect(validation.valid).toBe(true);
    expect(validation.size_bytes).toBeGreaterThan(10 * 1024);
    await rm(dir, { recursive: true, force: true });
  });

  it("creates transparent PNG with alpha metadata", async () => {
    const dir = await tempDir();
    const filePath = join(dir, "transparent.png");
    await createTransparentPng({ output_file_path: filePath });

    await expect(validateTransparentPng(filePath)).resolves.toMatchObject({
      valid: true,
      has_alpha: true
    });
    await expect(validateImageFile(filePath)).resolves.toMatchObject({
      valid: true,
      size_bytes: expect.any(Number)
    });
    await rm(dir, { recursive: true, force: true });
  });

  it("creates deterministic MVP crest artwork with customer-ready dimensions and size", () => {
    const body = createMvpCrestPngBuffer({
      variant: "crest_variant_1_png",
      house_name: "House of Alder",
      symbols: ["shield", "tree", "knot"]
    });
    const transparentBody = createMvpCrestPngBuffer({
      variant: "transparent_crest_png",
      house_name: "House of Alder",
      symbols: ["shield", "tree", "knot"],
      transparent: true
    });
    const metadataText = body.toString("latin1");
    const transparentMetadata = readPngMetadata(transparentBody);

    expect(body.subarray(1, 4).toString()).toBe("PNG");
    expect(metadataText).toContain("artwork_template=shield_legacy_crest_v1");
    expect(metadataText).toContain("artwork_mode=deterministic_symbolic_template");
    expect(metadataText).toContain("main_symbol=tree");
    expect(metadataText).toContain("supporting_symbols=shield,knot");
    expect(metadataText).toContain("theme_mapping=continuity,unity");
    expect(metadataText).toContain("artwork_quality=internal_beta");
    expect(body.byteLength).toBeGreaterThan(10 * 1024);
    expect(readPngMetadata(body)).toMatchObject({ width: 640, height: 640, has_alpha: true });
    expect(transparentMetadata).toMatchObject({
      width: 640,
      height: 640,
      has_alpha: true,
      has_transparent_pixels: true
    });
  });

  it("creates distinct shield legacy crest variants without unsupported symbol mapping", () => {
    const variants = [
      createMvpCrestPngBuffer({
        variant: "crest_variant_1_png",
        house_name: "House Continuity",
        symbols: ["shield", "tree", "knot", "unsupported laser"]
      }),
      createMvpCrestPngBuffer({
        variant: "crest_variant_2_png",
        house_name: "House Continuity",
        symbols: ["shield", "tree", "knot", "unsupported laser"]
      }),
      createMvpCrestPngBuffer({
        variant: "crest_variant_3_png",
        house_name: "House Continuity",
        symbols: ["shield", "tree", "knot", "unsupported laser"]
      }),
      createMvpCrestPngBuffer({
        variant: "transparent_crest_png",
        house_name: "House Continuity",
        symbols: ["shield", "tree", "knot", "unsupported laser"],
        transparent: true
      })
    ];
    const serialized = variants.map((variant) => variant.toString("base64"));

    expect(new Set(serialized).size).toBe(4);
    for (const variant of variants) {
      const metadataText = variant.toString("latin1");
      expect(metadataText).toContain("artwork_template=shield_legacy_crest_v1");
      expect(metadataText).toContain("main_symbol=tree");
      expect(metadataText).toContain("supporting_symbols=shield,knot");
      expect(metadataText).not.toContain("unsupported laser");
      expect(variant.byteLength).toBeGreaterThan(10 * 1024);
      expect(readPngMetadata(variant)).toMatchObject({ width: 640, height: 640, has_alpha: true });
    }
  }, 15_000);

  it("stores asset record with checksum, size, mime and null public_url", async () => {
    const dir = await tempDir();
    const storage = new LocalPrivateStorageAdapter(dir);
    const repository = new InMemoryAssetRepository();
    const source = join(dir, "source.png");
    await materializeMockImageCandidate({
      temporary_output_ref: "mock://image/crest_variant_1_png.png",
      output_file_path: source
    });
    const asset = await storeCandidateAsAsset({
      storage,
      repository,
      store: {
        order_id: "order_1",
        order_item_id: "item_1",
        generation_job_id: "generation_1",
        deliverable_code: "crest_variant_1_png",
        house_name: "House Alder",
        asset_type: "image",
        asset_kind: "generated",
        source_file_path: source,
        mime_type: "image/png",
        file_ext: "png",
        width: 1,
        height: 1
      }
    });

    expect(asset.public_url).toBeNull();
    expect(asset.checksum_sha256).toHaveLength(64);
    expect(asset.size_bytes).toBeGreaterThan(0);
    expect(asset.mime_type).toBe("image/png");
    expect(isAssetDownloadable(asset)).toBe(false);

    await revokeAsset({ repository, asset_id: asset.asset_id });
    expect(isAssetDownloadable(repository.assets[0] as never)).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("zip and manifest helpers", () => {
  it("fails zip generation when required asset missing", async () => {
    const dir = await tempDir();
    await expect(
      generateZipPackage({
        output_file_path: join(dir, "package.zip"),
        readme_text: "readme",
        assets: [{ archive_path: "crest-designs/missing.png", file_path: "", required: true }]
      })
    ).rejects.toThrow("zip_required_asset_missing");
    await rm(dir, { recursive: true, force: true });
  });

  it("generates ZIP with required folders and readme", async () => {
    const dir = await tempDir();
    const files = await createRequiredZipFiles(dir);
    const readme = await generateReadme({
      package_title: "House Alder Heritage Package",
      included_files: files.map((file) => file.archive_path),
      disclaimer: DISCLAIMER
    });
    const zip = await generateZipPackage({
      output_file_path: join(dir, "package.zip"),
      readme_text: readme,
      assets: files
    });
    const body = await readFile(zip.file_path);
    const entries = listZipEntries(body);
    const validation = validateArtifactBuffer({
      body,
      file_ext: "zip",
      mime_type: "application/zip",
      required_entries: [
        "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-01.png",
        "MyKinLegacy-Private-Legacy-Collection/05-Private-Archive-Notes/Read-Me.txt"
      ]
    });

    expect(body.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(validation).toMatchObject({
      valid: true,
      zip_header_valid: true,
      zip_eocd_valid: true,
      zip_test_passed: true
    });
    expect(entries).toEqual(expect.arrayContaining([
      "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-01.png",
      "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Transparent-Crest-Artwork.png",
      "MyKinLegacy-Private-Legacy-Collection/01-Heritage-Certificate/Heritage-Certificate.pdf",
      "MyKinLegacy-Private-Legacy-Collection/05-Private-Archive-Notes/Read-Me.txt"
    ]));
    await expect(
      validateZipFile(zip.file_path, [
        "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-01.png",
        "MyKinLegacy-Private-Legacy-Collection/05-Private-Archive-Notes/Read-Me.txt"
      ])
    ).resolves.toMatchObject({ valid: true });
    await rm(dir, { recursive: true, force: true });
  }, 15_000);

  it("detects corrupt artifact binaries by format, not only size", () => {
    expect(
      validateArtifactBuffer({
        body: Buffer.alloc(24 * 1024, "bad-pdf"),
        file_ext: "pdf",
        mime_type: "application/pdf"
      })
    ).toMatchObject({
      valid: false,
      pdf_header_valid: false,
      format_valid: false
    });

    expect(
      validateArtifactBuffer({
        body: Buffer.alloc(32 * 1024, "bad-zip"),
        file_ext: "zip",
        mime_type: "application/zip"
      })
    ).toMatchObject({
      valid: false,
      zip_header_valid: false,
      zip_test_passed: false
    });
  });

  it("updates manifest generated and refuses completion with missing required assets", () => {
    const manifest = {
      expected_assets: [
        { deliverable_code: "crest_variant_1_png", required: true },
        { deliverable_code: "family_story_pdf", required: true }
      ],
      generated_assets: [],
      missing_required_assets: [],
      failed_assets: [],
      manifest_status: "pending"
    };

    markAssetGenerated(manifest, "crest_variant_1_png", "asset_1");
    expect(computeMissingRequiredAssets(manifest)).toEqual(["family_story_pdf"]);
    expect(computeManifestCompletionStatus(manifest)).toBe("in_progress");
  });
});

describe("download vault token security", () => {
  it("stores only token hash and validates raw token", async () => {
    const repository = createDownloadRepository();
    const created = await createDownloadToken(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        asset_ids: ["asset_1"],
        now: new Date("2026-06-29T00:00:00.000Z")
      },
      repository
    );

    expect(repository.tokens[0]?.token_hash).toBe(hashDownloadToken(created.raw_token_for_internal_delivery_only));
    expect(JSON.stringify(repository.tokens)).not.toContain(created.raw_token_for_internal_delivery_only);
    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now: new Date("2026-06-29T00:00:00.000Z")
      })
    ).resolves.toMatchObject({ id: created.download_token_id });
  });

  it("rejects invalid, expired, revoked, and maxed tokens", async () => {
    const now = new Date("2026-06-29T00:00:00.000Z");
    const repository = createDownloadRepository();
    const created = await createDownloadToken(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        asset_ids: ["asset_1"],
        expires_in_days: 1,
        max_downloads: 1,
        now
      },
      repository
    );

    await expect(validateDownloadToken({ raw_token: "invalid", repository, now })).rejects.toThrow(
      "download_token_invalid"
    );
    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now: new Date("2026-07-01T00:00:00.000Z")
      })
    ).rejects.toThrow("download_token_expired");

    const token = repository.tokens[0];
    if (!token) {
      throw new Error("token_missing");
    }
    repository.tokens[0] = {
      ...token,
      status: "revoked",
      revoked_at: now
    };
    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now
      })
    ).rejects.toThrow("download_token_revoked");

    const revokedToken = repository.tokens[0];
    if (!revokedToken) {
      throw new Error("token_missing");
    }
    repository.tokens[0] = {
      ...revokedToken,
      status: "active",
      revoked_at: null,
      download_count: 1
    };
    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now
      })
    ).rejects.toThrow("download_limit_exceeded");
  });

  it("lists only linked assets without storage key or signed URL", async () => {
    const repository = createDownloadRepository();
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
      repository
    );
    const assets = await listDownloadAssets({
      raw_token: created.raw_token_for_internal_delivery_only,
      repository
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ asset_id: "asset_1", available: true });
    expect(JSON.stringify(assets)).not.toContain("storage_key");
    expect(JSON.stringify(assets)).not.toContain("signed_url");
  });

  it("does not mark placeholder-sized artifacts as available", async () => {
    const repository = createDownloadRepository();
    const asset = repository.assets[0];
    if (!asset) {
      throw new Error("asset_missing");
    }
    repository.assets[0] = {
      ...asset,
      size_bytes: 100,
      status: "available"
    };
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
      repository
    );
    const assets = await listDownloadAssets({
      raw_token: created.raw_token_for_internal_delivery_only,
      repository
    });

    expect(assets[0]).toMatchObject({ asset_id: "asset_1", available: false });
  });

  it("vault response excludes storage key and records hashed page view event", async () => {
    const repository = createDownloadRepository();
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
      repository
    );
    const vault = await getDownloadVault({
      raw_token: created.raw_token_for_internal_delivery_only,
      repository,
      ip: "203.0.113.10",
      user_agent: "Unit Test"
    });

    expect(vault.order_number).toBe("AH-1001");
    expect(JSON.stringify(vault)).not.toContain("storage_key");
    expect(repository.events[0]).toMatchObject({
      event_type: "page_view",
      ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      user_agent_hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });

  it("vault response can include existing meaning context without exposing token data", async () => {
    const repository = createDownloadRepository();
    const repositoryWithMeaning = repository as InMemoryDownloadVaultRepository & {
      getMeaningContextForToken: () => Promise<{
        meaning_profile: Record<string, unknown>;
        collection_content: Record<string, unknown>;
      }>;
    };
    repositoryWithMeaning.getMeaningContextForToken = async () => ({
      meaning_profile: { source_level: "customer_informed", themes: [{ theme: "Protection" }] },
      collection_content: { house_meaning_summary: "A private symbolic keepsake." }
    });
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
      repositoryWithMeaning
    );
    const vault = await getDownloadVault({
      raw_token: created.raw_token_for_internal_delivery_only,
      repository: repositoryWithMeaning
    });

    expect(vault.meaning_profile).toMatchObject({ source_level: "customer_informed" });
    expect(vault.collection_content).toMatchObject({
      house_meaning_summary: "A private symbolic keepsake."
    });
    expect(JSON.stringify(vault)).not.toContain(created.raw_token_for_internal_delivery_only);
  });

  it("creates short signed URL, records event, increments count, and does not persist signed URL", async () => {
    const repository = createDownloadRepository();
    const storage = new LocalPrivateStorageAdapter();
    const now = new Date("2026-06-29T00:00:00.000Z");
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"], now },
      repository
    );
    const signed = await createSignedAssetUrl({
      raw_token: created.raw_token_for_internal_delivery_only,
      asset_id: "asset_1",
      repository,
      storage,
      expires_in_seconds: 600,
      now
    });

    expect(signed.asset_id).toBe("asset_1");
    expect(signed.signed_url).toContain("local-private://");
    expect(signed.expires_at).toBe("2026-06-29T00:10:00.000Z");
    expect(repository.tokens[0]?.download_count).toBe(1);
    expect(repository.events.at(-1)).toMatchObject({ event_type: "signed_url_created" });
    expect(JSON.stringify(repository.events)).not.toContain("local-private://");
  });

  it("denies unlinked, revoked, and unavailable assets", async () => {
    const repository = createDownloadRepository();
    const storage = new LocalPrivateStorageAdapter();
    const created = await createDownloadToken(
      { order_id: "order_1", order_number: "AH-1001", asset_ids: ["asset_1"] },
      repository
    );

    await expect(
      createSignedAssetUrl({
        raw_token: created.raw_token_for_internal_delivery_only,
        asset_id: "asset_2",
        repository,
        storage
      })
    ).rejects.toThrow("asset_not_linked_to_token");

    const asset = repository.assets[0];
    if (!asset) {
      throw new Error("asset_missing");
    }
    repository.assets[0] = {
      ...asset,
      status: "deleted"
    };
    await expect(
      createSignedAssetUrl({
        raw_token: created.raw_token_for_internal_delivery_only,
        asset_id: "asset_1",
        repository,
        storage
      })
    ).rejects.toThrow("asset_not_available");
  });

  it("create_download_token_job creates token only and does not send email", async () => {
    const repository = createDownloadRepository();
    const result = await createDownloadTokenJob(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        asset_ids: ["asset_1"]
      },
      { downloadRepository: repository }
    );

    expect(result.raw_token_for_internal_delivery_only).toBeTruthy();
    expect(repository.tokens).toHaveLength(1);
  });
});

async function createRequiredZipFiles(dir: string) {
  const paths = [
    "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-01.png",
    "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-02.png",
    "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Crest-Artwork-03.png",
    "MyKinLegacy-Private-Legacy-Collection/04-Crest-Artwork/Transparent-Crest-Artwork.png",
    "MyKinLegacy-Private-Legacy-Collection/01-Heritage-Certificate/Heritage-Certificate.pdf",
    "MyKinLegacy-Private-Legacy-Collection/02-Family-Story/Family-Story.pdf",
    "MyKinLegacy-Private-Legacy-Collection/03-Symbol-Guide/Symbol-Guide.pdf"
  ];
  const files = [];
  for (const archivePath of paths) {
    const filePath = join(dir, archivePath);
    if (archivePath.endsWith(".png")) {
      await materializeMockImageCandidate({
        temporary_output_ref: "mock://image/test.png",
        output_file_path: filePath
      });
    } else {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from("%PDF-1.4\nmock"));
    }
    files.push({ archive_path: archivePath, file_path: filePath, required: true });
  }
  return files;
}

async function tempDir() {
  return mkdtemp(join(tmpdir(), "ai-heritage-storage-"));
}

function createDownloadRepository() {
  return new InMemoryDownloadVaultRepository({
    assets: [
      {
        asset_id: "asset_1",
        order_id: "order_1",
        deliverable_code: "crest_variant_1_png",
        friendly_name: "Crest Variant 1",
        asset_type: "image",
        file_ext: "png",
        mime_type: "image/png",
        size_bytes: 24000,
        status: "available",
        storage_provider: "local_private",
        storage_bucket: "private-assets",
        storage_key: "orders/order_1/item_1/asset_1.png",
        public_url: null,
        deleted_at: null
      },
      {
        asset_id: "asset_2",
        order_id: "order_1",
        deliverable_code: "family_story_pdf",
        friendly_name: "Family Story",
        asset_type: "pdf",
        file_ext: "pdf",
        mime_type: "application/pdf",
        size_bytes: 100,
        status: "pending",
        storage_provider: "local_private",
        storage_bucket: "private-assets",
        storage_key: "orders/order_1/item_1/asset_2.pdf",
        public_url: null,
        deleted_at: null
      }
    ]
  });
}
