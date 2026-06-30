export interface WorkerRuntimeConfig {
  redisUrl: string;
  concurrency: number;
  pollIntervalMs: number;
  enableOutboxDispatcher: boolean;
  environment: string;
  recoveryScanEnabled: boolean;
  recoveryScanIntervalMs: number;
  cleanupDestructiveEnabled: boolean;
  stuckOrderThresholdMinutes: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig {
  return {
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    concurrency: parsePositiveInt(env.WORKER_CONCURRENCY, 2),
    pollIntervalMs: parsePositiveInt(env.WORKER_POLL_INTERVAL_MS, 5_000),
    enableOutboxDispatcher: (env.WORKER_ENABLE_OUTBOX_DISPATCHER ?? "true") === "true",
    environment: env.NODE_ENV ?? env.APP_ENV ?? "local",
    recoveryScanEnabled: (env.RECOVERY_SCAN_ENABLED ?? "true") === "true",
    recoveryScanIntervalMs: parsePositiveInt(env.RECOVERY_SCAN_INTERVAL_MS, 300_000),
    cleanupDestructiveEnabled: (env.CLEANUP_DESTRUCTIVE_ENABLED ?? "false") === "true",
    stuckOrderThresholdMinutes: parsePositiveInt(env.STUCK_ORDER_THRESHOLD_MINUTES, 30)
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
