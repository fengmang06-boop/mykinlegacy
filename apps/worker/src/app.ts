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
type RecoverySnapshot = Record<string, unknown>;
type RecoveryIssue = Record<string, unknown>;

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

interface DatabaseModule {
  prisma: {
    outboxEvent: unknown;
    orderCustomerPii: unknown;
    emailLog: unknown;
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
        outboxInterval = setInterval(() => {
          void outboxDispatcher.dispatchOnce();
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
    const manifestResult = await databaseModule.processOrderPaidOutbox({
      outboxEvent,
      repository: orchestrationRepository,
      now: new Date()
    });
    const generationResult = await databaseModule.runManifestDrivenGeneration({
      manifest_id: manifestResult.manifest.id,
      repository: orchestrationRepository,
      now: new Date()
    });
    const deliveryResult = await sendVaultReadyEmail({
      db: databaseModule.prisma as never,
      emailModule: emailModule as never,
      order_id: requireStringField(outboxEvent.payload_json, "order_id"),
      order_number: job.data.order_number ?? requireStringField(outboxEvent.payload_json, "order_number"),
      download_token_id: generationResult.download_token_id,
      raw_token_for_email_only: generationResult.raw_token_for_email_only,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000)
    });

    queueModule.writeWorkerLog({
      level: "info",
      message: "paid_order_placeholder_collection_ready",
      envelope: job.data,
      queue_name: queueModule.QUEUE_NAMES.paymentConfirmation,
      duration_ms: Date.now() - startedAt,
      extra: {
        manifest_id: manifestResult.manifest.id,
        generation_job_id: manifestResult.generation_job_id,
        created: manifestResult.created,
        download_token_id: generationResult.download_token_id,
        email_delivery_status: deliveryResult.status,
        email_recipient_source: deliveryResult.recipient_source,
        raw_token_omitted: true
      }
    });

    return {
      manifest_id: manifestResult.manifest.id,
      generation_job_id: manifestResult.generation_job_id,
      download_token_id: generationResult.download_token_id,
      email_delivery_status: deliveryResult.status,
      raw_token_omitted: true
    };
  };
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

function toOrchestrationOutboxEvent(payload: unknown, attempts: number) {
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
