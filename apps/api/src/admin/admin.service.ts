import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api-error";
import type { AdminAction, AdminAuditLog, AdminRole, AdminSession } from "./admin.types";

const observability = requireObservability();

interface AdminUser {
  id: string;
  email_hash: string;
  password_hash: string;
  roles: AdminRole[];
  permissions: string[];
}

interface AdminRequestContext {
  sessionToken?: string;
  ip?: string | null;
  userAgent?: string | null;
}

interface ObservabilityModule {
  ALL_QUEUE_NAMES: readonly string[];
  collectMvpMetrics(snapshot: unknown, now?: Date): AdminMetrics;
  runRecoveryScan(snapshot: unknown, now?: Date): Array<Record<string, unknown>>;
  createDlqAlert(deadLetterCount: number): Record<string, unknown> | null;
  systemHealthSummary(input: {
    queueNames: readonly string[];
    workerCount?: number;
    databaseCheck?: () => Promise<unknown>;
    redisCheck?: () => Promise<unknown>;
    localPrivateDir?: string;
    env?: NodeJS.ProcessEnv;
  }): Promise<{ status: string; degraded_services: string[]; checks: unknown[] }>;
}

interface AdminMetrics {
  paid_orders_stuck_over_30m: number;
  orders_processing_over_30m: number;
  failed_generation_jobs: number;
  dead_letter_count: number;
  outbox_pending_count: number;
  outbox_failed_count: number;
  manifests_partially_completed: number;
  email_failures_24h: number;
  storage_failures_24h: number;
  ai_provider_failures_24h: number;
  webhook_failures_24h: number;
  average_generation_time_ms: number | null;
  average_ai_cost_cents: number | null;
  orders_completed_today: number;
  revenue_today_cents: number;
  image_text_detection_failures: number;
  download_token_expired_count_24h: number;
  signed_url_failures_24h: number;
}

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  finance: 2,
  support: 3,
  admin: 4,
  super_admin: 5
};

@Injectable()
export class AdminService {
  private readonly users: AdminUser[] = [];
  private readonly sessions = new Map<string, AdminSession>();
  private readonly auditLogs: AdminAuditLog[] = [];

  constructor(private readonly orchestrationRepository?: object) {
    this.bootstrapDevAdminIfAllowed();
  }

  login(input: { email?: string; password?: string; context?: AdminRequestContext }) {
    const email = input.email ?? "";
    const password = input.password ?? "";
    const user = this.users.find((item) => item.email_hash === hashValue(email.toLowerCase()));

    if (!user || !verifyPassword(password, user.password_hash)) {
      this.writeAudit({
        action: "failed_admin_login",
        actorId: null,
        entityType: "admin_session",
        entityId: null,
        reason: "invalid_credentials",
        context: input.context
      });
      throw new ApiException({
        errorCode: "admin_unauthorized",
        message: "Admin login failed.",
        userMessage: "Invalid admin credentials.",
        status: HttpStatus.UNAUTHORIZED
      });
    }

    const rawSessionToken = randomBytes(32).toString("base64url");
    const session: AdminSession = {
      session_id: hashValue(rawSessionToken),
      admin_user_id: user.id,
      email_hash: user.email_hash,
      roles: user.roles,
      permissions: user.permissions,
      created_at: new Date().toISOString()
    };
    this.sessions.set(session.session_id, session);
    this.writeAudit({
      action: "admin_login",
      actorId: user.id,
      entityType: "admin_session",
      entityId: session.session_id,
      reason: "login",
      context: input.context
    });

    return {
      session_token: rawSessionToken,
      admin_user: serializeSession(session)
    };
  }

  logout(context: AdminRequestContext) {
    const session = this.requireSession(context);
    this.sessions.delete(session.session_id);
    this.writeAudit({
      action: "admin_login",
      actorId: session.admin_user_id,
      entityType: "admin_session",
      entityId: session.session_id,
      reason: "logout",
      context
    });
    return { logged_out: true };
  }

