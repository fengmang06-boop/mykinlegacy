import { describe, expect, it } from "vitest";

import { ApiException } from "../common/api-error";
import { AdminService } from "./admin.service";

type OrchestrationAsset = {
  id: string;
  order_id: string;
  order_item_id: string;
  generation_job_id: string;
  deliverable_code: string;
  asset_type: "image" | "pdf" | "archive" | "preview";
  asset_kind: "generated" | "uploaded" | "packaged" | "preview" | "physical_mockup";
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
};

type OrchestrationDownloadToken = {
  id: string;
  order_id: string;
  token_hash: string;
  status: "active" | "expired" | "revoked";
  expires_at: string;
  max_downloads: number;
  download_count: number;
  asset_ids: string[];
  created_at: string;
};

type OrchestrationEmailLog = {
  id: string;
  order_id: string;
  provider: "mock";
  recipient_email_hash: string;
  status: "sent" | "failed" | "bounced";
  payload_json: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
};

type OrchestrationGenerationJob = {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
};

type OrchestrationManifest = {
  id: string;
  order_id: string;
  order_item_id: string;
  generation_job_id: string | null;
  house_id: string | null;
  identity_version_id: string | null;
  product_code: string;
  package_code: string;
  expected_assets: unknown[];
  generated_assets: Array<{ deliverable_code: string; asset_id: string }>;
  missing_required_assets: string[];
  optional_assets: string[];
  failed_assets: unknown[];
  manifest_status: "pending" | "in_progress" | "completed" | "failed" | "partially_completed";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type OrchestrationOrder = {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  metadata_json: Record<string, unknown>;
  completed_at: string | null;
};

type OrchestrationOrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  package_id: string;
  product_code: string;
  package_code: string;
};

type OrchestrationRepository = object;

