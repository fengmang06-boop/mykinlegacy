export type ManifestStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "partially_completed";

export type OrchestrationAssetType = "image" | "pdf" | "archive" | "preview";
export type OrchestrationAssetKind =
  | "generated"
  | "uploaded"
  | "packaged"
  | "preview"
  | "physical_mockup";

export interface ExpectedAssetContract {
  deliverable_code: string;
  asset_type: OrchestrationAssetType;
  format: string;
  required: boolean;
  quantity: number;
  output_requirements: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  retry_policy: { max_attempts: number };
}

export interface GeneratedAssetContract {
  deliverable_code: string;
  asset_id: string;
}

export interface FailedAssetContract {
  deliverable_code: string;
  error_code: string;
  message: string;
}

export interface OrchestrationOrder {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  metadata_json: Record<string, unknown>;
  order_inputs?: OrchestrationOrderInput[];
  completed_at: string | null;
}

export interface OrchestrationOrderInput {
  input_schema_version: string;
  input_json: Record<string, unknown>;
  normalized_input_json: Record<string, unknown>;
  locale: string;
}

export interface OrchestrationOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  package_id: string;
  product_code: string;
  package_code: string;
}

export interface OrchestrationOutboxEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload_json: Record<string, unknown>;
  status: "pending" | "processing" | "published" | "failed" | "cancelled";
  attempts: number;
  created_at: string;
  published_at: string | null;
}

export interface OrchestrationManifest {
  id: string;
  order_id: string;
  order_item_id: string;
  generation_job_id: string | null;
  house_id: string | null;
  identity_version_id: string | null;
  product_code: string;
  package_code: string;
  expected_assets: ExpectedAssetContract[];
  generated_assets: GeneratedAssetContract[];
  missing_required_assets: string[];
  optional_assets: Array<string | Record<string, unknown>>;
  failed_assets: FailedAssetContract[];
  manifest_status: ManifestStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface OrchestrationGenerationJob {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationAsset {
  id: string;
  order_id: string;
  order_item_id: string;
  generation_job_id: string;
  deliverable_code: string;
  asset_type: OrchestrationAssetType;
  asset_kind: OrchestrationAssetKind;
  status: "pending" | "available" | "failed" | "deleted";
  storage_provider: "local_private" | "s3" | "r2";
  storage_bucket: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_ext: string;
  size_bytes: number;
  checksum_sha256: string;
  public_url: null;
  created_at: string;
}

export interface OrchestrationDownloadToken {
  id: string;
  order_id: string;
  token_hash: string;
  status: "active" | "expired" | "revoked";
  expires_at: string;
  max_downloads: number;
  download_count: number;
  asset_ids: string[];
  created_at: string;
}

export interface OrchestrationEmailLog {
  id: string;
  order_id: string;
  provider: "mock";
  recipient_email_hash: string;
  status: "sent" | "failed" | "bounced";
  payload_json: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
}

export interface OrchestrationRepository {
  findOrder(orderId: string): Promise<OrchestrationOrder | null>;
  findOrderItem(orderItemId: string): Promise<OrchestrationOrderItem | null>;
  listOrderItemsByOrder(orderId?: string): Promise<OrchestrationOrderItem[]>;
  findManifestById(manifestId: string): Promise<OrchestrationManifest | null>;
  findManifestByOrderItem(orderId: string, orderItemId: string): Promise<OrchestrationManifest | null>;
  createManifest(input: OrchestrationManifest): Promise<OrchestrationManifest>;
  updateManifest(input: OrchestrationManifest): Promise<OrchestrationManifest>;
  findGenerationJobByOrderItem(orderId: string, orderItemId: string): Promise<OrchestrationGenerationJob | null>;
  createGenerationJob(input: OrchestrationGenerationJob): Promise<OrchestrationGenerationJob>;
  updateGenerationJob(input: OrchestrationGenerationJob): Promise<OrchestrationGenerationJob>;
  createAsset(input: OrchestrationAsset): Promise<OrchestrationAsset>;
  listAssetsByOrder(orderId: string): Promise<OrchestrationAsset[]>;
  createDownloadToken(input: OrchestrationDownloadToken): Promise<OrchestrationDownloadToken>;
  findDownloadTokenByOrder(orderId: string): Promise<OrchestrationDownloadToken | null>;
  createEmailLog(input: OrchestrationEmailLog): Promise<OrchestrationEmailLog>;
  listEmailLogsByOrder(orderId: string): Promise<OrchestrationEmailLog[]>;
  updateOrderStatus(input: {
    order_id: string;
    order_status?: string;
    fulfillment_status?: string;
    completed_at?: string | null;
  }): Promise<OrchestrationOrder>;
  markOutboxPublished(outboxEventId: string, nowIso: string): Promise<void>;
}
