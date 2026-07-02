import { describe, expect, it, vi } from "vitest";

import {
  createWorkerApp,
  getWorkerStatus,
  recoverCompletedOrdersMissingDeliveryEmail,
  recoverStuckPaidOrders
} from "./app";

const allQueueNames = [
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

describe("worker app foundation", () => {
  it("reports static readiness with queue names", () => {
    expect(getWorkerStatus(createMockQueueModule())).toEqual({
      status: "ready",
      service: "worker",
      queue_names: allQueueNames
    });
  });

  it("starts, registers queues, and shuts down gracefully", async () => {
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule();
    const outboxDispatcher = {
      dispatchOnce: vi.fn(async () => ({ scanned: 0 }))
    };
    const app = createWorkerApp({
      config: {
        redisUrl: "redis://localhost:6379",
        concurrency: 2,
        pollIntervalMs: 60_000,
        enableOutboxDispatcher: true,
        environment: "test",
        recoveryScanEnabled: true,
        recoveryScanIntervalMs: 300_000,
        cleanupDestructiveEnabled: false,
        stuckOrderThresholdMinutes: 30
      },
      queueModule,
      databaseModule,
      outboxDispatcher,
      aiModule: createMockAiModule(),
      storageModule: createMockStorageModule(),
      pdfModule: createMockPdfModule(),
      emailModule: createMockEmailModule()
    });

    expect(app.health()).toEqual({
      status: "ready",
      service: "worker",
      queue_count: allQueueNames.length,
      worker_count: 13,
      outbox_dispatcher_enabled: true,
      scheduler: {
        recovery_scan_enabled: true,
        recovery_scan_interval_ms: 300_000,
        cleanup_destructive_enabled: false,
        jobs: [
          "runRecoveryScanJob",
          "cleanupExpiredIdempotencyKeysJob",
          "cleanupTempFilesDryRunJob",
          "cleanupExpiredInterviewsJob"
        ],
        last_recovery_scan_at: null
      }
    });
    expect(
      app.runRecoveryScan({
        generationJobs: [{ id: "job_1", status: "failed", updated_at: "2026-06-29T00:00:00.000Z" }]
      })
    ).toHaveLength(1);

    await app.start();
    await app.shutdown();

    expect(queueModule.createdQueues).toHaveLength(allQueueNames.length);
    expect(queueModule.createdWorkers).toHaveLength(13);
    expect(queueModule.createdWorkers.map((worker) => worker.queueName)).toEqual(
      expect.arrayContaining([
        "payment-confirmation",
        "ai-image-generation",
        "ai-text-generation",
        "image-postprocess",
        "pdf-generation",
        "zip-packaging",
        "asset-storage",
        "download-token",
        "email-delivery"
      ])
    );
    expect(queueModule.createdWorkers.every((worker) => worker.closed)).toBe(true);
    expect(queueModule.createdQueues.every((queue) => queue.closed)).toBe(true);
  });

  it("processes paid order queue jobs into a placeholder collection", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule();
    const app = createWorkerApp({
      config: {
        redisUrl: "redis://localhost:6379",
        concurrency: 1,
        pollIntervalMs: 60_000,
        enableOutboxDispatcher: false,
        environment: "test",
        recoveryScanEnabled: false,
        recoveryScanIntervalMs: 300_000,
        cleanupDestructiveEnabled: false,
        stuckOrderThresholdMinutes: 30
      },
      queueModule,
      databaseModule,
      aiModule: createMockAiModule(),
      storageModule: createMockStorageModule(),
      pdfModule: createMockPdfModule(),
      emailModule: createMockEmailModule()
    });

    const worker = queueModule.createdWorkers.find(
      (candidate) => candidate.queueName === "payment-confirmation"
    );
    if (!worker) throw new Error("payment_worker_missing");

    const result = await worker.run({
      data: {
        job_id: "job_1",
        job_name: "payment_confirmed_placeholder",
        queue_name: "payment-confirmation",
        correlation_id: "corr_1",
        order_id: "order_1",
        order_number: "A100",
        manifest_id: null,
        identity_version_id: null,
        attempt: 0,
        max_attempts: 3,
        idempotency_key: "outbox:evt_1",
        created_at: "2026-06-29T00:00:00.000Z",
        payload: {
          outbox_event_id: "evt_1",
          event_type: "order.paid",
          aggregate_type: "order",
          aggregate_id: "order_1",
          event_payload: {
            order_id: "order_1",
            order_item_id: "item_1"
          }
        }
      },
      attemptsMade: 0
    });

    expect(result).toMatchObject({
      manifest_id: "manifest_1",
      generation_job_id: "generation_job_1",
      download_token_id: "download_token_1",
      email_delivery_status: "sent",
      raw_token_omitted: true
    });
    expect(databaseModule.processOrderPaidOutbox).toHaveBeenCalled();
    expect(databaseModule.runManifestDrivenGeneration).toHaveBeenCalled();
    expect(databaseModule.state.sentDeliveryInput).toMatchObject({
      raw_token_for_internal_delivery_only: "raw-token-once",
      recipient_email: "founder-test@example.com"
    });
    expect(databaseModule.state.orderUpdates.at(-1)).toMatchObject({
      order_id: "order_1",
      order_status: "completed",
      fulfillment_status: "completed"
    });
    expect(JSON.stringify(databaseModule.state.emailLogs)).not.toContain("raw-token-once");
    await app.shutdown();
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("recovers paid orders that remain not_started", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule({
      stuckOrders: [
        {
          id: "order_1",
          orderNumber: "AHL-STUCK",
          totalCents: 4900n,
          currency: "USD",
          paidAt: new Date("2026-07-01T00:00:00.000Z"),
          metadataJson: {
            house_id: "house_1",
            identity_version_id: "identity_version_1"
          },
          orderItems: [
            {
              id: "item_1",
              productSnapshotJson: {
                product_code: "family_legacy_collection",
                package_code: "premium"
              }
            }
          ]
        }
      ]
    });

    const result = await recoverStuckPaidOrders({
      queueModule,
      databaseModule: databaseModule as never,
      orchestrationRepository: {
        async updateOrderStatus(input: unknown) {
          databaseModule.state.orderUpdates.push(input);
          return input;
        }
      },
      emailModule: createMockEmailModule()
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, failed: 0 });
    expect(databaseModule.processOrderPaidOutbox).toHaveBeenCalled();
    expect(databaseModule.runManifestDrivenGeneration).toHaveBeenCalled();
    expect(databaseModule.state.sentDeliveryInput).toMatchObject({
      raw_token_for_internal_delivery_only: "raw-token-once",
      recipient_email: "founder-test@example.com"
    });
    expect(databaseModule.state.orderUpdates.at(-1)).toMatchObject({
      order_id: "order_1",
      order_status: "completed",
      fulfillment_status: "completed"
    });
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("does not silently complete paid order fulfillment when delivery email fails", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule();
    const app = createWorkerApp({
      config: {
        redisUrl: "redis://localhost:6379",
        concurrency: 1,
        pollIntervalMs: 60_000,
        enableOutboxDispatcher: false,
        environment: "test",
        recoveryScanEnabled: false,
        recoveryScanIntervalMs: 300_000,
        cleanupDestructiveEnabled: false,
        stuckOrderThresholdMinutes: 30
      },
      queueModule,
      databaseModule,
      aiModule: createMockAiModule(),
      storageModule: createMockStorageModule(),
      pdfModule: createMockPdfModule(),
      emailModule: createMockEmailModule({ status: "failed" })
    });

    const worker = queueModule.createdWorkers.find(
      (candidate) => candidate.queueName === "payment-confirmation"
    );
    if (!worker) throw new Error("payment_worker_missing");

    await expect(
      worker.run({
        data: {
          job_id: "job_1",
          job_name: "payment_confirmed_placeholder",
          queue_name: "payment-confirmation",
          correlation_id: "corr_1",
          order_id: "order_1",
          order_number: "A100",
          manifest_id: null,
          identity_version_id: null,
          attempt: 0,
          max_attempts: 3,
          idempotency_key: "outbox:evt_1",
          created_at: "2026-06-29T00:00:00.000Z",
          payload: {
            outbox_event_id: "evt_1",
            event_type: "order.paid",
            aggregate_type: "order",
            aggregate_id: "order_1",
            event_payload: {
              order_id: "order_1",
              order_item_id: "item_1"
            }
          }
        },
        attemptsMade: 0
      })
    ).rejects.toThrow("delivery_email_failed");
    expect(databaseModule.state.orderUpdates.at(-1)).toMatchObject({
      order_id: "order_1",
      order_status: "processing",
      fulfillment_status: "failed",
      completed_at: null
    });
    expect(databaseModule.state.sentDeliveryInput).toMatchObject({
      recipient_email: "founder-test@example.com"
    });
    await app.shutdown();
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("recovers completed vault-ready orders that are missing resend delivery", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule({
      completedMissingEmailOrders: [
        buildVaultReadyOrder({
          id: "order_1",
          orderNumber: "AHL-MISSING-EMAIL"
        })
      ]
    });

    const result = await recoverCompletedOrdersMissingDeliveryEmail({
      queueModule,
      databaseModule: databaseModule as never,
      orchestrationRepository: {
        async updateOrderStatus(input: unknown) {
          databaseModule.state.orderUpdates.push(input);
          return input;
        }
      },
      emailModule: createMockEmailModule(),
      now: new Date("2026-07-02T00:00:00.000Z")
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, failed: 0 });
    expect(databaseModule.state.downloadTokens).toHaveLength(1);
    expect(databaseModule.state.downloadTokenAssets).toHaveLength(2);
    expect(databaseModule.state.sentDeliveryInput).toMatchObject({
      download_token_id: databaseModule.state.downloadTokens[0]?.id,
      raw_token_for_internal_delivery_only: expect.any(String),
      recipient_email: "founder-test@example.com"
    });
    const sentDeliveryInput = databaseModule.state.sentDeliveryInput as {
      raw_token_for_internal_delivery_only?: string;
    };
    expect(JSON.stringify(databaseModule.state.downloadTokens)).not.toContain(
      sentDeliveryInput.raw_token_for_internal_delivery_only
    );
    expect(queueModule.writeWorkerLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: "EMAIL_JOB_CREATED" })
    );
    expect(queueModule.writeWorkerLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: "EMAIL_TRIGGERED" })
    );
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("includes failed fulfillment orders when vault is ready and resend delivery is missing", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule({
      completedMissingEmailOrders: [
        buildVaultReadyOrder({
          id: "order_failed_email",
          orderNumber: "AHL-FAILED-EMAIL",
          fulfillmentStatus: "failed",
          emailLogs: [
            {
              provider: "resend",
              status: "failed",
              createdAt: new Date("2026-07-01T00:00:00.000Z")
            }
          ]
        })
      ]
    });

    const result = await recoverCompletedOrdersMissingDeliveryEmail({
      queueModule,
      databaseModule: databaseModule as never,
      orchestrationRepository: {
        async updateOrderStatus(input: unknown) {
          databaseModule.state.orderUpdates.push(input);
          return input;
        }
      },
      emailModule: createMockEmailModule(),
      now: new Date("2026-07-02T00:00:00.000Z")
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, failed: 0 });
    expect(databaseModule.state.downloadTokens).toHaveLength(1);
    expect(JSON.stringify(databaseModule.state.downloadTokens)).not.toContain(
      (databaseModule.state.sentDeliveryInput as { raw_token_for_internal_delivery_only?: string })
        .raw_token_for_internal_delivery_only
    );
    expect(queueModule.writeWorkerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "recovery_candidate_order",
        extra: expect.objectContaining({
          order_number: "AHL-FAILED-EMAIL",
          fulfillment_status: "failed"
        })
      })
    );
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("does not treat mock email logs as successful resend delivery", async () => {
    process.env.EMAIL_DELIVERY_TEST_MODE = "true";
    process.env.EMAIL_TEST_RECIPIENT = "founder-test@example.com";
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule({
      completedMissingEmailOrders: [
        buildVaultReadyOrder({
          id: "order_mock_sent",
          orderNumber: "AHL-MOCK-SENT",
          emailLogs: [
            {
              provider: "mock",
              status: "sent",
              createdAt: new Date("2026-07-02T00:00:00.000Z")
            }
          ]
        })
      ]
    });

    const result = await recoverCompletedOrdersMissingDeliveryEmail({
      queueModule,
      databaseModule: databaseModule as never,
      orchestrationRepository: {},
      emailModule: createMockEmailModule(),
      now: new Date("2026-07-02T00:05:00.000Z")
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, failed: 0 });
    expect(databaseModule.state.sentDeliveryInput).toMatchObject({
      recipient_email: "founder-test@example.com"
    });
    delete process.env.EMAIL_DELIVERY_TEST_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  it("excludes orders with successful resend delivery", async () => {
    const queueModule = createMockQueueModule();
    const databaseModule = createMockDatabaseModule({
      completedMissingEmailOrders: [
        buildVaultReadyOrder({
          id: "order_resend_sent",
          orderNumber: "AHL-RESEND-SENT",
          emailLogs: [
            {
              provider: "resend",
              status: "sent",
              providerMessageId: "resend_message_1",
              createdAt: new Date("2026-07-02T00:00:00.000Z")
            }
          ]
        })
      ]
    });

    const result = await recoverCompletedOrdersMissingDeliveryEmail({
      queueModule,
      databaseModule: databaseModule as never,
      orchestrationRepository: {},
      emailModule: createMockEmailModule(),
      now: new Date("2026-07-02T00:05:00.000Z")
    });

    expect(result).toEqual({ scanned: 1, recovered: 0, failed: 0 });
    expect(databaseModule.state.downloadTokens).toHaveLength(0);
    expect(queueModule.writeWorkerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "scanner_candidate_excluded_reason",
        extra: expect.objectContaining({
          order_number: "AHL-RESEND-SENT",
          reason: "resend_already_sent"
        })
      })
    );
  });
});

