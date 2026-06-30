export type AssetLifecycleStatus =
  | "temporary_output"
  | "validation_pending"
  | "validated"
  | "stored_private"
  | "available_for_download"
  | "revoked"
  | "deleted";

export interface StorageObjectRef {
  storage_provider: string;
  storage_bucket: string;
  storage_key: string;
}

export interface PutObjectInput {
  bucket: string;
  storage_key: string;
  content_type: string;
  body?: Buffer | string;
  file_path?: string;
  metadata: Record<string, string>;
  private: true;
}

export interface PutObjectOutput extends StorageObjectRef {
  size_bytes: number;
  checksum_sha256: string;
  mime_type: string;
  public_url: null;
}

export interface StorageProviderAdapter {
  provider_code: string;
  putObject(input: PutObjectInput): Promise<PutObjectOutput>;
  getObject(input: StorageObjectRef): Promise<Buffer>;
  deleteObject(input: StorageObjectRef): Promise<void>;
  objectExists(input: StorageObjectRef): Promise<boolean>;
  createSignedUrl(input: StorageObjectRef & { expires_in_seconds: number }): Promise<string>;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] };
}

export interface ImageCandidate {
  candidate_id: string;
  candidate_type: "image";
  deliverable_code: string;
  temporary_output_ref: string;
  validation_status: string;
  ai_generation_run_id: string;
  ready_for_next_step: boolean;
}

export interface TextCandidate {
  candidate_id: string;
  candidate_type: "text";
  deliverable_code: string;
  output_text: string;
  structured_output_json: Record<string, unknown>;
  validation_status: string;
  ai_generation_run_id: string;
  ready_for_next_step: boolean;
}

export type AssetCandidate = ImageCandidate | TextCandidate;

export interface StoredAssetResult {
  asset_id: string;
  order_id: string;
  order_item_id: string;
  generation_job_id: string;
  deliverable_code: string;
  asset_type: "image" | "pdf" | "archive" | "preview";
  asset_kind: "generated" | "uploaded" | "packaged" | "preview" | "physical_mockup";
  status: AssetLifecycleStatus;
  storage_provider: string;
  storage_bucket: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_ext: string;
  size_bytes: number;
  checksum_sha256: string;
  width: number | null;
  height: number | null;
  public_url: null;
}

export interface AssetRepository {
  createAssetRecord(input: StoredAssetResult): Promise<StoredAssetResult>;
  updateAssetStatus(assetId: string, status: AssetLifecycleStatus): Promise<StoredAssetResult>;
  linkAssetToDeliverable(input: { asset_id: string; deliverable_code: string }): Promise<void>;
  getAssetsByOrder(orderId: string): Promise<StoredAssetResult[]>;
  getAssetsByOrderItem(orderItemId: string): Promise<StoredAssetResult[]>;
}

export interface StoreAssetInput {
  order_id: string;
  order_item_id: string;
  generation_job_id: string;
  deliverable_code: string;
  house_name: string;
  asset_type: StoredAssetResult["asset_type"];
  asset_kind: StoredAssetResult["asset_kind"];
  source_file_path?: string;
  source_body?: Buffer;
  mime_type?: string;
  file_ext?: string;
  width?: number | null;
  height?: number | null;
  bucket?: string;
}
