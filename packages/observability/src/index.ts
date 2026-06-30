import { createHash, randomUUID } from "node:crypto";
import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export const packageName = "@ai-heritage/observability";
export const ALL_QUEUE_NAMES = [
  "payment-confirmation",
  "generation-manifest",
  "generation",
  "prompt-rendering",
  "ai-image-generation",
  "ai-text-generation",
  "ai-output-validation",
  "image-postprocess",
  "pdf-generation",
  "zip-packaging",
  "asset-storage",
  "download-token",
  "email-delivery",
  "cleanup",
  "dead-letter"
] as const;

export type LogLevel = "debug" | "info" | "warn" | "error";
export type Severity = "low" | "medium" | "high" | "critical";
export type HealthStatus = "ok" | "degraded" | "unavailable";

const SENSITIVE_KEYS = [
  "customer_email",
  "email",
  "raw_token",
  "token",
  "signed_url",
  "storage_key",
  "stripe_secret",
  "webhook_secret",
  "api_key",
  "housedna",
  "house_dna",
  "rendered_prompt",
  "prompt",
  "family_story",
  "card_number"
];

const SENSITIVE_VALUE_PATTERNS = [
  /https?:\/\/[^\s"]*signed[^\s"]*/gi,
  /local-private:\/\/[^\s"]+/gi,
  /sk_(test|live)_[A-Za-z0-9_]+/g,
  /whsec_[A-Za-z0-9_]+/g
];

export interface StructuredLogInput {
  level: LogLevel;
  service: string;
  module: string;
  message: string;
  request_id?: string | null;
  correlation_id?: string | null;
  job_id?: string | null;
  queue_name?: string | null;
  order_id?: string | null;
  order_number?: string | null;
  manifest_id?: string | null;
  asset_id?: string | null;
  provider_code?: string | null;
  provider_request_id?: string | null;
  duration_ms?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  retry_count?: number | null;
  context?: Record<string, unknown> | null;
}

export interface StructuredLogRecord extends Omit<StructuredLogInput, "context"> {
  timestamp: string;
  context?: Record<string, unknown>;
}

export function createStructuredLog(input: StructuredLogInput): StructuredLogRecord {
  return {
    timestamp: new Date().toISOString(),
    level: input.level,
    service: input.service,
    module: input.module,
    message: input.message,
    request_id: input.request_id ?? null,
    correlation_id: input.correlation_id ?? null,
    job_id: input.job_id ?? null,
    queue_name: input.queue_name ?? null,
    order_id: input.order_id ?? null,
    order_number: input.order_number ?? null,
    manifest_id: input.manifest_id ?? null,
    asset_id: input.asset_id ?? null,
    provider_code: input.provider_code ?? null,
    provider_request_id: input.provider_request_id ?? null,
    duration_ms: input.duration_ms ?? null,
    error_code: input.error_code ?? null,
    error_message: input.error_message ? sanitizeString(input.error_message) : null,
    retry_count: input.retry_count ?? null,
    context: sanitizeForLog(input.context ?? {})
  };
}

export function writeStructuredLog(
  input: StructuredLogInput,
  writer: (line: string) => void = console.log
): StructuredLogRecord {
  const record = createStructuredLog(input);
  writer(JSON.stringify(record));
  return record;
}

export function sanitizeForLog(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value);
  return isRecord(sanitized) ? sanitized : { value: sanitized };
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (isSensitiveKey(key)) {
        return [key, redactByKey(key, item)];
      }
      return [key, sanitizeValue(item)];
    })
  );
}

function sanitizeString(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    value
  );
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function redactByKey(key: string, value: unknown): string {
  const normalized = key.toLowerCase();
  if (normalized.includes("email") && typeof value === "string") {
    return maskEmail(value);
  }
  if (normalized.includes("storage_key") && typeof value === "string") {
    return maskStorageKey(value);
  }
  return "[redacted]";
}

