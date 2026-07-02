import { createHash, randomBytes } from "node:crypto";

import { loadWorkerConfig, type WorkerRuntimeConfig } from "./config";
import { sendVaultReadyEmail } from "./vault-delivery";

const observability = requireObservability();

interface JobEnvelope {
  job_id: string;
  job_name: string;
  queue_name: string;
  correlation_id: string;
  order_id: string | null;
  order_number: string | null;
  manifest_id: string | null;
  identity_version_id: string | null;
  attempt: number;
  max_attempts: number;
  idempotency_key: string;
  created_at: string;
  payload: unknown;
}

interface QueueHandle {
  close(): Promise<void>;
  on?(event: "error", listener: (error: unknown) => void): unknown;
}

interface WorkerHandle {
  close(): Promise<void>;
  on?(event: "error", listener: (error: unknown) => void): unknown;
}

interface RuntimeJob {
  data: JobEnvelope;
  attemptsMade: number;
}

type Processor = (job: RuntimeJob) => Promise<unknown>;
type JsonRecord = Record<string, unknown>;
type RecoverySnapshot = Record<string, unknown>;
type RecoveryIssue = Record<string, unknown>;

type WorkerOutboxEvent = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload_json: JsonRecord;
  status: "processing";
  attempts: number;
  created_at: string;
  published_at: string | null;
};

interface SchedulerFoundation {
  recovery_scan_enabled: boolean;
  recovery_scan_interval_ms: number;
  cleanup_destructive_enabled: boolean;
  jobs: string[];
  runRecoveryScanJob(snapshot: RecoverySnapshot): RecoveryIssue[];
}

interface QueueModule {
  ALL_QUEUE_NAMES: readonly string[];
  QUEUE_NAMES: {
    paymentConfirmation: string;
    generationManifest: string;
    generation: string;
    aiImageGeneration: string;
    aiTextGeneration: string;
    imagePostprocess: string;
    pdfGeneration: string;
    zipPackaging: string;
    assetStorage: string;
    downloadToken: string;
    emailDelivery: string;
    cleanup: string;
    deadLetter: string;
  };
  createRedisConnection(input: { redisUrl: string }): unknown;
  createQueue(queueName: string, connection: unknown): QueueHandle;
  createWorker(
    queueName: string,
    connection: unknown,
    processor: Processor,
    concurrency: number
  ): WorkerHandle;
  placeholderProcessor(envelope: JobEnvelope): Promise<unknown>;
  writeWorkerLog(input: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    queue_name?: string | null;
    envelope?: JobEnvelope | null;
    duration_ms?: number | null;
    extra?: Record<string, unknown>;
  }): void;
  OutboxDispatcher: new (options: {
    outbox: unknown;
    queues: { paymentConfirmation: QueueHandle };
  }) => { dispatchOnce(): Promise<unknown> };
}

type OrderRecoveryDelegate = {
  findMany(args: unknown): Promise<unknown[]>;
};

type DownloadTokenRecoveryDelegate = {
  create(args: unknown): Promise<unknown>;
};

type DownloadTokenAssetRecoveryDelegate = {
  create(args: unknown): Promise<unknown>;
};