describe("admin operations MVP", () => {
  it("logs in mocked admin and returns RBAC session", () => {
    const service = createService();
    const login = service.login({ email: "admin@example.com", password: "secret" });

    expect(login.session_token).toBeTruthy();
    expect(login.admin_user.roles).toContain("admin");
  });

  it("failed login writes audit log", () => {
    const service = createService();

    expect(() => service.login({ email: "admin@example.com", password: "bad" })).toThrow(
      ApiException
    );

    const viewer = login(service, "viewer@example.com");
    const logs = service.listAuditLogs({ sessionToken: viewer });
    expect(logs.audit_logs.some((item) => item.action === "failed_admin_login")).toBe(true);
  });

  it("RBAC denies viewer mutation", () => {
    const service = createService();
    const viewer = login(service, "viewer@example.com");

    expect(() =>
      service.retryGenerationJob({ sessionToken: viewer }, "job_01", "valid reason")
    ).toThrow(ApiException);
  });

  it("support can resend email but cannot activate prompt", () => {
    const service = createService();
    const support = login(service, "support@example.com");

    expect(
      service.resendEmail({ sessionToken: support }, "order_01", "customer requested resend")
    ).toMatchObject({
      queued: true
    });
    expect(() =>
      service.activatePromptVersion({ sessionToken: support }, "prompt_01", "version_02", {
        reason: "activate safe prompt",
        disclaimer_present: true,
        test_passed: true
      })
    ).toThrow(ApiException);
  });

  it("finance can view dashboard but cannot view asset preview", () => {
    const service = createService();
    const finance = login(service, "finance@example.com");

    expect(service.dashboard({ sessionToken: finance })).toHaveProperty("revenue_today");
    expect(() =>
      service.createAssetPreviewUrl(
        { sessionToken: finance },
        "asset_01",
        "finance should not preview"
      )
    ).toThrow(ApiException);
  });

  it("admin can retry failed job with reason and mutation without reason fails", () => {
    const service = createService();
    const admin = login(service, "admin@example.com");

    expect(
      service.retryGenerationJob({ sessionToken: admin }, "job_01", "retry failed provider call")
    ).toMatchObject({
      retry_requested: true
    });
    expect(() => service.retryGenerationJob({ sessionToken: admin }, "job_01", "")).toThrow(
      ApiException
    );
  });

  it("create download token never returns stored raw token from DB and writes audit", () => {
    const service = createService();
    const support = login(service, "support@example.com");
    const result = service.createDownloadToken(
      { sessionToken: support },
      "order_01",
      "customer link expired"
    );

    expect(result.raw_token_stored).toBe(false);
    expect(result.raw_token_for_one_time_delivery_only).toBeTruthy();
    const logs = service.listAuditLogs({ sessionToken: support }).audit_logs;
    expect(logs.some((item) => item.action === "create_download_token")).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(result.raw_token_for_one_time_delivery_only);
  });

  it("revoke download token and revoke asset write audit logs", () => {
    const service = createService();
    const admin = login(service, "admin@example.com");
    const support = login(service, "support@example.com");

    service.revokeDownloadToken({ sessionToken: support }, "token_01", "customer requested revoke");
    service.revokeAsset({ sessionToken: admin }, "asset_01", "unsafe asset");
    const logs = service.listAuditLogs({ sessionToken: admin }).audit_logs;

    expect(logs.some((item) => item.action === "revoke_download_token")).toBe(true);
    expect(logs.some((item) => item.action === "revoke_asset")).toBe(true);
  });

  it("asset preview creates signed URL, audit log, and no storage key", () => {
    const service = createService();
    const support = login(service, "support@example.com");
    const preview = service.createAssetPreviewUrl(
      { sessionToken: support },
      "asset_01",
      "support preview"
    );

    expect(preview.signed_url).toContain("local-private://");
    expect(JSON.stringify(preview)).not.toContain("storage_key");
    expect(
      service
        .listAuditLogs({ sessionToken: support })
        .audit_logs.some((item) => item.action === "view_asset_preview")
    ).toBe(true);
  });

  it("prompt guardrails reject unsafe activation and write audit on activation", () => {
    const service = createService();
    const admin = login(service, "admin@example.com");

    expect(
      service.getPromptVersion({ sessionToken: admin }, "prompt_01", "version_01")
    ).toMatchObject({
      editable: false
    });
    expect(() =>
      service.activatePromptVersion({ sessionToken: admin }, "prompt_01", "version_02", {
        reason: "activate missing disclaimer",
        disclaimer_present: false,
        test_passed: true
      })
    ).toThrow(ApiException);
    service.activatePromptVersion({ sessionToken: admin }, "prompt_01", "version_02", {
      reason: "activate tested safe prompt",
      disclaimer_present: true,
      test_passed: true,
      image_text_generation_enabled: false
    });
    expect(
      service
        .listAuditLogs({ sessionToken: admin })
        .audit_logs.some((item) => item.action === "activate_prompt_version")
    ).toBe(true);
  });

  it("dashboard summary and system health return expected fields", async () => {
    const service = createService();
    const viewer = login(service, "viewer@example.com");

    expect(service.dashboard({ sessionToken: viewer })).toHaveProperty(
      "paid_orders_stuck_over_30_minutes"
    );
    await expect(service.systemHealth({ sessionToken: viewer })).resolves.toMatchObject({
      status: "degraded",
      degraded_services: expect.arrayContaining(["database", "redis"]),
      observability_summary: expect.objectContaining({
        stuck_paid_orders: expect.any(Number),
        failed_jobs: expect.any(Number),
        last_recovery_scan_time: expect.any(String)
      })
    });
  });

  it("shows DB-backed orchestration resources without private storage keys", async () => {
    const repository = createOrchestrationRepository();

    const service = createService(repository);
    const viewer = login(service, "viewer@example.com");
    const orders = service.listOrders({ sessionToken: viewer });
    const detail = service.getOrder({ sessionToken: viewer }, "order_1");
    const serialized = JSON.stringify(detail);

    expect(orders).toMatchObject({ data_source: "db_backed_orchestration_repository" });
    expect(detail).toMatchObject({
      data_source: "db_backed_orchestration_repository",
      download_token: { status: "active", token_hash_present: true }
    });
    expect(serialized).toContain("masked_storage_key");
    expect(serialized).not.toContain("orders/order_1/order_item_1");
    expect(serialized).not.toContain("raw_token");
    expect(serialized).not.toContain("signed_url");
  });
});