export function maskEmail(value: string): string {
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return "[redacted]";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskStorageKey(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts.length > 1 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

export interface NormalizedError {
  error_code: string;
  severity: Severity;
  retryable: boolean;
  user_safe_message: string;
  internal_message: string;
  debug_context: Record<string, unknown>;
  created_at: string;
}

export function normalizeError(input: {
  error: unknown;
  source:
    | "api"
    | "worker_job"
    | "stripe_webhook"
    | "ai_provider"
    | "storage"
    | "email_provider"
    | "validation"
    | "idempotency"
    | "download_token";
  error_code?: string;
  severity?: Severity;
  retryable?: boolean;
  user_safe_message?: string;
  debug_context?: Record<string, unknown>;
}): NormalizedError {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error ?? "Unknown error");
  return {
    error_code: input.error_code ?? `${input.source}_error`,
    severity: input.severity ?? defaultSeverity(input.source),
    retryable: input.retryable ?? defaultRetryable(input.source),
    user_safe_message:
      input.user_safe_message ?? "Something went wrong. Please try again or contact support.",
    internal_message: sanitizeString(message),
    debug_context: sanitizeForLog(input.debug_context ?? {}),
    created_at: new Date().toISOString()
  };
}

function defaultSeverity(source: string): Severity {
  return source === "stripe_webhook" || source === "storage" ? "high" : "medium";
}

function defaultRetryable(source: string): boolean {
  return !["validation", "idempotency", "download_token"].includes(source);
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  details: Record<string, unknown>;
}

export async function apiHealth(env: NodeJS.ProcessEnv = process.env): Promise<HealthCheckResult> {
  return {
    name: "api",
    status: "ok",
    details: {
      process_alive: true,
      version: env.APP_VERSION ?? "mvp-placeholder",
      build: env.BUILD_ID ?? "local-placeholder",
      env_mode: env.NODE_ENV ?? env.APP_ENV ?? "local",
      uptime_seconds: Math.round(process.uptime())
    }
  };
}

export async function databaseHealth(check?: () => Promise<unknown>): Promise<HealthCheckResult> {
  try {
    if (check) {
      await check();
    }
    return { name: "database", status: "ok", details: { prisma_connection: "ok" } };
  } catch (error) {
    return {
      name: "database",
      status: "degraded",
      details: {
        prisma_connection: "degraded",
        error: normalizeError({ error, source: "storage" }).error_code
      }
    };
  }
}

export async function redisHealth(check?: () => Promise<unknown>): Promise<HealthCheckResult> {
  try {
    if (check) {
      await check();
    } else {
      throw new Error("redis_check_not_configured");
    }
    return { name: "redis", status: "ok", details: { connection: "ok" } };
  } catch {
    return {
      name: "redis",
      status: "degraded",
      details: { connection: "degraded_or_not_configured" }
    };
  }
}

export function queueHealth(input: {
  registeredQueueNames: readonly string[];
  workerCount?: number;
  queueDepth?: number | null;
  failedJobCount?: number | null;
  deadLetterCount?: number | null;
  redisAvailable?: boolean;
}): HealthCheckResult {
  return {
    name: "queue",
    status: input.redisAvailable === false ? "degraded" : "ok",
    details: {
      registered_queue_names: input.registeredQueueNames,
      worker_registered_count: input.workerCount ?? 0,
      queue_depth: input.queueDepth ?? "unavailable_without_redis",
      failed_job_count: input.failedJobCount ?? "unavailable_without_redis",
      dead_letter_count: input.deadLetterCount ?? "unavailable_without_redis"
    }
  };
}

export async function storageHealth(
  input: { providerMode?: string; localPrivateDir?: string } = {}
): Promise<HealthCheckResult> {
  const providerMode = input.providerMode ?? process.env.STORAGE_PROVIDER ?? "local_private";
  let writable = "not_checked";
  if (providerMode === "local_private" && input.localPrivateDir) {
    try {
      await access(input.localPrivateDir, constants.W_OK);
      writable = "ok";
    } catch {
      writable = "degraded";
    }
  }
  return {
    name: "storage",
    status: writable === "degraded" ? "degraded" : "ok",
    details: {
      provider_mode: providerMode,
      local_private_writable: writable,
      s3_r2: "disabled_until_configured"
    }
  };
}

export function emailHealth(env: NodeJS.ProcessEnv = process.env): HealthCheckResult {
  const provider = env.EMAIL_PROVIDER ?? "mock";
  return {
    name: "email",
    status: "ok",
    details: {
      provider_mode: provider,
      mock_provider_status: provider === "mock" ? "ok" : "not_used",
      real_provider: provider === "mock" ? "disabled" : "configured"
    }
  };
}

export function stripeHealth(env: NodeJS.ProcessEnv = process.env): HealthCheckResult {
  const secret = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY !== "sk_test_replace_me");
  const webhook = Boolean(
    env.STRIPE_WEBHOOK_SECRET && env.STRIPE_WEBHOOK_SECRET !== "whsec_replace_me"
  );
  return {
    name: "stripe",
    status: secret && webhook ? "ok" : "degraded",
    details: { secret_configured: secret, webhook_secret_configured: webhook }
  };
}

