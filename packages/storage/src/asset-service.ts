import { readFile } from "node:fs/promises";

import type {
  AssetRepository,
  StoreAssetInput,
  StoredAssetResult,
  StorageProviderAdapter
} from "./types";
import { buildSafeFileName, buildStorageKey, detectMimeType, randomAssetId } from "./utils";

export async function storeCandidateAsAsset(input: {
  store: StoreAssetInput;
  storage: StorageProviderAdapter;
  repository: AssetRepository;
}): Promise<StoredAssetResult> {
  const assetId = randomAssetId();
  const ext = input.store.file_ext ?? inferExt(input.store.mime_type ?? input.store.source_file_path ?? "");
  const mimeType =
    input.store.mime_type ??
    detectMimeType({
      file_path: input.store.source_file_path,
      body: input.store.source_body
    });
  const body = input.store.source_body ?? (await readFile(input.store.source_file_path ?? ""));
  const storageKey = buildStorageKey({
    order_id: input.store.order_id,
    order_item_id: input.store.order_item_id,
    deliverable_code: input.store.deliverable_code,
    asset_id: assetId,
    ext
  });
  const putOutput = await input.storage.putObject({
    bucket: input.store.bucket ?? "private-assets",
    storage_key: storageKey,
    content_type: mimeType,
    body,
    metadata: {
      deliverable_code: input.store.deliverable_code
    },
    private: true
  });
  const record: StoredAssetResult = {
    asset_id: assetId,
    order_id: input.store.order_id,
    order_item_id: input.store.order_item_id,
    generation_job_id: input.store.generation_job_id,
    deliverable_code: input.store.deliverable_code,
    asset_type: input.store.asset_type,
    asset_kind: input.store.asset_kind,
    status: "stored_private",
    storage_provider: putOutput.storage_provider,
    storage_bucket: putOutput.storage_bucket,
    storage_key: putOutput.storage_key,
    file_name: buildSafeFileName({
      house_name: input.store.house_name,
      deliverable_code: input.store.deliverable_code,
      ext
    }),
    mime_type: putOutput.mime_type,
    file_ext: ext,
    size_bytes: putOutput.size_bytes,
    checksum_sha256: putOutput.checksum_sha256,
    width: input.store.width ?? null,
    height: input.store.height ?? null,
    public_url: null
  };

  await input.repository.createAssetRecord(record);
  await input.repository.linkAssetToDeliverable({
    asset_id: assetId,
    deliverable_code: input.store.deliverable_code
  });
  return record;
}

export async function revokeAsset(input: {
  repository: AssetRepository;
  asset_id: string;
}): Promise<StoredAssetResult> {
  return input.repository.updateAssetStatus(input.asset_id, "revoked");
}

export function isAssetDownloadable(asset: StoredAssetResult): boolean {
  return asset.status === "available_for_download";
}

function inferExt(value: string): string {
  if (value.includes("pdf")) return "pdf";
  if (value.includes("zip")) return "zip";
  if (value.includes("png")) return "png";
  if (value.endsWith(".txt")) return "txt";
  return "bin";
}