function createMockQueueModule() {
  const createdQueues: MockQueue[] = [];
  const createdWorkers: MockWorker[] = [];

  return {
    ALL_QUEUE_NAMES: allQueueNames,
    QUEUE_NAMES: {
      paymentConfirmation: "payment-confirmation",
      generationManifest: "generation-manifest",
      generation: "generation",
      aiImageGeneration: "ai-image-generation",
      aiTextGeneration: "ai-text-generation",
      imagePostprocess: "image-postprocess",
      pdfGeneration: "pdf-generation",
      zipPackaging: "zip-packaging",
      assetStorage: "asset-storage",
      downloadToken: "download-token",
      emailDelivery: "email-delivery",
      cleanup: "cleanup",
      deadLetter: "dead-letter"
    },
    createdQueues,
    createdWorkers,
    createRedisConnection() {
      return {};
    },
    createQueue(queueName: string) {
      const queue = new MockQueue(queueName);
      createdQueues.push(queue);
      return queue;
    },
    createWorker(queueName: string, _connection: unknown, processor: unknown, concurrency: number) {
      const worker = new MockWorker(queueName, processor, concurrency);
      createdWorkers.push(worker);
      return worker;
    },
    async placeholderProcessor() {
      return { success: true };
    },
    writeWorkerLog: vi.fn(),
    OutboxDispatcher: MockOutboxDispatcher
  };
}

