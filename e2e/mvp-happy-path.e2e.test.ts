import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DefaultAiProviderRegistry,
  InMemoryAiGenerationRunRepository,
  handleAiImageGenerationJob,
  handleAiTextGenerationJob
} from "../packages/ai/src/generation";
import { MockEmailProvider } from "../packages/email/src/mock-provider";
import { InMemoryEmailLogRepository } from "../packages/email/src/email-log";
import { sendDeliveryEmailJob } from "../packages/email/src/jobs";
import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "../packages/pdf/src";
import {
  InMemoryAssetRepository,
  InMemoryDownloadVaultRepository,
  LocalPrivateStorageAdapter,
  createDownloadToken,
  createSignedAssetUrl,
  generateReadme,
  generateZipPackage,
  getDownloadVault,
  listDownloadAssets,
  materializeMockImageCandidate,
  storeCandidateAsAsset
} from "../packages/storage/src";
import type { DownloadAssetRecord } from "../packages/storage/src/download-vault";
import type { StoredAssetResult } from "../packages/storage/src/types";
import { verifyNoPrivateApiFields } from "../packages/observability/src";
import { AdminService } from "../apps/api/src/admin/admin.service";
import {
  expectedMvpDeliverables,
  sampleAdminUser,
  sampleEmailTemplate,
  sampleHouseDna,
  sampleImageJob,
  sampleInterviewAnswers,
  sampleOrder,
  sampleTextJob
} from "./fixtures";

describe("MVP E2E happy path with mock providers", () => {
  it("creates private assets, sends a vault email, and downloads via short signed URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ai-heritage-e2e-"));
    try {
      const storage = new LocalPrivateStorageAdapter(join(tempDir, "private-storage"));
      const assetRepository = new InMemoryAssetRepository();
      const aiRunRepository = new InMemoryAiGenerationRunRepository();
      const providerRegistry = new DefaultAiProviderRegistry({ mockMode: "success" });

      expect(sampleInterviewAnswers).toHaveLength(6);
      expect(sampleHouseDna.generation_preferences.text_strategy.include_text_in_image).toBe(false);

      const storedAssets: StoredAssetResult[] = [];
      const zipInputs: Array<{ archive_path: string; file_path: string; required: boolean }> = [];

      for (const deliverableCode of [
        "crest_variant_1_png",
        "crest_variant_2_png",
        "crest_variant_3_png"
      ]) {
        const candidate = await handleAiImageGenerationJob(sampleImageJob(deliverableCode), {
          providerRegistry,
          runRepository: aiRunRepository
        });
        const image = await materializeMockImageCandidate({
          temporary_output_ref: candidate.temporary_output_ref,
          output_file_path: join(tempDir, `${deliverableCode}.png`)
        });
        storedAssets.push(
          await storeAvailableAsset({
            assetRepository,
            storage,
            sourceFilePath: image.file_path,
            deliverableCode,
            assetType: "image",
            assetKind: "generated",
            fileExt: "png",
            mimeType: "image/png",
            width: image.width,
            height: image.height
          })
        );
        zipInputs.push({
          archive_path: `crest-designs/${deliverableCode}.png`,
          file_path: image.file_path,
          required: true
        });
      }

      const storyCandidate = await handleAiTextGenerationJob(sampleTextJob("family_story_pdf"), {
        providerRegistry,
        runRepository: aiRunRepository
      });
      for (const [deliverableCode, title, bodyText] of [
        ["family_story_pdf", "Family Story", storyCandidate.output_text],
        ["heritage_certificate_pdf", "Heritage Certificate", "Certificate copy for House Alder."],
        ["symbol_explanation_pdf", "Symbol Explanation", "Lion, oak, black, and gold symbolism."]
      ] as const) {
        const pdf = await generateHeritagePdf({
          title,
          house_name: sampleHouseDna.house_name,
          body_text: bodyText,
          disclaimer: GLOBAL_PDF_DISCLAIMER,
          deliverable_code: deliverableCode,
          output_file_path: join(tempDir, `${deliverableCode}.pdf`)
        });
        storedAssets.push(
          await storeAvailableAsset({
            assetRepository,
            storage,
            sourceFilePath: pdf.file_path,
            deliverableCode,
            assetType: "pdf",
            assetKind: "generated",
            fileExt: "pdf",
            mimeType: "application/pdf"
          })
        );
        zipInputs.push({
          archive_path: `pdfs/${deliverableCode}.pdf`,
          file_path: pdf.file_path,
          required: true
        });
      }

      const readme = await generateReadme({
        package_title: "House Alder Heritage Package",
        included_files: zipInputs.map((asset) => asset.archive_path),
        disclaimer: GLOBAL_PDF_DISCLAIMER
      });
      const zip = await generateZipPackage({
        output_file_path: join(tempDir, "download_package_zip.zip"),
        readme_text: readme,
        assets: zipInputs
      });
      storedAssets.push(
        await storeAvailableAsset({
          assetRepository,
          storage,
          sourceFilePath: zip.file_path,
          deliverableCode: "download_package_zip",
          assetType: "archive",
          assetKind: "packaged",
          fileExt: "zip",
          mimeType: "application/zip"
        })
      );

      expect(storedAssets.map((asset) => asset.deliverable_code).sort()).toEqual(
        [...expectedMvpDeliverables].sort()
      );
      expect(storedAssets.every((asset) => asset.public_url === null)).toBe(true);

      const downloadRepository = new InMemoryDownloadVaultRepository({
        assets: storedAssets.map(toDownloadAssetRecord)
      });
      const token = await createDownloadToken(
        {
          order_id: sampleOrder.order_id,
          order_number: sampleOrder.order_number,
          asset_ids: storedAssets.map((asset) => asset.asset_id),
          expires_in_days: 30,
          max_downloads: 20
        },
        downloadRepository
      );

      const emailProvider = new MockEmailProvider("success");
      const emailLogRepository = new InMemoryEmailLogRepository();
      const emailResult = await sendDeliveryEmailJob(
        {
          order_id: sampleOrder.order_id,
          order_number: sampleOrder.order_number,
          download_token_id: token.download_token_id,
          raw_token_for_internal_delivery_only: token.raw_token_for_internal_delivery_only,
          recipient_email: sampleOrder.customer_email,
          expires_at: token.expires_at,
          app_web_url: "http://localhost:3000",
          email_reply_to: "support@mykinlegacy.com"
        },
        {
          provider: emailProvider,
          emailLogRepository,
          template: sampleEmailTemplate
        }
      );

      expect(emailResult.status).toBe("sent");
      expect(JSON.stringify(emailLogRepository.logs)).not.toContain(
        token.raw_token_for_internal_delivery_only
      );
      expect(JSON.stringify(emailLogRepository.logs)).not.toContain("signed_url");
      expect(emailProvider.sentEmails[0]?.body_text).toContain("/download/");

      const vault = await getDownloadVault({
        raw_token: token.raw_token_for_internal_delivery_only,
        repository: downloadRepository,
        ip: "203.0.113.10",
        user_agent: "e2e"
      });
      const downloadableAssets = await listDownloadAssets({
        raw_token: token.raw_token_for_internal_delivery_only,
        repository: downloadRepository
      });
      const zipAsset = downloadableAssets.find(
        (asset) => asset.deliverable_code === "download_package_zip"
      );
      if (!zipAsset) {
        throw new Error("zip_asset_missing");
      }
      const signed = await createSignedAssetUrl({
        raw_token: token.raw_token_for_internal_delivery_only,
        asset_id: zipAsset.asset_id,
        repository: downloadRepository,
        storage,
        expires_in_seconds: 600
      });

      expect(vault.assets_ready).toBe(true);
      expect(downloadableAssets).toHaveLength(expectedMvpDeliverables.length);
      expect(signed.signed_url).toContain("expires=600");
      expect(JSON.stringify(downloadRepository.events)).not.toContain("local-private://");
      expect(verifyNoPrivateApiFields(vault).ok).toBe(true);
      expect(verifyNoPrivateApiFields(downloadableAssets).ok).toBe(true);

      const admin = new AdminService();
      admin.addMockAdmin(sampleAdminUser);
      const login = admin.login({
        email: sampleAdminUser.email,
        password: sampleAdminUser.password
      });
      const context = { sessionToken: login.session_token };
      expect(admin.dashboard(context).paid_orders_stuck_over_30_minutes).toBeGreaterThanOrEqual(0);
      expect(admin.listOrders(context).orders[0]?.masked_customer_email).toContain("***");
      const adminAsset = admin.getAsset(context, "asset_01");
      expect(adminAsset.masked_storage_key).toContain("***");
      expect(JSON.stringify(adminAsset)).not.toContain(`orders/${sampleOrder.order_id}/`);

      const zipBody = await readFile(zip.file_path);
      expect(zipBody.byteLength).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20_000);
});