type OutboxRecoveryDelegate = {
  findFirst(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
};

interface DatabaseModule {
  prisma: {
    outboxEvent: unknown;
    order: OrderRecoveryDelegate;
    orderCustomerPii: unknown;
    emailLog: unknown;
    downloadToken?: DownloadTokenRecoveryDelegate;
    downloadTokenAsset?: DownloadTokenAssetRecoveryDelegate;
    $disconnect(): Promise<void>;
  };
  PrismaOrchestrationRepository: new (db: unknown) => unknown;
  processOrderPaidOutbox(input: unknown): Promise<{
    manifest: { id: string };
    generation_job_id: string;
    created: boolean;
  }>;
  runManifestDrivenGeneration(input: unknown): Promise<{
    download_token_id: string;
    raw_token_for_email_only?: string;
  }>;
}

export interface WorkerAppOptions {
  config?: WorkerRuntimeConfig;
  connection?: unknown;
  queueModule?: QueueModule;
  databaseModule?: DatabaseModule;
  queueFactory?: (queueName: string, connection: unknown) => QueueHandle;
  workerFactory?: (
    queueName: string,
    connection: unknown,
    processor: Processor,
    concurrency: number
  ) => WorkerHandle;
  outboxDispatcher?: {
    dispatchOnce(): Promise<unknown>;
  };
  aiModule?: AiModule;
  storageModule?: StorageModule;
  pdfModule?: PdfModule;
  emailModule?: EmailModule;
}

export interface WorkerApp {
  config: WorkerRuntimeConfig;
  queues: Map<string, QueueHandle>;
  workers: WorkerHandle[];
  health(): {
    status: "ready";
    service: "worker";
    queue_count: number;
    worker_count: number;
    outbox_dispatcher_enabled: boolean;
    scheduler: {
      recovery_scan_enabled: boolean;
      recovery_scan_interval_ms: number;
      cleanup_destructive_enabled: boolean;
      jobs: string[];
      last_recovery_scan_at: string | null;
    };
  };
  runRecoveryScan(snapshot?: RecoverySnapshot): RecoveryIssue[];
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

interface AiModule {
  DefaultAiProviderRegistry: new () => unknown;
  InMemoryAiGenerationRunRepository: new () => unknown;
  handleAiImageGenerationJob(input: unknown, dependencies: unknown): Promise<unknown>;
  handleAiTextGenerationJob(input: unknown, dependencies: unknown): Promise<unknown>;
}

interface StorageModule {
  LocalPrivateStorageAdapter: new (rootDir?: string) => unknown;
  InMemoryAssetRepository: new () => unknown;
  InMemoryDownloadVaultRepository: new () => unknown;
  createTransparentPng(input: unknown): Promise<unknown>;
  generateZipPackage(input: unknown): Promise<unknown>;
  storeCandidateAsAsset(input: unknown): Promise<unknown>;
  createDownloadTokenJob(input: unknown, dependencies: unknown): Promise<unknown>;
}

interface PdfModule {
  generateHeritagePdf(input: unknown): Promise<unknown>;
  GLOBAL_PDF_DISCLAIMER: string;
}

interface EmailModule {
  InMemoryEmailLogRepository: new () => unknown;
  MockEmailProvider: new () => unknown;
  createEmailProviderFromEnv(env: Record<string, string | undefined>): unknown;
  sendDeliveryEmailJob(input: unknown, dependencies: unknown): Promise<unknown>;
}

export function createWorkerApp(options: WorkerAppOptions = {}): WorkerApp {
  const queueModule = options.queueModule ?? requireQueue();
  const databaseModule = options.databaseModule ?? requireDatabase();
  const config = options.config ?? loadWorkerConfig();
  const connection =
    options.connection ?? queueModule.createRedisConnection({ redisUrl: config.redisUrl });
  const queueFactory = options.queueFactory ?? queueModule.createQueue;
  const workerFactory = options.workerFactory ?? queueModule.createWorker;
  const queues = new Map<string, QueueHandle>();
  const workers: WorkerHandle[] = [];
  const aiModule = options.aiModule ?? requireAi();
  const storageModule = options.storageModule ?? requireStorage();
  const pdfModule = options.pdfModule ?? requirePdf();
  const emailModule = options.emailModule ?? requireEmail();
  const aiDependencies = {
    providerRegistry: new aiModule.DefaultAiProviderRegistry(),
    runRepository: new aiModule.InMemoryAiGenerationRunRepository()
  };
  let outboxInterval: NodeJS.Timeout | null = null;
  let outboxMaintenanceRunning = false;
  let recoveryScanInterval: NodeJS.Timeout | null = null;
  let lastRecoveryScanAt: string | null = null;
  const scheduler = observability.createSchedulerFoundation({
    ...process.env,
    RECOVERY_SCAN_ENABLED: String(config.recoveryScanEnabled),
    RECOVERY_SCAN_INTERVAL_MS: String(config.recoveryScanIntervalMs),
    CLEANUP_DESTRUCTIVE_ENABLED: String(config.cleanupDestructiveEnabled)
  });

  for (const queueName of queueModule.ALL_QUEUE_NAMES) {
    const queue = queueFactory(queueName, connection);
    attachRuntimeErrorLog(queueModule, queue, queueName);
    queues.set(queueName, queue);
  }

  const orchestrationRepository = new databaseModule.PrismaOrchestrationRepository(
    databaseModule.prisma
  );

  const paymentConfirmationWorker = workerFactory(
    queueModule.QUEUE_NAMES.paymentConfirmation,
    connection,
    wrapPaymentConfirmationProcessor(queueModule, databaseModule, orchestrationRepository, emailModule),
    config.concurrency
  );
  attachRuntimeErrorLog(
    queueModule,
    paymentConfirmationWorker,
    queueModule.QUEUE_NAMES.paymentConfirmation
  );
  workers.push(paymentConfirmationWorker);

  for (const queueName of getPlaceholderProcessorQueues(queueModule)) {
    const worker = workerFactory(
      queueName,
      connection,
      wrapPlaceholderProcessor(queueModule, queueName),
      config.concurrency
    );
    attachRuntimeErrorLog(queueModule, worker, queueName);
    workers.push(worker);
  }

  const aiImageWorker = workerFactory(
    queueModule.QUEUE_NAMES.aiImageGeneration,
    connection,
    wrapAiImageProcessor(queueModule, aiModule, aiDependencies),
    config.concurrency
  );
  attachRuntimeErrorLog(queueModule, aiImageWorker, queueModule.QUEUE_NAMES.aiImageGeneration);
  workers.push(aiImageWorker);

  const aiTextWorker = workerFactory(
    queueModule.QUEUE_NAMES.aiTextGeneration,
    connection,
    wrapAiTextProcessor(queueModule, aiModule, aiDependencies),
    config.concurrency
  );
  attachRuntimeErrorLog(queueModule, aiTextWorker, queueModule.QUEUE_NAMES.aiTextGeneration);
  workers.push(aiTextWorker);

  const storageDependencies = {
    storage: new storageModule.LocalPrivateStorageAdapter(),
    repository: new storageModule.InMemoryAssetRepository(),
    downloadRepository: new storageModule.InMemoryDownloadVaultRepository()
  };
  const emailDependencies = {
    provider: new emailModule.MockEmailProvider(),
    emailLogRepository: new emailModule.InMemoryEmailLogRepository()
  };
  const foundationWorkers: Array<[string, Processor]> = [
    [
      queueModule.QUEUE_NAMES.imagePostprocess,
      wrapImagePostprocessProcessor(queueModule, storageModule)
    ],
    [queueModule.QUEUE_NAMES.pdfGeneration, wrapPdfGenerationProcessor(queueModule, pdfModule)],
    [queueModule.QUEUE_NAMES.zipPackaging, wrapZipPackagingProcessor(queueModule, storageModule)],
    [
      queueModule.QUEUE_NAMES.assetStorage,
      wrapAssetStorageProcessor(queueModule, storageModule, storageDependencies)
    ],
    [
      queueModule.QUEUE_NAMES.downloadToken,
      wrapCreateDownloadTokenProcessor(queueModule, storageModule, storageDependencies)
    ],
    [
      queueModule.QUEUE_NAMES.emailDelivery,
      wrapSendDeliveryEmailProcessor(queueModule, emailModule, emailDependencies)
    ]
  ];

  for (const [queueName, processor] of foundationWorkers) {
    const worker = workerFactory(queueName, connection, processor, config.concurrency);
    attachRuntimeErrorLog(queueModule, worker, queueName);
    workers.push(worker);
  }

  const paymentConfirmationQueue = queues.get(queueModule.QUEUE_NAMES.paymentConfirmation);
  const outboxDispatcher =
    options.outboxDispatcher ??
    (paymentConfirmationQueue
      ? new queueModule.OutboxDispatcher({
          outbox: databaseModule.prisma.outboxEvent,
          queues: {
            paymentConfirmation: paymentConfirmationQueue
          }
        })
      : null);

  return {
    config,
    queues,
    workers,
    health() {
      return {
        status: "ready",
        service: "worker",
        queue_count: queues.size,
        worker_count: workers.length,
        outbox_dispatcher_enabled: config.enableOutboxDispatcher,
        scheduler: {
          recovery_scan_enabled: scheduler.recovery_scan_enabled,
          recovery_scan_interval_ms: scheduler.recovery_scan_interval_ms,
          cleanup_destructive_enabled: scheduler.cleanup_destructive_enabled,
          jobs: scheduler.jobs,
          last_recovery_scan_at: lastRecoveryScanAt
        }
      };
    },
    runRecoveryScan(snapshot: RecoverySnapshot = {}) {
      lastRecoveryScanAt = new Date().toISOString();
      return scheduler.runRecoveryScanJob(snapshot);
    },
    async start() {
      queueModule.writeWorkerLog({
        level: "info",
        message: "worker_started",
        queue_name: "worker",
        extra: {
          environment: config.environment,
          queue_count: queues.size,
          worker_count: workers.length,
          outbox_dispatcher_enabled: config.enableOutboxDispatcher
        }
      });

      if (config.enableOutboxDispatcher && outboxDispatcher) {
        const runOutboxMaintenance = async () => {
          if (outboxMaintenanceRunning) {
            return;
          }
          outboxMaintenanceRunning = true;
          try {
            await outboxDispatcher.dispatchOnce();
            await recoverStuckPaidOrders({
              queueModule,
              databaseModule,
              orchestrationRepository,
              emailModule
            });
            await recoverCompletedOrdersMissingDeliveryEmail({
              queueModule,
              databaseModule,
              orchestrationRepository,
              emailModule
            });
          } catch (error) {
            queueModule.writeWorkerLog({
              level: "error",
              message: "outbox_maintenance_failed",
              queue_name: queueModule.QUEUE_NAMES.paymentConfirmation,
              extra: {
                error_message:
                  error instanceof Error ? error.message : "Unknown outbox maintenance error"
              }
            });
          } finally {
            outboxMaintenanceRunning = false;
          }
        };
        void runOutboxMaintenance();
        outboxInterval = setInterval(() => {
          void runOutboxMaintenance();
        }, config.pollIntervalMs);
      }

      if (scheduler.recovery_scan_enabled) {
        recoveryScanInterval = setInterval(() => {
          lastRecoveryScanAt = new Date().toISOString();
          queueModule.writeWorkerLog({
            level: "info",
            message: "recovery_scan_job_completed",
            queue_name: queueModule.QUEUE_NAMES.cleanup,
            extra: {
              destructive_cleanup_enabled: scheduler.cleanup_destructive_enabled
            }
          });
        }, scheduler.recovery_scan_interval_ms);
      }
    },
    async shutdown() {
      if (outboxInterval) {
        clearInterval(outboxInterval);
        outboxInterval = null;
      }
      if (recoveryScanInterval) {
        clearInterval(recoveryScanInterval);
        recoveryScanInterval = null;
      }

      await Promise.allSettled(workers.map((worker) => worker.close()));
      await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
      await databaseModule.prisma.$disconnect().catch(() => undefined);

      queueModule.writeWorkerLog({
        level: "info",
        message: "worker_shutdown_complete",
        queue_name: "worker"
      });
    }
  };
}

export function getWorkerStatus(queueModule: QueueModule = requireQueue()) {
  return {
    status: "ready",
    service: "worker",
    queue_names: queueModule.ALL_QUEUE_NAMES
  };
}

export async function recoverStuckPaidOrders(input: {
  queueModule: QueueModule;
  databaseModule: DatabaseModule;
  orchestrationRepository: unknown;
  emailModule: EmailModule;
  now?: Date;
}): Promise<{ scanned: number; recovered: number; failed: number }> {
  const now = input.now ?? new Date();
  const orders = await input.databaseModule.prisma.order.findMany({
    where: { paymentStatus: "paid", fulfillmentStatus: { in: ["not_started", "queued", "generating"] } },
    orderBy: { paidAt: "asc" },
    take: 10,
    include: {
      orderItems: {
        include: { product: true, package: true }
      }
    }
  });
  const result = { scanned: orders.length, recovered: 0, failed: 0 };

  for (const orderRow of orders) {
    try {
      const outboxEvent = await findOrCreateOrderPaidOutbox(input.databaseModule.prisma, orderRow, now);
      await fulfillOrderPaidOutbox({
        queueModule: input.queueModule,
        databaseModule: input.databaseModule,
        orchestrationRepository: input.orchestrationRepository,
        emailModule: input.emailModule,
        outboxEvent,
        orderNumberFallback: recordString(orderRow, "orderNumber")
      });
      result.recovered += 1;
      input.queueModule.writeWorkerLog({
        level: "info",
        message: "stuck_paid_order_recovered",
        queue_name: input.queueModule.QUEUE_NAMES.paymentConfirmation,
        extra: {
          order_id: recordString(orderRow, "id"),
          order_number: recordString(orderRow, "orderNumber"),
          raw_token_omitted: true
        }
      });
    } catch (error) {
      result.failed += 1;
      input.queueModule.writeWorkerLog({
        level: "error",
        message: "stuck_paid_order_recovery_failed",
        queue_name: input.queueModule.QUEUE_NAMES.paymentConfirmation,
        extra: {
          order_id: recordString(orderRow, "id"),
          order_number: recordString(orderRow, "orderNumber"),
          error_message: error instanceof Error ? error.message : "Unknown stuck order recovery error"
        }
      });
    }
  }

  return result;
}

function getPlaceholderProcessorQueues(queueModule: QueueModule): string[] {
  return [
    queueModule.QUEUE_NAMES.generationManifest,
    queueModule.QUEUE_NAMES.generation,
    queueModule.QUEUE_NAMES.cleanup,
    queueModule.QUEUE_NAMES.deadLetter
  ];
}

function wrapPaymentConfirmationProcessor(
  queueModule: QueueModule,
  databaseModule: DatabaseModule,
  orchestrationRepository: unknown,
  emailModule: EmailModule
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const outboxEvent = toOrchestrationOutboxEvent(job.data.payload, job.attemptsMade);
    const fulfillment = await fulfillOrderPaidOutbox({
      queueModule,
      databaseModule,
      orchestrationRepository,
      emailModule,
      outboxEvent,
      orderNumberFallback: job.data.order_number
    });

    queueModule.writeWorkerLog({
      level: "info",
      message: "paid_order_placeholder_collection_ready",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.paymentConfirmation,
      duration_ms: Date.now() - startedAt,
      extra: {
        manifest_id: fulfillment.manifest_id,
        generation_job_id: fulfillment.generation_job_id,
        created: fulfillment.created,
        download_token_id: fulfillment.download_token_id,
        email_delivery_status: fulfillment.email_delivery_status,
        email_recipient_source: fulfillment.email_recipient_source,
        raw_token_omitted: true
      }
    });

    return {
      manifest_id: fulfillment.manifest_id,
      generation_job_id: fulfillment.generation_job_id,
      download_token_id: fulfillment.download_token_id,
      email_delivery_status: fulfillment.email_delivery_status,
      raw_token_omitted: true
    };
  };
}

async function fulfillOrderPaidOutbox(input: {
  queueModule: QueueModule;
  databaseModule: DatabaseModule;
  orchestrationRepository: unknown;
  emailModule: EmailModule;
  outboxEvent: WorkerOutboxEvent;
  orderNumberFallback: string | null;
}) {
  const now = new Date();
  const manifestResult = await input.databaseModule.processOrderPaidOutbox({
    outboxEvent: input.outboxEvent,
    repository: input.orchestrationRepository,
    now
  });
  const generationResult = await input.databaseModule.runManifestDrivenGeneration({
    manifest_id: manifestResult.manifest.id,
    repository: input.orchestrationRepository,
    now
  });
  const deliveryResult = await sendVaultReadyEmail({
    db: input.databaseModule.prisma as never,
    emailModule: input.emailModule as never,
    order_id: requireStringField(input.outboxEvent.payload_json, "order_id"),
    order_number:
      input.orderNumberFallback ?? requireStringField(input.outboxEvent.payload_json, "order_number"),
    download_token_id: generationResult.download_token_id,
    raw_token_for_email_only: generationResult.raw_token_for_email_only,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    log: (entry) => {
      inputLogDelivery(entry, input.queueModule, input.outboxEvent);
    }
  });
  if (deliveryResult.status !== "sent") {
    await updateOrderDeliveryStatus({
      orchestrationRepository: input.orchestrationRepository,
      orderId: requireStringField(input.outboxEvent.payload_json, "order_id"),
      orderStatus: "processing",
      fulfillmentStatus: "failed",
      completedAt: null
    });
    throw new Error(`delivery_email_${deliveryResult.status}`);
  }

  await updateOrderDeliveryStatus({
    orchestrationRepository: input.orchestrationRepository,
    orderId: requireStringField(input.outboxEvent.payload_json, "order_id"),
    orderStatus: "completed",
    fulfillmentStatus: "completed",
    completedAt: new Date().toISOString()
  });

  return {
    manifest_id: manifestResult.manifest.id,
    generation_job_id: manifestResult.generation_job_id,
    created: manifestResult.created,
    download_token_id: generationResult.download_token_id,
    email_delivery_status: deliveryResult.status,
    email_recipient_source: deliveryResult.recipient_source
  };
}

export async function recoverCompletedOrdersMissingDeliveryEmail(input: {
  queueModule: QueueModule;
  databaseModule: DatabaseModule;
  orchestrationRepository: unknown;
  emailModule: EmailModule;
  now?: Date;
}): Promise<{ scanned: number; recovered: number; failed: number }> {
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 10 * 60_000);
  const orders = await input.databaseModule.prisma.order.findMany({
    where: {
      paymentStatus: "paid",
      fulfillmentStatus: "completed",
      downloadTokens: { some: { status: "active" } },
      AND: [
        { emailLogs: { none: { provider: "resend", status: "sent" } } },
        { emailLogs: { none: { provider: "resend", createdAt: { gte: recentCutoff } } } }
      ]
    },
    orderBy: { updatedAt: "asc" },
    take: 10,
    include: {
      downloadTokens: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        include: { downloadTokenAssets: true }
      },
      emailLogs: true
    }
  });
  const result = { scanned: orders.length, recovered: 0, failed: 0 };

  for (const orderRow of orders) {
    const orderId = recordString(orderRow, "id");
    const orderNumber = recordString(orderRow, "orderNumber");
    try {
      const token = await createFreshVaultTokenFromExistingVault({
        db: input.databaseModule.prisma,
        orderRow,
        now
      });
      const deliveryResult = await sendVaultReadyEmail({
        db: input.databaseModule.prisma as never,
        emailModule: input.emailModule as never,
        order_id: orderId,
        order_number: orderNumber,
        download_token_id: token.download_token_id,
        raw_token_for_email_only: token.raw_token_for_email_only,
        expires_at: token.expires_at,
        log: (entry) => inputLogRecoveryDelivery(entry, input.queueModule)
      });

      if (deliveryResult.status !== "sent") {
        await updateOrderDeliveryStatus({
          orchestrationRepository: input.orchestrationRepository,
          orderId,
          orderStatus: "processing",
          fulfillmentStatus: "failed",
          completedAt: null
        });
        throw new Error(`delivery_email_${deliveryResult.status}`);
      }

      result.recovered += 1;
      input.queueModule.writeWorkerLog({
        level: "info",
        message: "completed_order_missing_email_recovered",
        queue_name: input.queueModule.QUEUE_NAMES.paymentConfirmation,
        extra: {
          order_id: orderId,
          order_number: orderNumber,
          download_token_id: token.download_token_id,
          raw_token_omitted: true
        }
      });
    } catch (error) {
      result.failed += 1;
      input.queueModule.writeWorkerLog({
        level: "error",
        message: "completed_order_missing_email_recovery_failed",
        queue_name: input.queueModule.QUEUE_NAMES.paymentConfirmation,
        extra: {
          order_id: orderId,
          order_number: orderNumber,
          error_message:
            error instanceof Error ? error.message : "Unknown missing email recovery error",
          raw_token_omitted: true
        }
      });
    }
  }

  return result;
}