function createService(orchestrationRepository?: OrchestrationRepository) {
  const service = new AdminService(orchestrationRepository);
  service.addMockAdmin({
    id: "admin_01",
    email: "admin@example.com",
    password: "secret",
    roles: ["admin"],
    permissions: ["view_private_family_data"]
  });
  service.addMockAdmin({
    id: "support_01",
    email: "support@example.com",
    password: "secret",
    roles: ["support"]
  });
  service.addMockAdmin({
    id: "finance_01",
    email: "finance@example.com",
    password: "secret",
    roles: ["finance"]
  });
  service.addMockAdmin({
    id: "viewer_01",
    email: "viewer@example.com",
    password: "secret",
    roles: ["viewer"]
  });
  return service;
}

function login(service: AdminService, email: string) {
  return service.login({ email, password: "secret" }).session_token;
}

function createOrchestrationRepository() {
  const order: OrchestrationOrder = {
    id: "order_1",
    order_number: "AHL-20260629-ADMIN",
    order_status: "paid",
    payment_status: "paid",
    fulfillment_status: "not_started",
    total_cents: 4900,
    currency: "USD",
    metadata_json: {},
    completed_at: null
  };
  const orderItem: OrchestrationOrderItem = {
    id: "order_item_1",
    order_id: order.id,
    product_id: "product_1",
    package_id: "package_1",
    product_code: "family_legacy_collection",
    package_code: "premium"
  };
  const manifest: OrchestrationManifest = {
    id: "manifest_1",
    order_id: order.id,
    order_item_id: orderItem.id,
    generation_job_id: "job_1",
    house_id: "house_1",
    identity_version_id: "identity_version_1",
    product_code: orderItem.product_code,
    package_code: orderItem.package_code,
    expected_assets: [],
    generated_assets: [{ deliverable_code: "crest_variant_1_png", asset_id: "asset_1" }],
    missing_required_assets: [],
    optional_assets: [],
    failed_assets: [],
    manifest_status: "completed",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    completed_at: new Date(0).toISOString()
  };
  const asset: OrchestrationAsset = {
    id: "asset_1",
    order_id: order.id,
    order_item_id: orderItem.id,
    generation_job_id: "job_1",
    deliverable_code: "crest_variant_1_png",
    asset_type: "image",
    asset_kind: "generated",
    status: "available",
    storage_provider: "local_private",
    storage_bucket: "private-assets",
    storage_key: "orders/order_1/order_item_1/crest_variant_1_png/asset_1.png",
    file_name: "crest_variant_1_png.png",
    mime_type: "image/png",
    file_ext: "png",
    size_bytes: 100,
    checksum_sha256: "a".repeat(64),
    public_url: null,
    created_at: new Date(0).toISOString()
  };
  const token: OrchestrationDownloadToken = {
    id: "token_1",
    order_id: order.id,
    token_hash: "b".repeat(64),
    status: "active",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    max_downloads: 20,
    download_count: 0,
    asset_ids: [asset.id],
    created_at: new Date(0).toISOString()
  };
  const emailLog: OrchestrationEmailLog = {
    id: "email_1",
    order_id: order.id,
    provider: "mock",
    recipient_email_hash: "c".repeat(64),
    status: "sent",
    payload_json: { vault_link_only: true },
    created_at: new Date(0).toISOString(),
    sent_at: new Date(0).toISOString()
  };
  return new TestOrchestrationRepository({
    orders: [order],
    orderItems: [orderItem],
    manifests: [manifest],
    generationJobs: [],
    assets: [asset],
    downloadTokens: [token],
    emailLogs: [emailLog]
  });
}

class TestOrchestrationRepository {
  public readonly orders = new Map<string, OrchestrationOrder>();
  public readonly orderItems = new Map<string, OrchestrationOrderItem>();
  public readonly manifests = new Map<string, OrchestrationManifest>();
  public readonly generationJobs = new Map<string, OrchestrationGenerationJob>();
  public readonly assets = new Map<string, OrchestrationAsset>();
  public readonly downloadTokens = new Map<string, OrchestrationDownloadToken>();
  public readonly emailLogs = new Map<string, OrchestrationEmailLog>();