async function storeAvailableAsset(input: {
  assetRepository: InMemoryAssetRepository;
  storage: LocalPrivateStorageAdapter;
  sourceFilePath: string;
  deliverableCode: string;
  assetType: StoredAssetResult["asset_type"];
  assetKind: StoredAssetResult["asset_kind"];
  fileExt: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
}): Promise<StoredAssetResult> {
  const stored = await storeCandidateAsAsset({
    storage: input.storage,
    repository: input.assetRepository,
    store: {
      order_id: sampleOrder.order_id,
      order_item_id: sampleOrder.order_item_id,
      generation_job_id: "generation_job_e2e",
      deliverable_code: input.deliverableCode,
      house_name: sampleHouseDna.house_name,
      asset_type: input.assetType,
      asset_kind: input.assetKind,
      source_file_path: input.sourceFilePath,
      mime_type: input.mimeType,
      file_ext: input.fileExt,
      width: input.width ?? null,
      height: input.height ?? null
    }
  });

  return input.assetRepository.updateAssetStatus(stored.asset_id, "available_for_download");
}

function toDownloadAssetRecord(asset: StoredAssetResult): DownloadAssetRecord {
  return {
    asset_id: asset.asset_id,
    order_id: asset.order_id,
    deliverable_code: asset.deliverable_code,
    friendly_name: asset.file_name,
    asset_type: asset.asset_type,
    file_ext: asset.file_ext,
    mime_type: asset.mime_type,
    size_bytes: Math.max(asset.size_bytes, minimumE2eDownloadableBytes(asset.file_ext)),
    status: asset.status,
    storage_provider: asset.storage_provider,
    storage_bucket: asset.storage_bucket,
    storage_key: asset.storage_key,
    public_url: asset.public_url,
    deleted_at: null
  };
}

function minimumE2eDownloadableBytes(fileExt: string): number {
  if (fileExt === "zip") return 24 * 1024;
  if (fileExt === "png" || fileExt === "pdf") return 12 * 1024;
  return 2048;
}