function createMockStorageModule() {
  return {
    LocalPrivateStorageAdapter: class MockStorageAdapter {},
    InMemoryAssetRepository: class MockAssetRepository {},
    InMemoryDownloadVaultRepository: class MockDownloadRepository {},
    async createTransparentPng() {
      return { transparent: true };
    },
    async generateZipPackage() {
      return { mime_type: "application/zip" };
    },
    async storeCandidateAsAsset() {
      return { public_url: null };
    },
    async createDownloadTokenJob() {
      return { download_token_id: "token_1", raw_token_for_internal_delivery_only: "omitted" };
    }
  };
}

function createMockEmailModule(options: { status?: "sent" | "failed" } = {}) {
  return {
    InMemoryEmailLogRepository: class MockEmailLogRepository {},
    MockEmailProvider: class MockEmailProvider {},
    createEmailProviderFromEnv() {
      return { provider_code: "mock" };
    },
    async sendDeliveryEmailJob(input: unknown, dependencies: { emailLogRepository: { createEmailLog(input: unknown): Promise<unknown> } }) {
      const status = options.status ?? "sent";
      currentDatabaseModuleState.sentDeliveryInput = input;
      await dependencies.emailLogRepository.createEmailLog({
        id: "email_log_2",
        order_id: "order_1",
        email_template_id: null,
        provider: "mock",
        provider_message_id: "mock_message_1",
        recipient_email_hash: "a".repeat(64),
        status,
        error_message: status === "failed" ? "email_delivery_failed" : null,
        payload_json: {
          masked_download_vault_link: "https://mykinlegacy.com/download/[redacted]",
          download_token_id: "download_token_1"
        },
        created_at: new Date("2026-06-29T00:00:00.000Z"),
        sent_at: status === "sent" ? new Date("2026-06-29T00:00:00.000Z") : null
      });
      return { email_log_id: "email_log_1", status };
    }
  };
}

