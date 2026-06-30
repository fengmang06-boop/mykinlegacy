import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  DefaultAiProviderRegistry,
  InMemoryAiGenerationRunRepository,
  handleAiImageGenerationJob
} from "../packages/ai/src/generation";
import { MockEmailProvider } from "../packages/email/src/mock-provider";
import { InMemoryEmailLogRepository } from "../packages/email/src/email-log";
import { sendDeliveryEmailJob } from "../packages/email/src/jobs";
import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "../packages/pdf/src";
import {
  InMemoryDownloadVaultRepository,
  LocalPrivateStorageAdapter,
  createDownloadToken,
  createSignedAssetUrl,
  generateZipPackage,
  revokeDownloadToken,
  validateDownloadToken
} from "../packages/storage/src";
import type { DownloadAssetRecord } from "../packages/storage/src/download-vault";
import {
  SafeRecoveryActions,
  createDlqAlert,
  runRecoveryScan,
  systemHealthSummary,
  verifyNoPrivateApiFields,
  verifyPrivateNoindex
} from "../packages/observability/src";
import { assertOrderCanCheckout } from "../apps/api/src/payments/payments.service";
import { StripeWebhookService } from "../apps/api/src/payments/stripe-webhook.service";
import type { StripeAdapter } from "../apps/api/src/payments/stripe.adapter";
import type { PrismaService } from "../apps/api/src/database/prisma.service";
import { AdminService } from "../apps/api/src/admin/admin.service";
import { metadata as adminMetadata } from "../apps/admin/src/app/layout";
import { metadata as checkoutMetadata } from "../apps/web/src/app/checkout/[order_number]/page";
import { metadata as createMetadata } from "../apps/web/src/app/create/page";
import { metadata as downloadMetadata } from "../apps/web/src/app/download/[token]/page";
import { metadata as orderStatusMetadata } from "../apps/web/src/app/order-status/[order_number]/page";
import { metadata as paymentSuccessMetadata } from "../apps/web/src/app/payment/success/page";
import {
  sampleAdminUser,
  sampleEmailTemplate,
  sampleImageJob,
  sampleOrder
} from "./fixtures";