  me(context: AdminRequestContext) {
    return serializeSession(this.requireSession(context));
  }

  dashboard(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    const metrics = observability.collectMvpMetrics(
      createAdminObservabilitySnapshot(),
      new Date("2026-06-29T01:00:00.000Z")
    );
    const recoveryIssues = observability.runRecoveryScan(
      createAdminRecoverySnapshot(),
      new Date("2026-06-29T01:00:00.000Z")
    );
    const dlqAlert = observability.createDlqAlert(metrics.dead_letter_count);
    return {
      paid_orders_stuck_over_30_minutes: metrics.paid_orders_stuck_over_30m,
      failed_jobs: metrics.failed_generation_jobs,
      dlq_count: metrics.dead_letter_count,
      manifests_partially_completed: metrics.manifests_partially_completed,
      email_failures: metrics.email_failures_24h,
      storage_failures: metrics.storage_failures_24h,
      ai_provider_failures: metrics.ai_provider_failures_24h,
      webhook_failures: metrics.webhook_failures_24h,
      outbox_pending_count: metrics.outbox_pending_count,
      outbox_failed_count: metrics.outbox_failed_count,
      orders_processing_over_30m: metrics.orders_processing_over_30m,
      average_generation_time_ms: metrics.average_generation_time_ms,
      average_ai_cost_cents: metrics.average_ai_cost_cents,
      orders_completed_today: metrics.orders_completed_today,
      revenue_today: { cents: metrics.revenue_today_cents, currency: "USD" },
      image_text_detection_failures: metrics.image_text_detection_failures,
      download_token_expired_count_24h: metrics.download_token_expired_count_24h,
      signed_url_failures_24h: metrics.signed_url_failures_24h,
      recovery_issue_count: recoveryIssues.length,
      last_recovery_scan_at: new Date("2026-06-29T01:00:00.000Z").toISOString(),
      alert_foundation: dlqAlert,
      data_source: "mvp_mock_snapshot"
    };
  }

  listOrders(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    if (this.orchestrationRepository) {
      const repo = orchestrationSnapshot(this.orchestrationRepository);
      return {
        orders: [...(repo.orders?.values() ?? [])].map((order) => ({
          order_id: order.id,
          order_number: order.order_number,
          masked_customer_email: "cu***@example.test",
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status,
          amount: { total_cents: order.total_cents, currency: order.currency }
        })),
        next_cursor: null,
        data_source: "db_backed_orchestration_repository"
      };
    }
    return {
      orders: [
        {
          order_id: "order_01",
          order_number: "AHL-20260629-DEMO",
          masked_customer_email: "cu***@example.com",
          order_status: "pending_payment",
          payment_status: "unpaid",
          fulfillment_status: "not_started",
          amount: { total_cents: 4900, currency: "USD" },
          created_at: new Date(0).toISOString()
        }
      ],
      next_cursor: null
    };
  }