export async function systemHealthSummary(input: {
  queueNames: readonly string[];
  workerCount?: number;
  databaseCheck?: () => Promise<unknown>;
  redisCheck?: () => Promise<unknown>;
  localPrivateDir?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ status: HealthStatus; degraded_services: string[]; checks: HealthCheckResult[] }> {
  const env = input.env ?? process.env;
  const checks = [
    await apiHealth(env),
    await databaseHealth(input.databaseCheck),
    await redisHealth(input.redisCheck),
    queueHealth({
      registeredQueueNames: input.queueNames,
      workerCount: input.workerCount,
      redisAvailable: false
    }),
    await storageHealth({
      providerMode: env.STORAGE_PROVIDER,
      localPrivateDir: input.localPrivateDir
    }),
    emailHealth(env),
    stripeHealth(env)
  ];
  const degraded_services = checks
    .filter((check) => check.status !== "ok")
    .map((check) => check.name);
  return { status: degraded_services.length ? "degraded" : "ok", degraded_services, checks };
}

export interface MetricsSnapshot {
  paidOrders?: Array<{ id: string; paid_at: string; fulfillment_status: string }>;
  processingOrders?: Array<{ id: string; started_at: string }>;
  generationJobs?: Array<{ id: string; status: string; completed_at?: string | null }>;
  outboxEvents?: Array<{ id: string; status: string; created_at: string }>;
  manifests?: Array<{ id: string; status: string }>;
  emailLogs?: Array<{ id: string; status: string; created_at: string }>;
  storageEvents?: Array<{ id: string; status: string; created_at: string }>;
  aiRuns?: Array<{ id: string; status: string; created_at: string }>;
  webhookEvents?: Array<{ id: string; status: string; created_at: string }>;
  orders?: Array<{
    id: string;
    status: string;
    completed_at?: string | null;
    total_cents?: bigint | number;
  }>;
  deadLetterCount?: number;
}

export function collectMvpMetrics(snapshot: MetricsSnapshot | null | undefined, now = new Date()) {
  if (!snapshot) {
    return { status: "degraded" as const, degraded: true, ...zeroMetrics() };
  }
  const olderThan30m = (iso: string) => now.getTime() - new Date(iso).getTime() > 30 * 60_000;
  const within24h = (iso: string) => now.getTime() - new Date(iso).getTime() <= 24 * 60 * 60_000;
  const today = now.toISOString().slice(0, 10);
  const completedToday = (snapshot.orders ?? []).filter((order) =>
    order.completed_at?.startsWith(today)
  );
  return {
    status: "ok" as const,
    paid_orders_stuck_over_30m: (snapshot.paidOrders ?? []).filter(
      (order) => olderThan30m(order.paid_at) && order.fulfillment_status === "not_started"
    ).length,
    orders_processing_over_30m: (snapshot.processingOrders ?? []).filter((order) =>
      olderThan30m(order.started_at)
    ).length,
    failed_generation_jobs: (snapshot.generationJobs ?? []).filter((job) => job.status === "failed")
      .length,
    dead_letter_count: snapshot.deadLetterCount ?? 0,
    outbox_pending_count: (snapshot.outboxEvents ?? []).filter(
      (event) => event.status === "pending"
    ).length,
    outbox_failed_count: (snapshot.outboxEvents ?? []).filter((event) => event.status === "failed")
      .length,
    manifests_partially_completed: (snapshot.manifests ?? []).filter(
      (manifest) => manifest.status === "partially_completed"
    ).length,
    email_failures_24h: (snapshot.emailLogs ?? []).filter(
      (log) => log.status === "failed" && within24h(log.created_at)
    ).length,
    storage_failures_24h: (snapshot.storageEvents ?? []).filter(
      (event) => event.status === "failed" && within24h(event.created_at)
    ).length,
    ai_provider_failures_24h: (snapshot.aiRuns ?? []).filter(
      (run) => run.status === "failed" && within24h(run.created_at)
    ).length,
    webhook_failures_24h: (snapshot.webhookEvents ?? []).filter(
      (event) => event.status === "failed" && within24h(event.created_at)
    ).length,
    average_generation_time_ms: null,
    average_ai_cost_cents: null,
    orders_completed_today: completedToday.length,
    revenue_today_cents: completedToday.reduce(
      (sum, order) => sum + Number(order.total_cents ?? 0),
      0
    ),
    image_text_detection_failures: 0,
    download_token_expired_count_24h: 0,
    signed_url_failures_24h: 0
  };
}

function zeroMetrics() {
  return {
    paid_orders_stuck_over_30m: 0,
    orders_processing_over_30m: 0,
    failed_generation_jobs: 0,
    dead_letter_count: 0,
    outbox_pending_count: 0,
    outbox_failed_count: 0,
    manifests_partially_completed: 0,
    email_failures_24h: 0,
    storage_failures_24h: 0,
    ai_provider_failures_24h: 0,
    webhook_failures_24h: 0,
    average_generation_time_ms: null,
    average_ai_cost_cents: null,
    orders_completed_today: 0,
    revenue_today_cents: 0,
    image_text_detection_failures: 0,
    download_token_expired_count_24h: 0,
    signed_url_failures_24h: 0
  };
}

export interface RecoveryIssue {
  recovery_issue_id: string;
  issue_type: string;
  severity: Severity;
  entity_type: string;
  entity_id: string;
  detected_at: string;
  recommended_action: string;
  auto_recoverable: boolean;
  safe_to_auto_retry: boolean;
  reason: string;
}

export interface RecoverySnapshot {
  orders?: Array<{
    id: string;
    payment_status: string;
    fulfillment_status: string;
    paid_at?: string | null;
    has_order_paid_outbox?: boolean;
  }>;
  outboxEvents?: Array<{ id: string; status: string; created_at: string }>;
  generationJobs?: Array<{ id: string; status: string; updated_at: string }>;
  manifests?: Array<{ id: string; status: string }>;
  emailLogs?: Array<{ id: string; status: string }>;
  downloadTokens?: Array<{ id: string; status: string }>;
  idempotencyKeys?: Array<{ id: string; expires_at: string }>;
}

export function runRecoveryScan(
  snapshot: RecoverySnapshot,
  now = new Date(),
  thresholdMinutes = 30
): RecoveryIssue[] {
  const issues: RecoveryIssue[] = [];
  const olderThan = (iso: string) =>
    now.getTime() - new Date(iso).getTime() > thresholdMinutes * 60_000;
  for (const order of snapshot.orders ?? []) {
    if (order.payment_status === "paid" && !order.has_order_paid_outbox) {
      issues.push(
        issue(
          "paid_order_missing_outbox_event",
          "high",
          "order",
          order.id,
          "requeueOutboxEvent",
          true,
          true,
          "Paid order has no order.paid outbox event."
        )
      );
    }
    if (
      order.payment_status === "paid" &&
      order.fulfillment_status === "not_started" &&
      order.paid_at &&
      olderThan(order.paid_at)
    ) {
      issues.push(
        issue(
          "paid_order_fulfillment_not_started",
          "high",
          "order",
          order.id,
          "retryFailedJob",
          true,
          true,
          "Paid order fulfillment has not started after threshold."
        )
      );
    }
  }
  for (const event of snapshot.outboxEvents ?? []) {
    if (event.status === "pending" && olderThan(event.created_at)) {
      issues.push(
        issue(
          "outbox_pending_too_long",
          "medium",
          "outbox_event",
          event.id,
          "requeueOutboxEvent",
          true,
          true,
          "Outbox event has been pending past threshold."
        )
      );
    }
    if (event.status === "failed") {
      issues.push(
        issue(
          "outbox_failed",
          "high",
          "outbox_event",
          event.id,
          "requeueOutboxEvent",
          true,
          true,
          "Outbox event failed."
        )
      );
    }
  }
  for (const job of snapshot.generationJobs ?? []) {
    if (job.status === "processing" && olderThan(job.updated_at)) {
      issues.push(
        issue(
          "generation_job_stuck_processing",
          "high",
          "generation_job",
          job.id,
          "retryFailedJob",
          true,
          false,
          "Generation job is still processing past threshold."
        )
      );
    }
    if (job.status === "failed") {
      issues.push(
        issue(
          "generation_job_failed",
          "high",
          "generation_job",
          job.id,
          "retryFailedJob",
          true,
          true,
          "Generation job failed."
        )
      );
    }
  }
  for (const manifest of snapshot.manifests ?? []) {
    if (manifest.status === "partially_completed") {
      issues.push(
        issue(
          "manifest_partially_completed",
          "medium",
          "manifest",
          manifest.id,
          "retryFailedAssets",
          true,
          true,
          "Manifest has missing or failed required assets."
        )
      );
    }
    if (manifest.status === "failed") {
      issues.push(
        issue(
          "manifest_failed",
          "high",
          "manifest",
          manifest.id,
          "retryFailedAssets",
          true,
          false,
          "Manifest failed and needs review."
        )
      );
    }
  }
  for (const email of snapshot.emailLogs ?? []) {
    if (email.status === "failed") {
      issues.push(
        issue(
          "email_delivery_failed",
          "medium",
          "email_log",
          email.id,
          "resendDeliveryEmail",
          true,
          true,
          "Delivery email failed."
        )
      );
    }
  }
  for (const token of snapshot.downloadTokens ?? []) {
    if (token.status === "expired") {
      issues.push(
        issue(
          "download_token_expired",
          "low",
          "download_token",
          token.id,
          "createNewDownloadToken",
          true,
          false,
          "Download token expired."
        )
      );
    }
  }
  return issues;
}

function issue(
  issueType: string,
  severity: Severity,
  entityType: string,
  entityId: string,
  action: string,
  autoRecoverable: boolean,
  safe: boolean,
  reason: string
): RecoveryIssue {
  return {
    recovery_issue_id: `rec_${hashValue(`${issueType}:${entityType}:${entityId}`).slice(0, 20)}`,
    issue_type: issueType,
    severity,
    entity_type: entityType,
    entity_id: entityId,
    detected_at: new Date().toISOString(),
    recommended_action: action,
    auto_recoverable: autoRecoverable,
    safe_to_auto_retry: safe,
    reason
  };
}

export interface RecoveryAuditLog {
  actor_type: "system" | "admin";
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  reason: string;
  correlation_id: string;
  created_at: string;
}

export class SafeRecoveryActions {
  public readonly auditLogs: RecoveryAuditLog[] = [];

  requeueOutboxEvent(entityId: string, reason: string, actor: "system" | "admin" = "system") {
    return this.record(actor, "requeueOutboxEvent", "outbox_event", entityId, reason, {
      queued: true
    });
  }

  retryFailedJob(entityId: string, reason: string, actor: "system" | "admin" = "system") {
    return this.record(actor, "retryFailedJob", "generation_job", entityId, reason, {
      retry_requested: true
    });
  }

  retryFailedAssets(entityId: string, reason: string, actor: "system" | "admin" = "system") {
    return this.record(actor, "retryFailedAssets", "manifest", entityId, reason, {
      retry_scope: "failed_assets_only"
    });
  }

  cleanupTempFilesDryRun(files: string[], reason = "dry_run") {
    this.record("system", "cleanupTempFilesDryRun", "temp_files", "dry_run", reason, {
      candidate_count: files.length
    });
    return { deleted: 0, candidates: files };
  }

  cleanupExpiredIdempotencyKeys(ids: string[], reason = "expired") {
    this.record("system", "cleanupExpiredIdempotencyKeys", "idempotency_key", "batch", reason, {
      candidate_count: ids.length
    });
    return { cleanup_requested: true, candidate_count: ids.length };
  }

  markPaymentPaid(): never {
    throw new Error("unsafe_recovery_action_forbidden: markPaymentPaid");
  }

  markManifestCompleted(): never {
    throw new Error("unsafe_recovery_action_forbidden: markManifestCompleted");
  }

  private record(
    actor: "system" | "admin",
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    after: Record<string, unknown>
  ) {
    const log: RecoveryAuditLog = {
      actor_type: actor,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_json: null,
      after_json: sanitizeForLog(after),
      reason,
      correlation_id: randomUUID(),
      created_at: new Date().toISOString()
    };
    this.auditLogs.push(log);
    return { accepted: true, audit_log: log };
  }
}

export interface AlertEvent {
  alert_id: string;
  alert_type: string;
  severity: Severity;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
  status: "open" | "acknowledged" | "resolved";
}

export class InMemoryAlertRepository {
  private readonly alerts: AlertEvent[] = [];

  create(
    input: Omit<AlertEvent, "alert_id" | "created_at" | "acknowledged_at" | "status">
  ): AlertEvent {
    const alert: AlertEvent = {
      ...input,
      alert_id: `alert_${this.alerts.length + 1}`,
      created_at: new Date().toISOString(),
      acknowledged_at: null,
      status: "open"
    };
    this.alerts.push(alert);
    return alert;
  }

  list() {
    return [...this.alerts];
  }
}

export function createDlqAlert(
  deadLetterCount: number,
  repository = new InMemoryAlertRepository()
): AlertEvent | null {
  if (deadLetterCount <= 0) {
    return null;
  }
  return repository.create({
    alert_type: "dlq_non_empty",
    severity: "high",
    message: `Dead-letter queue contains ${deadLetterCount} job(s).`,
    entity_type: "queue",
    entity_id: "dead-letter"
  });
}

export function verifyPrivateNoindex(
  routes: Array<{ route: string; metadata: { robots?: unknown } }>
) {
  return routes.map((route) => ({
    route: route.route,
    noindex:
      isRecord(route.metadata.robots) &&
      route.metadata.robots.index === false &&
      route.metadata.robots.follow === false
  }));
}

export function verifyNoPrivateApiFields(payload: unknown) {
  return {
    ok: !containsForbiddenApiField(payload),
    scanned_at: new Date().toISOString()
  };
}

function containsForbiddenApiField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenApiField(item));
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([key, item]) => {
    const normalized = key.toLowerCase();
    if (
      ["storage_key", "rendered_prompt", "ai_provider", "signed_url", "raw_token"].includes(
        normalized
      )
    ) {
      return true;
    }
    return containsForbiddenApiField(item);
  });
}