describe("MVP E2E failure and security scenarios", () => {
  it("handles duplicate Stripe webhooks idempotently", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 4900, id: "evt_dup" }));

    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });
    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(prisma.state.order.paymentStatus).toBe("paid");
    expect(prisma.state.paymentTransactions).toHaveLength(1);
    expect(prisma.state.outboxEvents).toHaveLength(1);
  });

  it("rejects amount mismatch and keeps order unpaid", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 1 }));

    const result = await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(result.processed).toBe(false);
    expect(prisma.state.order.paymentStatus).toBe("unpaid");
    expect(prisma.state.outboxEvents).toHaveLength(0);
  });

  it("keeps redirect-before-webhook in verifying state and does not trust frontend paid state", async () => {
    const paymentSuccessSource = await readFile(
      "apps/web/src/components/payment-success.tsx",
      "utf8"
    );
    const paymentsServiceSource = await readFile(
      "apps/api/src/payments/payments.service.ts",
      "utf8"
    );

    expect(paymentSuccessSource).toContain("Payment received, verifying your order.");
    expect(paymentSuccessSource).not.toContain("markPaid");
    expect(paymentsServiceSource).toContain("rejectFields(data, [\"amount\"");
    expect(paymentsServiceSource).toContain("order.totalCents");
  });

  it("blocks checkout when required consent is missing", () => {
    expect(() =>
      assertOrderCanCheckout({
        ...paymentOrderRecord(),
        consentRecords: []
      })
    ).toThrow("Required consent is missing before Stripe checkout.");
  });

  it("records AI image failures and blocks text-detected image output", async () => {
    const failedRuns = new InMemoryAiGenerationRunRepository();
    await expect(
      handleAiImageGenerationJob(sampleImageJob(), {
        providerRegistry: new DefaultAiProviderRegistry({ mockMode: "provider_error" }),
        runRepository: failedRuns
      })
    ).rejects.toMatchObject({ details: { error_code: "ai_provider_error" } });
    expect(failedRuns.runs.at(-1)).toMatchObject({ status: "failed" });

    const textDetectedRuns = new InMemoryAiGenerationRunRepository();
    await expect(
      handleAiImageGenerationJob(sampleImageJob(), {
        providerRegistry: new DefaultAiProviderRegistry({ mockMode: "text_detected" }),
        runRepository: textDetectedRuns
      })
    ).rejects.toMatchObject({ details: { error_code: "ai_output_validation_failed" } });
    expect(textDetectedRuns.runs.at(-1)).toMatchObject({ status: "failed" });
  });

  it("blocks PDF and ZIP completion when required generation steps fail", async () => {
    await expect(
      generateHeritagePdf({
        title: "Broken PDF",
        house_name: "House Alder",
        body_text: "PDF should fail on invalid output path.",
        disclaimer: GLOBAL_PDF_DISCLAIMER,
        deliverable_code: "family_story_pdf",
        output_file_path: "\0bad.pdf"
      })
    ).rejects.toThrow();

    await expect(
      generateZipPackage({
        output_file_path: "unused.zip",
        readme_text: "readme",
        assets: [{ archive_path: "pdfs/missing.pdf", file_path: "", required: true }]
      })
    ).rejects.toThrow("zip_required_asset_missing");
  });

  it("does not fail generation state only because mock email delivery fails", async () => {
    const provider = new MockEmailProvider("provider_error");
    const emailLogRepository = new InMemoryEmailLogRepository();
    const result = await sendDeliveryEmailJob(
      {
        order_id: sampleOrder.order_id,
        order_number: sampleOrder.order_number,
        download_token_id: "download_token_e2e",
        raw_token_for_internal_delivery_only: "raw_download_token_e2e",
        recipient_email: sampleOrder.customer_email,
        expires_at: new Date("2026-07-29T00:00:00.000Z"),
        app_web_url: "http://localhost:3000"
      },
      { provider, emailLogRepository, template: sampleEmailTemplate }
    );

    expect(result.status).toBe("failed");
    expect(emailLogRepository.logs[0]).toMatchObject({ status: "failed" });
    expect(JSON.stringify(emailLogRepository.logs)).not.toContain("raw_download_token_e2e");
  });

  it("blocks expired, revoked, unavailable, and unlinked download access", async () => {
    const repository = new InMemoryDownloadVaultRepository({ assets: [downloadAsset("asset_1")] });
    const storage = new LocalPrivateStorageAdapter();
    const created = await createDownloadToken(
      {
        order_id: sampleOrder.order_id,
        order_number: sampleOrder.order_number,
        asset_ids: ["asset_1"],
        expires_in_days: 1,
        now: new Date("2026-06-29T00:00:00.000Z")
      },
      repository
    );

    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now: new Date("2026-07-01T00:00:00.000Z")
      })
    ).rejects.toThrow("download_token_expired");

    await revokeDownloadToken({
      raw_token: created.raw_token_for_internal_delivery_only,
      repository,
      now: new Date("2026-06-29T01:00:00.000Z")
    });
    await expect(
      validateDownloadToken({
        raw_token: created.raw_token_for_internal_delivery_only,
        repository,
        now: new Date("2026-06-29T01:00:00.000Z")
      })
    ).rejects.toThrow("download_token_revoked");

    const secondRepository = new InMemoryDownloadVaultRepository({
      assets: [downloadAsset("asset_1"), { ...downloadAsset("asset_2"), status: "revoked" }]
    });
    const second = await createDownloadToken(
      {
        order_id: sampleOrder.order_id,
        order_number: sampleOrder.order_number,
        asset_ids: ["asset_1", "asset_2"]
      },
      secondRepository
    );

    await expect(
      createSignedAssetUrl({
        raw_token: second.raw_token_for_internal_delivery_only,
        asset_id: "asset_3",
        repository: secondRepository,
        storage
      })
    ).rejects.toThrow("asset_not_linked_to_token");
    await expect(
      createSignedAssetUrl({
        raw_token: second.raw_token_for_internal_delivery_only,
        asset_id: "asset_2",
        repository: secondRepository,
        storage
      })
    ).rejects.toThrow("asset_not_available");
  });

  it("keeps private pages noindex and sensitive fields out of public payloads", () => {
    const noindex = verifyPrivateNoindex([
      { route: "/create", metadata: createMetadata },
      { route: "/checkout/AHL-TEST", metadata: checkoutMetadata },
      { route: "/payment/success", metadata: paymentSuccessMetadata },
      { route: "/order-status/AHL-TEST", metadata: orderStatusMetadata },
      { route: "/download/token", metadata: downloadMetadata },
      { route: "/admin/dashboard", metadata: adminMetadata }
    ]);

    expect(noindex.every((route) => route.noindex)).toBe(true);
    expect(verifyNoPrivateApiFields({ storage_key: "orders/private/file.png" }).ok).toBe(false);
    expect(verifyNoPrivateApiFields({ order_number: "AHL-TEST", status: "paid" }).ok).toBe(true);
  });

  it("covers admin smoke and guarded recovery actions", async () => {
    const admin = new AdminService();
    admin.addMockAdmin(sampleAdminUser);
    const login = admin.login({
      email: sampleAdminUser.email,
      password: sampleAdminUser.password
    });
    const context = { sessionToken: login.session_token };

    expect(admin.dashboard(context).data_source).toBe("mvp_mock_snapshot");
    expect(admin.listOrders(context).orders).toHaveLength(1);
    expect(admin.getOrder(context, "order_01").masked_customer_email).toContain("***");
    expect(admin.listGenerationJobs(context).generation_jobs[0]?.status).toBe("failed");
    expect(admin.getManifest(context, "manifest_01").zip_readiness).toBe("blocked");
    expect(admin.getAsset(context, "asset_01").masked_storage_key).toContain("***");
    expect(admin.listDownloadTokens(context).download_tokens[0]).not.toHaveProperty("raw_token");
    expect(admin.listEmailLogs(context).email_logs[0]?.masked_recipient_email).toContain("***");
    expect(admin.listPromptTemplates(context).prompt_templates).toHaveLength(1);
    expect(admin.listAuditLogs(context).audit_logs).toBeDefined();
    expect(await admin.systemHealth(context)).toMatchObject({ status: "degraded" });
    expect(() => admin.retryGenerationJob(context, "job_01")).toThrow("reason is required");

    const viewer = new AdminService();
    viewer.addMockAdmin({
      id: "viewer",
      email: "viewer@example.test",
      password: sampleAdminUser.password,
      roles: ["viewer"]
    });
    const viewerLogin = viewer.login({
      email: "viewer@example.test",
      password: sampleAdminUser.password
    });
    expect(() =>
      viewer.retryGenerationJob(
        { sessionToken: viewerLogin.session_token },
        "job_01",
        "retry failed e2e job"
      )
    ).toThrow("permission");

    const health = await systemHealthSummary({
      queueNames: ["generation"],
      databaseCheck: async () => {
        throw new Error("db unavailable");
      },
      redisCheck: async () => {
        throw new Error("redis unavailable");
      },
      env: { ...process.env, EMAIL_PROVIDER: "mock", STORAGE_PROVIDER: "local_private" }
    });
    expect(health.status).toBe("degraded");
    expect(runRecoveryScan(recoverySnapshot())).toEqual(
      expect.arrayContaining([expect.objectContaining({ issue_type: "paid_order_missing_outbox_event" })])
    );
    expect(createDlqAlert(1)).toMatchObject({ alert_type: "dlq_non_empty" });

    const recovery = new SafeRecoveryActions();
    expect(recovery.cleanupTempFilesDryRun(["tmp/a"], "e2e dry run")).toMatchObject({ deleted: 0 });
    expect(() => recovery.markPaymentPaid()).toThrow("unsafe_recovery_action_forbidden");
    expect(() => recovery.markManifestCompleted()).toThrow("unsafe_recovery_action_forbidden");
  });
});