async function createFreshVaultTokenFromExistingVault(input: {
  db: DatabaseModule["prisma"];
  orderRow: unknown;
  now: Date;
}): Promise<{ download_token_id: string; raw_token_for_email_only: string; expires_at: Date }> {
  const orderId = recordString(input.orderRow, "id");
  const activeToken = firstRecord(recordValue(input.orderRow, "downloadTokens"));
  if (!activeToken) {
    throw new Error("vault_ready_token_missing");
  }
  const tokenAssets = recordArray(activeToken, "downloadTokenAssets");
  const assetIds = tokenAssets.map((link) => recordString(link, "assetId"));
  if (assetIds.length === 0) {
    throw new Error("vault_ready_assets_missing");
  }
  if (!input.db.downloadToken || !input.db.downloadTokenAsset) {
    throw new Error("download_token_delegate_missing");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const downloadTokenId = createWorkerId();
  const expiresAt = new Date(input.now.getTime() + 30 * 24 * 60 * 60_000);
  const created = await input.db.downloadToken.create({
    data: {
      id: downloadTokenId,
      orderId,
      tokenHash: sha256(rawToken),
      status: "active",
      expiresAt,
      maxDownloads: 20,
      downloadCount: 0,
      createdBy: "system",
      createdAt: input.now
    }
  });
  const createdId = recordString(created, "id");
  for (const assetId of assetIds) {
    await input.db.downloadTokenAsset.create({
      data: {
        id: createWorkerId(),
        downloadTokenId: createdId,
        assetId,
        createdAt: input.now
      }
    });
  }

  return {
    download_token_id: createdId,
    raw_token_for_email_only: rawToken,
    expires_at: expiresAt
  };
}

function inputLogDelivery(
  entry: {
    level: "info" | "warn" | "error";
    message: "EMAIL_JOB_CREATED" | "EMAIL_TRIGGERED" | "EMAIL_SKIPPED_REASON";
    extra?: Record<string, unknown>;
  },
  queueModule: QueueModule,
  outboxEvent: WorkerOutboxEvent
) {
  queueModule.writeWorkerLog({
    level: entry.level,
    message: entry.message,
    queue_name: queueModule.QUEUE_NAMES.paymentConfirmation,
    extra: {
      outbox_event_id: outboxEvent.id,
      ...entry.extra
    }
  });
}

function inputLogRecoveryDelivery(
  entry: {
    level: "info" | "warn" | "error";
    message: "EMAIL_JOB_CREATED" | "EMAIL_TRIGGERED" | "EMAIL_SKIPPED_REASON";
    extra?: Record<string, unknown>;
  },
  queueModule: QueueModule
) {
  queueModule.writeWorkerLog({
    level: entry.level,
    message: entry.message,
    queue_name: queueModule.QUEUE_NAMES.paymentConfirmation,
    extra: entry.extra
  });
}

async function updateOrderDeliveryStatus(input: {
  orchestrationRepository: unknown;
  orderId: string;
  orderStatus: string;
  fulfillmentStatus: string;
  completedAt: string | null;
}) {
  const repository = input.orchestrationRepository as {
    updateOrderStatus?(update: {
      order_id: string;
      order_status: string;
      fulfillment_status: string;
      completed_at: string | null;
    }): Promise<unknown>;
  };
  if (typeof repository.updateOrderStatus !== "function") {
    return;
  }
  await repository.updateOrderStatus({
    order_id: input.orderId,
    order_status: input.orderStatus,
    fulfillment_status: input.fulfillmentStatus,
    completed_at: input.completedAt
  });
}

function wrapPlaceholderProcessor(queueModule: QueueModule, queueName: string): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const envelope = {
      ...job.data,
      attempt: job.attemptsMade
    };
    const result = await queueModule.placeholderProcessor(envelope);

    queueModule.writeWorkerLog({
      level: "info",
      message: "placeholder_job_completed",
      envelope,
      queue_name: queueName,
      duration_ms: Date.now() - startedAt
    });

    return result;
  };
}