export function createSchedulerFoundation(env: NodeJS.ProcessEnv = process.env) {
  const recoveryEnabled = (env.RECOVERY_SCAN_ENABLED ?? "true") === "true";
  const intervalMs = Number.parseInt(env.RECOVERY_SCAN_INTERVAL_MS ?? "300000", 10);
  const destructiveEnabled = (env.CLEANUP_DESTRUCTIVE_ENABLED ?? "false") === "true";
  return {
    recovery_scan_enabled: recoveryEnabled,
    recovery_scan_interval_ms: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 300_000,
    cleanup_destructive_enabled: destructiveEnabled,
    jobs: [
      "runRecoveryScanJob",
      "cleanupExpiredIdempotencyKeysJob",
      "cleanupTempFilesDryRunJob",
      "cleanupExpiredInterviewsJob"
    ],
    runRecoveryScanJob(snapshot: RecoverySnapshot) {
      return recoveryEnabled ? runRecoveryScan(snapshot) : [];
    },
    cleanupExpiredIdempotencyKeysJob(ids: string[]) {
      return new SafeRecoveryActions().cleanupExpiredIdempotencyKeys(ids);
    },
    cleanupTempFilesDryRunJob(files: string[]) {
      return new SafeRecoveryActions().cleanupTempFilesDryRun(files);
    },
    cleanupExpiredInterviewsJob() {
      return { placeholder: true, destructive: false };
    }
  };
}

export async function findTempFilesOlderThan(
  rootDir: string,
  _olderThanMs: number
): Promise<string[]> {
  try {
    const names = await readdir(rootDir);
    return names.map((name) => join(rootDir, name));
  } catch {
    return [];
  }
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