function createWebhookService(prisma: ReturnType<typeof createWebhookPrismaMock>, event: unknown) {
  return new StripeWebhookService(prisma, {
    constructWebhookEvent: () => event
  } as unknown as StripeAdapter);
}

function checkoutEvent(input: { amountTotal: number; id?: string }) {
  return {
    id: input.id ?? "evt_checkout_e2e",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_e2e",
        amount_total: input.amountTotal,
        currency: "usd",
        url: "https://checkout.stripe.test/session",
        expires_at: 1782700000,
        payment_intent: "pi_test_e2e",
        client_reference_id: sampleOrder.order_number,
        metadata: { order_number: sampleOrder.order_number }
      }
    }
  };
}

function paymentOrderRecord() {
  return {
    id: sampleOrder.order_id,
    orderNumber: sampleOrder.order_number,
    orderStatus: "pending_payment",
    paymentStatus: "unpaid",
    fulfillmentStatus: "not_started",
    totalCents: BigInt(sampleOrder.total_cents),
    currency: "USD",
    metadataJson: {},
    orderItems: [
      {
        id: sampleOrder.order_item_id,
        productSnapshotJson: {},
        product: { code: sampleOrder.product_code, translations: [] },
        package: { code: sampleOrder.package_code }
      }
    ],
    consentRecords: [
      {
        termsAccepted: true,
        privacyPolicyAccepted: true,
        heritageDisclaimerAccepted: true,
        aiGenerationConsent: true,
        emailDeliveryConsent: true
      }
    ]
  };
}