function createMockPdfModule() {
  return {
    GLOBAL_PDF_DISCLAIMER: "disclaimer",
    async generateHeritagePdf() {
      return { mime_type: "application/pdf" };
    }
  };
}

function createMockAiModule() {
  return {
    DefaultAiProviderRegistry: class MockProviderRegistry {},
    InMemoryAiGenerationRunRepository: class MockRunRepository {},
    async handleAiImageGenerationJob() {
      return { candidate_type: "image" };
    },
    async handleAiTextGenerationJob() {
      return { candidate_type: "text" };
    }
  };
}

function buildVaultReadyOrder(input: {
  id: string;
  orderNumber: string;
  fulfillmentStatus?: string;
  emailLogs?: unknown[];
}) {
  return {
    id: input.id,
    orderNumber: input.orderNumber,
    paymentStatus: "paid",
    fulfillmentStatus: input.fulfillmentStatus ?? "completed",
    downloadTokens: [
      {
        id: `${input.id}_download_token_old`,
        status: "active",
        downloadTokenAssets: [{ assetId: "asset_1" }, { assetId: "asset_2" }]
      }
    ],
    emailLogs: input.emailLogs ?? []
  };
}

function createMockDatabaseModule(options: { stuckOrders?: unknown[]; completedMissingEmailOrders?: unknown[] } = {}) {
  currentDatabaseModuleState = {
    sentDeliveryInput: null,
    emailLogs: [] as unknown[],
    orderUpdates: [] as unknown[],
    downloadTokens: [] as Array<Record<string, unknown>>,
    downloadTokenAssets: [] as Array<Record<string, unknown>>
  };
  const repository = class MockPrismaOrchestrationRepository {
    async updateOrderStatus(input: unknown) {
      currentDatabaseModuleState.orderUpdates.push(input);
      return input;
    }
  };
  return {
    state: currentDatabaseModuleState,
    prisma: {
      outboxEvent: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args: { data: unknown }) => args.data)
      },
      order: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: Record<string, unknown> }).where ?? {};
          if (where.downloadTokens) {
            return options.completedMissingEmailOrders ?? [];
          }
          return options.stuckOrders ?? [];
        })
      },
      orderCustomerPii: {
        findUnique: vi.fn(async () => ({
          emailHash: "b".repeat(64),
          emailEncrypted: Buffer.from("placeholder:v1:not-decryptable")
        }))
      },
      emailLog: {
        create: vi.fn(async (args: { data: unknown }) => {
          currentDatabaseModuleState.emailLogs.push(args.data);
          return args.data;
        })
      },
      downloadToken: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          currentDatabaseModuleState.downloadTokens.push(args.data);
          return args.data;
        })
      },
      downloadTokenAsset: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          currentDatabaseModuleState.downloadTokenAssets.push(args.data);
          return args.data;
        })
      },
      $disconnect: vi.fn(async () => undefined)
    },
    PrismaOrchestrationRepository: repository,
    processOrderPaidOutbox: vi.fn(async () => ({
      manifest: { id: "manifest_1" },
      generation_job_id: "generation_job_1",
      created: true
    })),
    runManifestDrivenGeneration: vi.fn(async () => ({
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once"
    }))
  };
}

let currentDatabaseModuleState: {
  sentDeliveryInput: unknown;
  emailLogs: unknown[];
  orderUpdates: unknown[];
  downloadTokens: Array<Record<string, unknown>>;
  downloadTokenAssets: Array<Record<string, unknown>>;
} = {
  sentDeliveryInput: null,
  emailLogs: [],
  orderUpdates: [],
  downloadTokens: [],
  downloadTokenAssets: []
};

class MockQueue {
  public closed = false;

  constructor(public readonly queueName: string) {}

  async close() {
    this.closed = true;
  }
}

class MockWorker {
  public closed = false;

  constructor(
    public readonly queueName: string,
    public readonly processor: unknown,
    public readonly concurrency: number
  ) {}

  async close() {
    this.closed = true;
  }

  async run(job: unknown) {
    const processor = this.processor as (job: unknown) => Promise<unknown>;
    return processor(job);
  }
}

class MockOutboxDispatcher {
  async dispatchOnce() {
    return { scanned: 0 };
  }
}