  getOrder(context: AdminRequestContext, orderId: string) {
    this.requireRole(context, "viewer");
    if (this.orchestrationRepository) {
      const repo = orchestrationSnapshot(this.orchestrationRepository);
      const order = repo.orders?.get(orderId);
      const manifest = [...(repo.manifests?.values() ?? [])].find(
        (item) => item.order_id === orderId
      );
      const assets = [...(repo.assets?.values() ?? [])].filter((asset) => asset.order_id === orderId);
      const token = [...(repo.downloadTokens?.values() ?? [])].find(
        (item) => item.order_id === orderId
      );
      const emailLogs = [...(repo.emailLogs?.values() ?? [])].filter(
        (item) => item.order_id === orderId
      );
      return {
        order,
        manifest,
        assets: assets.map((asset) => ({
          asset_id: asset.id,
          deliverable_code: asset.deliverable_code,
          status: asset.status,
          masked_storage_key: maskStorageKey(asset.storage_key),
          public_url: asset.public_url
        })),
        download_token: token
          ? {
              token_id: token.id,
              status: token.status,
              token_hash_present: Boolean(token.token_hash),
              asset_count: token.asset_ids.length
            }
          : null,
        email_logs: emailLogs.map((log) => ({
          email_log_id: log.id,
          provider: log.provider,
          status: log.status
        })),
        data_source: "db_backed_orchestration_repository"
      };
    }
    return {
      order_id: orderId,
      order_number: "AHL-20260629-DEMO",
      masked_customer_email: "cu***@example.com",
      statuses: {
        order_status: "pending_payment",
        payment_status: "unpaid",
        fulfillment_status: "not_started"
      },
      product_code: "family_legacy_collection",
      package_code: "core",
      amount: { total_cents: 4900, currency: "USD" },
      paid_at: null,
      completed_at: null,
      consent_status: "missing",
      house_id: "house_01",
      identity_version_id: "identity_version_01",
      generation_manifest_summary: null,
      generated_assets: [],
      failed_assets: [],
      download_token_status: "none",
      email_delivery_status: "not_sent",
      status_history: [],
      admin_notes: []
    };
  }

  resendEmail(context: AdminRequestContext, orderId: string, reason?: string) {
    const session = this.requireRole(context, "support");
    this.requireReason(reason);
    this.writeAuditMutation(session, "resend_email", "order", orderId, reason, context, {
      email_contains_signed_url: false
    });
    return { queued: true, email_contains_download_vault_link_only: true };
  }

  createDownloadToken(context: AdminRequestContext, orderId: string, reason?: string) {
    const session = this.requireRole(context, "support");
    this.requireReason(reason);
    this.writeAuditMutation(session, "create_download_token", "order", orderId, reason, context, {
      raw_token_stored: false
    });
    return {
      download_token_id: "download_token_admin_created",
      raw_token_for_one_time_delivery_only: "admin_one_time_token_placeholder",
      raw_token_stored: false
    };
  }

  revokeDownloadToken(context: AdminRequestContext, tokenId: string, reason?: string) {
    const session = this.requireRole(context, "support");
    this.requireReason(reason);
    this.writeAuditMutation(
      session,
      "revoke_download_token",
      "download_token",
      tokenId,
      reason,
      context,
      null
    );
    return { token_id: tokenId, status: "revoked" };
  }

  listGenerationJobs(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    return {
      generation_jobs: [
        {
          job_id: "job_01",
          queue_name: "ai-image-generation",
          status: "failed",
          retry_count: 1,
          max_attempts: 3,
          error_code: "provider_timeout",
          order_id: "order_01",
          manifest_id: "manifest_01"
        }
      ],
      next_cursor: null
    };
  }

  getGenerationJob(context: AdminRequestContext, jobId: string) {
    const session = this.requireRole(context, "viewer");
    const canViewPrompt =
      this.hasRole(session, "super_admin") ||
      (this.hasRole(session, "admin") && session.permissions.includes("view_private_family_data"));
    return {
      job_id: jobId,
      queue_name: "ai-image-generation",
      job_status: "failed",
      retry_count: 1,
      max_attempts: 3,
      error_code: "provider_timeout",
      error_message: "Provider timeout",
      started_at: null,
      completed_at: null,
      provider_request_id: null,
      ai_cost_summary: { estimated_cents: 0 },
      linked_manifest: "manifest_01",
      linked_assets: [],
      prompt_template_version_id: "prompt_version_01",
      validation_result_summary: { status: "failed" },
      rendered_prompt: canViewPrompt ? "redacted demo prompt visible to allowed admin roles" : null
    };
  }

  retryGenerationJob(context: AdminRequestContext, jobId: string, reason?: string) {
    const session = this.requireRole(context, "admin");
    this.requireReason(reason);
    this.writeAuditMutation(
      session,
      "retry_generation_job",
      "generation_job",
      jobId,
      reason,
      context,
      {
        cost_warning_acknowledged: true
      }
    );
    return {
      job_id: jobId,
      retry_requested: true,
      cost_warning: "Retry may create additional AI cost."
    };
  }