function downloadAsset(assetId: string): DownloadAssetRecord {
  return {
    asset_id: assetId,
    order_id: sampleOrder.order_id,
    deliverable_code: "crest_variant_1_png",
    friendly_name: "Crest Variant 1",
    asset_type: "image",
    file_ext: "png",
    mime_type: "image/png",
    size_bytes: 100,
    status: "available_for_download",
    storage_provider: "local_private",
    storage_bucket: "private-assets",
    storage_key: `orders/${sampleOrder.order_id}/${assetId}.png`,
    public_url: null,
    deleted_at: null
  };
}

function recoverySnapshot() {
  return {
    orders: [
      {
        id: sampleOrder.order_id,
        payment_status: "paid",
        fulfillment_status: "not_started",
        paid_at: "2026-06-29T00:00:00.000Z",
        has_order_paid_outbox: false
      }
    ],
    generationJobs: [
      {
        id: "job_failed_e2e",
        status: "failed",
        updated_at: "2026-06-29T00:05:00.000Z"
      }
    ]
  };
}

function createWebhookPrismaMock(): PrismaService & {
  state: {
    order: ReturnType<typeof paymentOrderRecord>;
    webhookEvents: Map<string, { id: string; providerEventId: string; processingStatus: string }>;
    paymentTransactions: unknown[];
    outboxEvents: unknown[];
    statusHistory: unknown[];
  };
} {
  const state = {
    order: paymentOrderRecord(),
    webhookEvents: new Map<string, { id: string; providerEventId: string; processingStatus: string }>(),
    paymentTransactions: [] as unknown[],
    outboxEvents: [] as unknown[],
    statusHistory: [] as unknown[]
  };
  const db = {
    state,
    db: {
      paymentWebhookEvent: {
        findUnique: async (args: unknown) => {
          const eventId = (args as { where: { provider_providerEventId: { providerEventId: string } } }).where
            .provider_providerEventId.providerEventId;
          return state.webhookEvents.get(eventId) ?? null;
        },
        create: async (args: unknown) => {
          const data = (args as { data: { id: string; providerEventId: string; processingStatus: string } }).data;
          const record = {
            id: data.id,
            providerEventId: data.providerEventId,
            processingStatus: data.processingStatus
          };
          state.webhookEvents.set(data.providerEventId, record);
          return record;
        },
        update: async (args: unknown) => {
          const typed = args as { where: { id: string }; data: { processingStatus: string } };
          const record = [...state.webhookEvents.values()].find((item) => item.id === typed.where.id);
          if (!record) {
            throw new Error("missing_webhook_event");
          }
          record.processingStatus = typed.data.processingStatus;
          return record;
        }
      },
      order: {
        findUnique: async () => state.order,
        update: async (args: unknown) => {
          Object.assign(state.order, (args as { data: Partial<ReturnType<typeof paymentOrderRecord>> }).data);
          return state.order;
        }
      },
      paymentIntent: {
        findUnique: async () => ({ id: "payment_intent_e2e", providerIntentId: "pi_test_e2e" }),
        upsert: async () => ({ id: "payment_intent_e2e", providerIntentId: "cs_test_e2e" })
      },
      paymentTransaction: {
        findUnique: async (args: unknown) => {
          const id = (args as { where: { provider_providerTransactionId: { providerTransactionId: string } } }).where
            .provider_providerTransactionId.providerTransactionId;
          return state.paymentTransactions.find((item) => (item as { providerTransactionId: string }).providerTransactionId === id) ?? null;
        },
        create: async (args: unknown) => {
          const data = (args as { data: { providerTransactionId: string } }).data;
          state.paymentTransactions.push(data);
          return data;
        }
      },
      orderStatusHistory: {
        create: async (args: unknown) => {
          state.statusHistory.push((args as { data: unknown }).data);
          return {};
        }
      },
      refund: { create: async () => ({}) },
      outboxEvent: {
        create: async (args: unknown) => {
          state.outboxEvents.push((args as { data: unknown }).data);
          return {};
        }
      },
      $transaction: async <T>(handler: (client: unknown) => Promise<T>) => handler(db.db)
    }
  };

  return db as unknown as PrismaService & { state: typeof state };
}
