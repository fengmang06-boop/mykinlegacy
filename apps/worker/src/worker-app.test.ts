import { describe, expect, it, vi } from "vitest";

import { createWorkerApp, getWorkerStatus } from "./app";

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

function createMockEmailModule() {
  return {
    InMemoryEmailLogRepository: class MockEmailLogRepository {},
    MockEmailProvider: class MockEmailProvider {},
    async sendDeliveryEmailJob() {
      return { email_log_id: "email_log_1", status: "sent" };
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

function createMockDatabaseModule() {
  return {
    prisma: {
      outboxEvent: {},
      $disconnect: vi.fn(async () => undefined)
    }
  };
}

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
}

class MockOutboxDispatcher {
  async dispatchOnce() {
    return { scanned: 0 };
  }
}