  getManifest(context: AdminRequestContext, manifestId: string) {
    this.requireRole(context, "viewer");
    return {
      manifest_id: manifestId,
      expected_assets: [],
      generated_assets: [],
      missing_required_assets: ["download_package_zip"],
      optional_assets: [],
      failed_assets: ["crest_variant_2_png"],
      manifest_status: "partially_completed",
      zip_readiness: "blocked",
      completion_blockers: ["failed_required_asset"],
      worker_timeline_placeholder: [],
      prompt_versions_used: []
    };
  }

  retryFailedAssets(context: AdminRequestContext, manifestId: string, reason?: string) {
    const session = this.requireRole(context, "admin");
    this.requireReason(reason);
    this.writeAuditMutation(
      session,
      "retry_failed_asset",
      "generation_manifest",
      manifestId,
      reason,
      context,
      {
        retry_scope: "failed_assets_only"
      }
    );
    return { manifest_id: manifestId, retry_scope: "failed_assets_only", retry_requested: true };
  }

  listAssets(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    return {
      assets: [
        {
          asset_id: "asset_01",
          deliverable_code: "crest_variant_1_png",
          asset_type: "image",
          asset_kind: "generated",
          status: "available",
          file_name: "crest-variant-1.png",
          mime_type: "image/png",
          size_bytes: 1000
        }
      ],
      next_cursor: null
    };
  }

  getAsset(context: AdminRequestContext, assetId: string) {
    this.requireRole(context, "viewer");
    return {
      asset_id: assetId,
      deliverable_code: "crest_variant_1_png",
      asset_type: "image",
      asset_kind: "generated",
      status: "available",
      file_name: "crest-variant-1.png",
      mime_type: "image/png",
      size_bytes: 1000,
      checksum_sha256: "a".repeat(64),
      storage_provider: "local_private",
      masked_storage_key: "orders/***/asset_01.png",
      created_at: new Date(0).toISOString(),
      validation_result: { status: "passed" },
      download_count: 0,
      revoked_at: null
    };
  }

  createAssetPreviewUrl(context: AdminRequestContext, assetId: string, reason?: string) {
    const session = this.requireRole(context, "support");
    if (this.hasRole(session, "finance")) {
      this.throwForbidden();
    }
    this.requireReason(reason);
    this.writeAuditMutation(session, "view_asset_preview", "asset", assetId, reason, context, {
      signed_url_persisted: false
    });
    return {
      asset_id: assetId,
      signed_url: "local-private://preview/redacted?expires=600",
      expires_at: new Date(Date.now() + 600_000).toISOString()
    };
  }

  revokeAsset(context: AdminRequestContext, assetId: string, reason?: string) {
    const session = this.requireRole(context, "admin");
    this.requireReason(reason);
    this.writeAuditMutation(session, "revoke_asset", "asset", assetId, reason, context, null);
    return { asset_id: assetId, status: "deleted", download_vault_allowed: false };
  }

  listDownloadTokens(context: AdminRequestContext) {
    this.requireRole(context, "support");
    return {
      download_tokens: [
        {
          token_id: "download_token_01",
          partial_token_hash: "abcd...7890",
          order_id: "order_01",
          status: "active",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          max_downloads: 20,
          download_count: 0,
          created_by: "system",
          revoked_at: null,
          linked_asset_count: 3,
          download_event_summary: { page_view: 1, signed_url_created: 0 }
        }
      ]
    };
  }

