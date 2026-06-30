import { describe, expect, it } from "vitest";

import {
  SafeRecoveryActions,
  collectMvpMetrics,
  createDlqAlert,
  createSchedulerFoundation,
  createStructuredLog,
  databaseHealth,
  normalizeError,
  queueHealth,
  redisHealth,
  runRecoveryScan,
  verifyNoPrivateApiFields,
  verifyPrivateNoindex
} from "./index";

describe("observability foundation", () => {
  it("structured logger masks email and strips raw tokens and signed URLs", () => {
    const log = createStructuredLog({
      level: "info",
      service: "api",
      module: "downloads",
      message: "download_requested",
      context: {
        customer_email: "customer@example.com",
        raw_token: "raw-secret-token",
        signed_url: "https://example.com/private?signed=true",
        storage_key: "orders/order_1/asset.png"
      }
    });

    expect(JSON.stringify(log)).toContain("cu***@example.com");
    expect(JSON.stringify(log)).not.toContain("raw-secret-token");
    expect(JSON.stringify(log)).not.toContain("https://example.com/private");
    expect(JSON.stringify(log)).not.toContain("orders/order_1/asset.png");
  });

  it("error normalizer strips secrets from messages and debug context", () => {
    const error = normalizeError({
      error: new Error("provider failed with sk_test_secret"),
      source: "ai_provider",
      debug_context: {
        api_key: "sk_test_secret",
        rendered_prompt: "full private prompt",
        safe_id: "run_1"
      }
    });

    expect(error.internal_message).not.toContain("sk_test_secret");
    expect(JSON.stringify(error.debug_context)).not.toContain("full private prompt");
    expect(error.debug_context.safe_id).toBe("run_1");
  });

  it("health checks degrade instead of throwing when dependencies are unavailable", async () => {
    await expect(
      databaseHealth(async () => {
        throw new Error("db down");
      })
    ).resolves.toMatchObject({ status: "degraded" });
    await expect(redisHealth()).resolves.toMatchObject({ status: "degraded" });
  });

  it("queue health lists registered queues", () => {
    expect(queueHealth({ registeredQueueNames: ["a", "b"], workerCount: 2 })).toMatchObject({
      details: { registered_queue_names: ["a", "b"], worker_registered_count: 2 }
    });
  });

  it("metrics helper returns required MVP keys", () => {
    const metrics = collectMvpMetrics(
      {
        paidOrders: [
          { id: "order_1", paid_at: "2026-06-29T00:00:00.000Z", fulfillment_status: "not_started" }
        ],
        generationJobs: [{ id: "job_1", status: "failed" }],
        outboxEvents: [
          { id: "outbox_1", status: "pending", created_at: "2026-06-29T00:00:00.000Z" }
        ],
        manifests: [{ id: "manifest_1", status: "partially_completed" }],
        deadLetterCount: 1
      },
      new Date("2026-06-29T01:00:00.000Z")
    );

    expect(metrics).toEqual(
      expect.objectContaining({
        paid_orders_stuck_over_30m: 1,
        failed_generation_jobs: 1,
        dead_letter_count: 1,
        outbox_pending_count: 1,
        manifests_partially_completed: 1,
        average_generation_time_ms: null,
        average_ai_cost_cents: null
      })
    );
  });

  it("recovery scanner detects stuck paid orders, old outbox events, and failed jobs", () => {
    const issues = runRecoveryScan(
      {
        orders: [
          {
            id: "order_1",
            payment_status: "paid",
            fulfillment_status: "not_started",
            paid_at: "2026-06-29T00:00:00.000Z",
            has_order_paid_outbox: false
          }
        ],
        outboxEvents: [
          { id: "outbox_1", status: "pending", created_at: "2026-06-29T00:00:00.000Z" }
        ],
        generationJobs: [{ id: "job_1", status: "failed", updated_at: "2026-06-29T00:10:00.000Z" }]
      },
      new Date("2026-06-29T01:00:00.000Z")
    );

    expect(issues.map((issue) => issue.issue_type)).toEqual(
      expect.arrayContaining([
        "paid_order_missing_outbox_event",
        "paid_order_fulfillment_not_started",
        "outbox_pending_too_long",
        "generation_job_failed"
      ])
    );
    expect(
      issues.find((issue) => issue.issue_type === "generation_job_failed")?.recommended_action
    ).toBe("retryFailedJob");
  });

  it("safe recovery actions reject dangerous payment and manifest overrides", () => {
    const actions = new SafeRecoveryActions();
    expect(actions.retryFailedJob("job_1", "retry after provider timeout")).toMatchObject({
      accepted: true
    });
    expect(() => actions.markPaymentPaid()).toThrow("unsafe_recovery_action_forbidden");
    expect(() => actions.markManifestCompleted()).toThrow("unsafe_recovery_action_forbidden");
  });

  it("cleanup dry run does not delete files", () => {
    const result = new SafeRecoveryActions().cleanupTempFilesDryRun(["a.tmp", "b.tmp"]);
    expect(result).toEqual({ deleted: 0, candidates: ["a.tmp", "b.tmp"] });
  });

  it("alert event can be created for non-empty DLQ", () => {
    expect(createDlqAlert(2)).toMatchObject({
      alert_type: "dlq_non_empty",
      severity: "high",
      status: "open"
    });
  });

  it("noindex and privacy verification helpers detect protected state", () => {
    expect(
      verifyPrivateNoindex([
        { route: "/download/token", metadata: { robots: { index: false, follow: false } } }
      ])
    ).toEqual([{ route: "/download/token", noindex: true }]);
    expect(
      verifyNoPrivateApiFields({ asset: { masked_storage_key: "orders/***/asset.png" } }).ok
    ).toBe(true);
    expect(
      verifyNoPrivateApiFields({ asset: { storage_key: "orders/order_1/asset.png" } }).ok
    ).toBe(false);
  });

  it("scheduler foundation is safe by default", () => {
    const scheduler = createSchedulerFoundation({
      RECOVERY_SCAN_ENABLED: "true",
      RECOVERY_SCAN_INTERVAL_MS: "300000",
      CLEANUP_DESTRUCTIVE_ENABLED: "false"
    } as NodeJS.ProcessEnv);
    expect(scheduler.cleanup_destructive_enabled).toBe(false);
    expect(scheduler.jobs).toContain("cleanupTempFilesDryRunJob");
  });
});