  constructor(input: {
    orders: OrchestrationOrder[];
    orderItems: OrchestrationOrderItem[];
    manifests: OrchestrationManifest[];
    generationJobs: OrchestrationGenerationJob[];
    assets: OrchestrationAsset[];
    downloadTokens: OrchestrationDownloadToken[];
    emailLogs: OrchestrationEmailLog[];
  }) {
    input.orders.forEach((item) => this.orders.set(item.id, item));
    input.orderItems.forEach((item) => this.orderItems.set(item.id, item));
    input.manifests.forEach((item) => this.manifests.set(item.id, item));
    input.generationJobs.forEach((item) => this.generationJobs.set(item.id, item));
    input.assets.forEach((item) => this.assets.set(item.id, item));
    input.downloadTokens.forEach((item) => this.downloadTokens.set(item.id, item));
    input.emailLogs.forEach((item) => this.emailLogs.set(item.id, item));
  }

  async findOrder(orderId: string) {
    return this.orders.get(orderId) ?? null;
  }

  async findOrderItem(orderItemId: string) {
    return this.orderItems.get(orderItemId) ?? null;
  }

  async listOrderItemsByOrder(orderId?: string) {
    const items = [...this.orderItems.values()];
    return orderId ? items.filter((item) => item.order_id === orderId) : items;
  }

  async findManifestById(manifestId: string) {
    return this.manifests.get(manifestId) ?? null;
  }

  async findManifestByOrderItem(orderId: string, orderItemId: string) {
    return (
      [...this.manifests.values()].find(
        (item) => item.order_id === orderId && item.order_item_id === orderItemId
      ) ?? null
    );
  }

  async createManifest(input: OrchestrationManifest) {
    this.manifests.set(input.id, input);
    return input;
  }

  async updateManifest(input: OrchestrationManifest) {
    this.manifests.set(input.id, input);
    return input;
  }

  async findGenerationJobByOrderItem(orderId: string, orderItemId: string) {
    return (
      [...this.generationJobs.values()].find(
        (item) => item.order_id === orderId && item.order_item_id === orderItemId
      ) ?? null
    );
  }

  async createGenerationJob(input: OrchestrationGenerationJob) {
    this.generationJobs.set(input.id, input);
    return input;
  }

  async updateGenerationJob(input: OrchestrationGenerationJob) {
    this.generationJobs.set(input.id, input);
    return input;
  }

  async createAsset(input: OrchestrationAsset) {
    this.assets.set(input.id, input);
    return input;
  }

  async listAssetsByOrder(orderId: string) {
    return [...this.assets.values()].filter((item) => item.order_id === orderId);
  }

  async createDownloadToken(input: OrchestrationDownloadToken) {
    this.downloadTokens.set(input.id, input);
    return input;
  }

  async findDownloadTokenByOrder(orderId: string) {
    return [...this.downloadTokens.values()].find((item) => item.order_id === orderId) ?? null;
  }

  async createEmailLog(input: OrchestrationEmailLog) {
    this.emailLogs.set(input.id, input);
    return input;
  }

  async listEmailLogsByOrder(orderId: string) {
    return [...this.emailLogs.values()].filter((item) => item.order_id === orderId);
  }

  async updateOrderStatus(input: {
    order_id: string;
    order_status?: string;
    fulfillment_status?: string;
    completed_at?: string | null;
  }) {
    const order = this.orders.get(input.order_id);
    if (!order) throw new Error("order_not_found");
    const updated = {
      ...order,
      order_status: input.order_status ?? order.order_status,
      fulfillment_status: input.fulfillment_status ?? order.fulfillment_status,
      completed_at: input.completed_at === undefined ? order.completed_at : input.completed_at
    };
    this.orders.set(updated.id, updated);
    return updated;
  }

  async markOutboxPublished(_outboxEventId: string, _nowIso: string) {
    return;
  }
}