  listEmailLogs(context: AdminRequestContext) {
    this.requireRole(context, "support");
    return {
      email_logs: [
        {
          email_type: "delivery_ready",
          masked_recipient_email: "cu***@example.com",
          provider: "mock",
          provider_message_id: "mock_01",
          status: "sent",
          sent_at: new Date(0).toISOString(),
          error_message: null,
          retry_count: 0,
          linked_order: "order_01",
          linked_download_token: "download_token_01"
        }
      ]
    };
  }

  listPromptTemplates(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    return {
      prompt_templates: [{ id: "prompt_01", code: "crest_image", active_version_id: "version_01" }]
    };
  }

  getPromptTemplate(context: AdminRequestContext, id: string) {
    this.requireRole(context, "viewer");
    return { id, code: "crest_image", active_version_id: "version_01", versions: ["version_01"] };
  }

  getPromptVersion(context: AdminRequestContext, id: string, versionId: string) {
    this.requireRole(context, "viewer");
    return {
      prompt_template_id: id,
      version_id: versionId,
      status: "active",
      editable: false,
      rendered_prompt_visible: false,
      disclaimer_present: true,
      image_text_generation_enabled: false
    };
  }

  createPromptVersion(context: AdminRequestContext, id: string, reason?: string) {
    const session = this.requireRole(context, "admin");
    this.requireReason(reason);
    this.writeAuditMutation(
      session,
      "create_prompt_version",
      "prompt_template",
      id,
      reason,
      context,
      {
        status: "draft"
      }
    );
    return { prompt_template_id: id, version_id: "draft_version_01", status: "draft" };
  }

  activatePromptVersion(
    context: AdminRequestContext,
    id: string,
    versionId: string,
    body: Record<string, unknown>
  ) {
    const session = this.requireRole(context, "admin");
    this.requireReason(typeof body.reason === "string" ? body.reason : undefined);
    if (
      body.disclaimer_present !== true ||
      body.test_passed !== true ||
      body.image_text_generation_enabled === true
    ) {
      throw new ApiException({
        errorCode: "validation_error",
        message: "Prompt activation guardrails failed.",
        userMessage: "Prompt version cannot be activated until MVP validation passes.",
        status: HttpStatus.BAD_REQUEST
      });
    }
    this.writeAuditMutation(
      session,
      "activate_prompt_version",
      "prompt_template_version",
      versionId,
      String(body.reason),
      context,
      {
        prompt_template_id: id
      }
    );
    return { prompt_template_id: id, version_id: versionId, status: "active" };
  }

  knowledgeLibrary(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    return {
      entries: [
        {
          code: "lion",
          source_type: "internal_curated",
          confidence_level: "high",
          reviewed_by_admin: true,
          active: true
        }
      ],
      ai_suggested_auto_approval_enabled: false
    };
  }

  listAuditLogs(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    return { audit_logs: this.auditLogs };
  }

  async systemHealth(context: AdminRequestContext) {
    this.requireRole(context, "viewer");
    const summary = await observability.systemHealthSummary({
      queueNames: observability.ALL_QUEUE_NAMES,
      workerCount: 13,
      databaseCheck: async () => {
        throw new Error("db_health_check_not_configured_in_mvp");
      },
      redisCheck: async () => {
        throw new Error("redis_health_check_not_configured_in_mvp");
      },
      localPrivateDir: process.env.LOCAL_STORAGE_DIR,
      env: process.env
    });
    const metrics = observability.collectMvpMetrics(
      createAdminObservabilitySnapshot(),
      new Date("2026-06-29T01:00:00.000Z")
    );
    return {
      status: summary.status,
      degraded_services: summary.degraded_services,
      checks: summary.checks,
      observability_summary: {
        stuck_paid_orders: metrics.paid_orders_stuck_over_30m,
        failed_jobs: metrics.failed_generation_jobs,
        dlq_count: metrics.dead_letter_count,
        partially_completed_manifests: metrics.manifests_partially_completed,
        email_failures: metrics.email_failures_24h,
        storage_failures: metrics.storage_failures_24h,
        ai_provider_failures: metrics.ai_provider_failures_24h,
        outbox_pending: metrics.outbox_pending_count,
        outbox_failed: metrics.outbox_failed_count,
        last_recovery_scan_time: new Date("2026-06-29T01:00:00.000Z").toISOString(),
        data_source: "mvp_mock_snapshot"
      }
    };
  }