async function findOrCreateOrderPaidOutbox(
  db: DatabaseModule["prisma"],
  orderRow: unknown,
  now: Date
): Promise<WorkerOutboxEvent> {
  const orderId = recordString(orderRow, "id");
  const outboxDelegate = db.outboxEvent as OutboxRecoveryDelegate;
  const existing = await outboxDelegate.findFirst({
    where: { eventType: "order.paid", aggregateId: orderId },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    return mapOutboxRow(existing);
  }

  const orderItem = firstRecord(recordValue(orderRow, "orderItems"));
  if (!orderItem) {
    throw new Error("stuck_paid_order_missing_order_item");
  }
  const metadata = recordObject(orderRow, "metadataJson");
  const payload = {
    order_id: orderId,
    order_number: recordString(orderRow, "orderNumber"),
    order_item_id: recordString(orderItem, "id"),
    house_id: optionalString(metadata, "house_id"),
    identity_version_id: optionalString(metadata, "identity_version_id"),
    product_code: productCodeFromOrderItem(orderItem),
    package_code: packageCodeFromOrderItem(orderItem),
    amount_cents: Number(recordValue(orderRow, "totalCents") ?? 0),
    currency: recordString(orderRow, "currency"),
    paid_at: isoString(recordValue(orderRow, "paidAt")) ?? now.toISOString(),
    recovery_created: true
  };
  const created = await outboxDelegate.create({
    data: {
      id: createWorkerId(),
      eventType: "order.paid",
      aggregateType: "order",
      aggregateId: orderId,
      payloadJson: payload,
      status: "pending",
      attempts: 0,
      nextAttemptAt: null,
      createdAt: now,
      publishedAt: null
    }
  });
  return mapOutboxRow(created);
}

function mapOutboxRow(row: unknown): WorkerOutboxEvent {
  return {
    id: recordString(row, "id"),
    event_type: recordString(row, "eventType"),
    aggregate_type: recordString(row, "aggregateType"),
    aggregate_id: recordString(row, "aggregateId"),
    payload_json: recordObject(row, "payloadJson"),
    status: "processing",
    attempts: Number(recordValue(row, "attempts") ?? 0),
    created_at: isoString(recordValue(row, "createdAt")) ?? new Date().toISOString(),
    published_at: isoString(recordValue(row, "publishedAt"))
  };
}

function toOrchestrationOutboxEvent(payload: unknown, attempts: number): WorkerOutboxEvent {
  const payloadObject = toRecord(payload);
  return {
    id: requireStringField(payloadObject, "outbox_event_id"),
    event_type: requireStringField(payloadObject, "event_type"),
    aggregate_type: requireStringField(payloadObject, "aggregate_type"),
    aggregate_id: requireStringField(payloadObject, "aggregate_id"),
    payload_json: toRecord(payloadObject.event_payload),
    status: "processing",
    attempts,
    created_at: new Date().toISOString(),
    published_at: null
  };
}

function requireStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing_job_payload_field:${key}`);
  }
  return value;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function recordValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return undefined;
  }
  return (record as JsonRecord)[key];
}

function recordObject(record: unknown, key: string): JsonRecord {
  return toRecord(recordValue(record, key));
}

function recordString(record: unknown, key: string): string {
  const value = recordValue(record, key);
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(`missing_record_field:${key}`);
}

function optionalString(record: unknown, key: string): string | null {
  const value = recordValue(record, key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstRecord(value: unknown): JsonRecord | null {
  return Array.isArray(value) && value[0] && typeof value[0] === "object"
    ? (value[0] as JsonRecord)
    : null;
}

function recordArray(record: unknown, key: string): JsonRecord[] {
  const value = recordValue(record, key);
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function isoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" && value.length > 0 ? value : null;
}

function productCodeFromOrderItem(orderItem: JsonRecord): string | null {
  const snapshot = toRecord(orderItem.productSnapshotJson);
  return (
    optionalString(snapshot, "product_code") ??
    optionalString(recordObject(orderItem, "product"), "code")
  );
}

function packageCodeFromOrderItem(orderItem: JsonRecord): string | null {
  const snapshot = toRecord(orderItem.productSnapshotJson);
  return (
    optionalString(snapshot, "package_code") ??
    optionalString(recordObject(orderItem, "package"), "code")
  );
}

function createWorkerId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let id = "";
  for (const byte of randomBytes(26)) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function wrapAiImageProcessor(
  queueModule: QueueModule,
  aiModule: AiModule,
  aiDependencies: unknown
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await aiModule.handleAiImageGenerationJob(job.data.payload, aiDependencies);

    queueModule.writeWorkerLog({
      level: "info",
      message: "ai_image_generation_candidate_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.aiImageGeneration,
      duration_ms: Date.now() - startedAt
    });

    return result;
  };
}

function wrapAiTextProcessor(
  queueModule: QueueModule,
  aiModule: AiModule,
  aiDependencies: unknown
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await aiModule.handleAiTextGenerationJob(job.data.payload, aiDependencies);

    queueModule.writeWorkerLog({
      level: "info",
      message: "ai_text_generation_candidate_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.aiTextGeneration,
      duration_ms: Date.now() - startedAt
    });

    return result;
  };
}

function wrapImagePostprocessProcessor(
  queueModule: QueueModule,
  storageModule: StorageModule
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await storageModule.createTransparentPng(job.data.payload);
    queueModule.writeWorkerLog({
      level: "info",
      message: "transparent_png_candidate_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.imagePostprocess,
      duration_ms: Date.now() - startedAt
    });
    return result;
  };
}

function wrapPdfGenerationProcessor(queueModule: QueueModule, pdfModule: PdfModule): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await pdfModule.generateHeritagePdf({
      disclaimer: pdfModule.GLOBAL_PDF_DISCLAIMER,
      ...(job.data.payload as Record<string, unknown>)
    });
    queueModule.writeWorkerLog({
      level: "info",
      message: "pdf_candidate_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.pdfGeneration,
      duration_ms: Date.now() - startedAt
    });
    return result;
  };
}

function wrapZipPackagingProcessor(
  queueModule: QueueModule,
  storageModule: StorageModule
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await storageModule.generateZipPackage(job.data.payload);
    queueModule.writeWorkerLog({
      level: "info",
      message: "zip_candidate_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.zipPackaging,
      duration_ms: Date.now() - startedAt
    });
    return result;
  };
}

function wrapAssetStorageProcessor(
  queueModule: QueueModule,
  storageModule: StorageModule,
  dependencies: { storage: unknown; repository: unknown }
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await storageModule.storeCandidateAsAsset({
      ...(job.data.payload as Record<string, unknown>),
      storage: dependencies.storage,
      repository: dependencies.repository
    });
    queueModule.writeWorkerLog({
      level: "info",
      message: "private_asset_stored",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.assetStorage,
      duration_ms: Date.now() - startedAt
    });
    return result;
  };
}

function wrapCreateDownloadTokenProcessor(
  queueModule: QueueModule,
  storageModule: StorageModule,
  dependencies: { downloadRepository: unknown }
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await storageModule.createDownloadTokenJob(job.data.payload, {
      downloadRepository: dependencies.downloadRepository
    });
    queueModule.writeWorkerLog({
      level: "info",
      message: "download_token_created",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.downloadToken,
      duration_ms: Date.now() - startedAt,
      extra: {
        raw_token_omitted: true
      }
    });
    return result;
  };
}

function wrapSendDeliveryEmailProcessor(
  queueModule: QueueModule,
  emailModule: EmailModule,
  dependencies: { provider: unknown; emailLogRepository: unknown }
): Processor {
  return async (job: RuntimeJob) => {
    const startedAt = Date.now();
    const result = await emailModule.sendDeliveryEmailJob(job.data.payload, dependencies);
    queueModule.writeWorkerLog({
      level: "info",
      message: "delivery_email_processed",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.emailDelivery,
      duration_ms: Date.now() - startedAt
    });
    return result;
  };
}

function attachRuntimeErrorLog(
  queueModule: QueueModule,
  runtime: QueueHandle | WorkerHandle,
  queueName: string
): void {
  runtime.on?.("error", (error) => {
    const errorMessage = error instanceof Error ? error.message : "Unknown queue runtime error";

    queueModule.writeWorkerLog({
      level: "warn",
      message: "queue_runtime_error",
      queue_name: queueName,
      extra: {
        error_message: errorMessage
      }
    });
  });
}

function requireQueue(): QueueModule {
  return requireWorkspacePackage("@ai-heritage/queue") as QueueModule;
}

function requireDatabase(): DatabaseModule {
  return requireWorkspacePackage("@ai-heritage/database") as DatabaseModule;
}

function requireAi(): AiModule {
  const aiModule = requireWorkspacePackage("@ai-heritage/ai") as Partial<AiModule>;
  if (typeof aiModule.handleAiImageGenerationJob === "function") {
    return aiModule as AiModule;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../../../packages/ai/src") as AiModule;
}

function requireStorage(): StorageModule {
  return requireWorkspacePackage("@ai-heritage/storage") as StorageModule;
}

function requirePdf(): PdfModule {
  return requireWorkspacePackage("@ai-heritage/pdf") as PdfModule;
}

function requireEmail(): EmailModule {
  return requireWorkspacePackage("@ai-heritage/email") as EmailModule;
}

function requireWorkspacePackage(packageName: string): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(packageName);
  } catch (error) {
    if (packageName === "@ai-heritage/queue") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/queue/src");
    }

    if (packageName === "@ai-heritage/database") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/database/src");
    }

    if (packageName === "@ai-heritage/ai") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/ai/src");
    }

    if (packageName === "@ai-heritage/storage") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/storage/src");
    }

    if (packageName === "@ai-heritage/pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/pdf/src");
    }

    if (packageName === "@ai-heritage/email") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../../../packages/email/src");
    }

    throw error;
  }
}

function requireObservability(): {
  createSchedulerFoundation(env?: NodeJS.ProcessEnv): SchedulerFoundation;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@ai-heritage/observability") as {
      createSchedulerFoundation(env?: NodeJS.ProcessEnv): SchedulerFoundation;
    };
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../packages/observability/src") as {
      createSchedulerFoundation(env?: NodeJS.ProcessEnv): SchedulerFoundation;
    };
  }
}