  private bootstrapDevAdminIfAllowed() {
    if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") {
      return;
    }
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !password || password === "replace_me") {
      return;
    }
    this.users.push({
      id: "admin_bootstrap",
      email_hash: hashValue(email.toLowerCase()),
      password_hash: hashPassword(password),
      roles: ["super_admin"],
      permissions: ["view_private_family_data"]
    });
  }

  addMockAdmin(input: {
    id: string;
    email: string;
    password: string;
    roles: AdminRole[];
    permissions?: string[];
  }) {
    this.users.push({
      id: input.id,
      email_hash: hashValue(input.email.toLowerCase()),
      password_hash: hashPassword(input.password),
      roles: input.roles,
      permissions: input.permissions ?? []
    });
  }

  private requireSession(context: AdminRequestContext): AdminSession {
    const token = context.sessionToken ?? "";
    const session = this.sessions.get(hashValue(token));
    if (!session) {
      throw new ApiException({
        errorCode: "admin_unauthorized",
        message: "Admin session required.",
        userMessage: "Please log in.",
        status: HttpStatus.UNAUTHORIZED
      });
    }
    return session;
  }

  private requireRole(context: AdminRequestContext, minimumRole: AdminRole): AdminSession {
    const session = this.requireSession(context);
    if (!this.hasMinimumRole(session, minimumRole)) {
      this.throwForbidden();
    }
    return session;
  }

  private hasMinimumRole(session: AdminSession, minimumRole: AdminRole): boolean {
    return session.roles.some((role) => ROLE_RANK[role] >= ROLE_RANK[minimumRole]);
  }

  private hasRole(session: AdminSession, role: AdminRole): boolean {
    return session.roles.includes(role);
  }

  private throwForbidden(): never {
    throw new ApiException({
      errorCode: "admin_forbidden",
      message: "Admin permission denied.",
      userMessage: "You do not have permission for this admin action.",
      status: HttpStatus.FORBIDDEN
    });
  }

  private requireReason(reason?: string): string {
    if (!reason || reason.trim().length < 5) {
      throw new ApiException({
        errorCode: "admin_reason_required",
        message: "Admin mutation reason is required.",
        userMessage: "Please provide a reason before continuing.",
        status: HttpStatus.BAD_REQUEST,
        affectedField: "reason"
      });
    }
    return reason.trim();
  }

  private writeAuditMutation(
    session: AdminSession,
    action: AdminAction,
    entityType: string,
    entityId: string,
    reason: string | undefined,
    context: AdminRequestContext,
    after: Record<string, unknown> | null
  ) {
    this.writeAudit({
      action,
      actorId: session.admin_user_id,
      entityType,
      entityId,
      reason: this.requireReason(reason),
      context,
      after
    });
  }

  private writeAudit(input: {
    action: AdminAction;
    actorId: string | null;
    entityType: string;
    entityId: string | null;
    reason: string | null;
    context?: AdminRequestContext;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }) {
    this.auditLogs.push({
      id: `audit_${this.auditLogs.length + 1}`,
      actor_type: input.actorId ? "admin" : "system",
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      before_json: input.before ?? null,
      after_json: input.after ?? null,
      reason: input.reason,
      ip_hash: input.context?.ip ? hashValue(input.context.ip) : null,
      user_agent_hash: input.context?.userAgent ? hashValue(input.context.userAgent) : null,
      created_at: new Date().toISOString()
    });
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${digest}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [, iterations, salt, digest] = stored.split("$");
  if (!iterations || !salt || !digest) {
    return false;
  }
  const actual = pbkdf2Sync(password, salt, Number(iterations), 32, "sha256");
  const expected = Buffer.from(digest, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function serializeSession(session: AdminSession) {
  return {
    admin_user_id: session.admin_user_id,
    email_hash: session.email_hash,
    roles: session.roles,
    permissions: session.permissions,
    mfa_ready: true
  };
}

function orchestrationSnapshot(repository: object) {
  return repository as unknown as {
    orders?: Map<
      string,
      {
        id: string;
        order_number: string;
        payment_status: string;
        fulfillment_status: string;
        total_cents: number;
        currency: string;
      }
    >;
    manifests?: Map<
      string,
      {
        id: string;
        order_id: string;
        manifest_status: string;
        generated_assets: unknown[];
        failed_assets: unknown[];
        missing_required_assets: string[];
      }
    >;
    assets?: Map<
      string,
      {
        id: string;
        order_id: string;
        deliverable_code: string;
        status: string;
        storage_key: string;
        public_url: null;
      }
    >;
    downloadTokens?: Map<
      string,
      {
        id: string;
        order_id: string;
        status: string;
        token_hash: string;
        asset_ids: string[];
      }
    >;
    emailLogs?: Map<
      string,
      {
        id: string;
        order_id: string;
        provider: string;
        status: string;
      }
    >;
  };
}

function maskStorageKey(value: string): string {
  const parts = value.split("/");
  return parts.length > 2 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

function requireObservability(): ObservabilityModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@ai-heritage/observability") as ObservabilityModule;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../../packages/observability/src") as ObservabilityModule;
  }
}

function createAdminObservabilitySnapshot() {
  return {
    paidOrders: [
      {
        id: "order_stuck_01",
        paid_at: "2026-06-29T00:00:00.000Z",
        fulfillment_status: "not_started"
      }
    ],
    processingOrders: [{ id: "order_processing_01", started_at: "2026-06-29T00:00:00.000Z" }],
    generationJobs: [{ id: "job_failed_01", status: "failed" }],
    outboxEvents: [
      { id: "outbox_pending_01", status: "pending", created_at: "2026-06-29T00:00:00.000Z" },
      { id: "outbox_failed_01", status: "failed", created_at: "2026-06-29T00:10:00.000Z" }
    ],
    manifests: [{ id: "manifest_partial_01", status: "partially_completed" }],
    emailLogs: [
      { id: "email_failed_01", status: "failed", created_at: "2026-06-29T00:30:00.000Z" }
    ],
    storageEvents: [
      { id: "storage_failed_01", status: "failed", created_at: "2026-06-29T00:30:00.000Z" }
    ],
    aiRuns: [{ id: "ai_failed_01", status: "failed", created_at: "2026-06-29T00:30:00.000Z" }],
    webhookEvents: [
      { id: "webhook_failed_01", status: "failed", created_at: "2026-06-29T00:30:00.000Z" }
    ],
    orders: [
      {
        id: "order_complete_01",
        status: "completed",
        completed_at: "2026-06-29T00:45:00.000Z",
        total_cents: 4900
      }
    ],
    deadLetterCount: 1
  };
}

function createAdminRecoverySnapshot() {
  return {
    orders: [
      {
        id: "order_stuck_01",
        payment_status: "paid",
        fulfillment_status: "not_started",
        paid_at: "2026-06-29T00:00:00.000Z",
        has_order_paid_outbox: false
      }
    ],
    outboxEvents: [
      { id: "outbox_pending_01", status: "pending", created_at: "2026-06-29T00:00:00.000Z" },
      { id: "outbox_failed_01", status: "failed", created_at: "2026-06-29T00:10:00.000Z" }
    ],
    generationJobs: [
      { id: "job_failed_01", status: "failed", updated_at: "2026-06-29T00:10:00.000Z" }
    ],
    manifests: [{ id: "manifest_partial_01", status: "partially_completed" }],
    emailLogs: [{ id: "email_failed_01", status: "failed" }]
  };
}
