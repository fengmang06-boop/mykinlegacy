import { Queue, Worker, type ConnectionOptions, type JobsOptions, type Processor } from "bullmq";
import IORedis from "ioredis";

import { QUEUE_CONFIGS } from "./config";
import { QUEUE_NAMES, type QueueName } from "./queue-names";
import type { DeadLetterPayload, JobEnvelope, NormalizedJobError, QueueLike } from "./types";
import { buildJobEnvelope } from "./envelope";

export interface RedisConnectionInput {
  redisUrl: string;
}

export function createRedisConnection(input: RedisConnectionInput): IORedis {
  const redis = new IORedis(input.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  redis.on("error", () => undefined);

  return redis;
}

export function createQueue(queueName: QueueName, connection: ConnectionOptions): Queue<JobEnvelope> {
  return new Queue<JobEnvelope>(queueName, {
    connection,
    defaultJobOptions: toBullJobOptions(queueName)
  });
}

export function createWorker(
  queueName: QueueName,
  connection: ConnectionOptions,
  processor: Processor<JobEnvelope>,
  concurrency = QUEUE_CONFIGS[queueName].default_concurrency
): Worker<JobEnvelope> {
  return new Worker<JobEnvelope>(queueName, processor, {
    connection,
    concurrency
  });
}

export async function enqueueJob(
  queue: QueueLike,
  envelope: JobEnvelope,
  options: JobsOptions = {}
): Promise<unknown> {
  const queueConfig = QUEUE_CONFIGS[envelope.queue_name];

  return queue.add(envelope.job_name, envelope, {
    jobId: envelope.idempotency_key,
    attempts: queueConfig.default_retry_policy.attempts,
    backoff: {
      type: queueConfig.default_retry_policy.backoff_type,
      delay: queueConfig.default_retry_policy.backoff_delay_ms
    },
    removeOnComplete: true,
    ...options
  });
}

export function normalizeJobError(error: unknown): NormalizedJobError {
  if (error instanceof Error) {
    return {
      error_code: error.name || "job_error",
      error_message: error.message,
      stack: error.stack
    };
  }

  return {
    error_code: "job_error",
    error_message: typeof error === "string" ? error : "Unknown job error"
  };
}

export async function moveToDeadLetter(
  deadLetterQueue: QueueLike,
  envelope: JobEnvelope,
  error: unknown,
  failedAt = new Date()
): Promise<unknown> {
  const normalizedError = normalizeJobError(error);
  const payload: DeadLetterPayload = {
    original_queue: envelope.queue_name,
    original_job_name: envelope.job_name,
    original_envelope: envelope,
    error_code: normalizedError.error_code,
    error_message: normalizedError.error_message,
    failed_at: failedAt.toISOString()
  };
  const deadLetterEnvelope = buildJobEnvelope<DeadLetterPayload>({
    job_name: "dead_letter_recorded",
    queue_name: QUEUE_NAMES.deadLetter,
    correlation_id: envelope.correlation_id,
    order_id: envelope.order_id,
    order_number: envelope.order_number,
    manifest_id: envelope.manifest_id,
    identity_version_id: envelope.identity_version_id,
    max_attempts: 1,
    idempotency_key: `dead-letter:${envelope.idempotency_key}`,
    payload
  });

  return enqueueJob(deadLetterQueue, deadLetterEnvelope, {
    attempts: 1,
    removeOnComplete: false
  });
}

export async function handleFailureWithDeadLetter(
  deadLetterQueue: QueueLike,
  envelope: JobEnvelope,
  error: unknown
): Promise<"retry" | "dead-lettered"> {
  const nextAttempt = envelope.attempt + 1;

  if (nextAttempt >= envelope.max_attempts) {
    await moveToDeadLetter(deadLetterQueue, { ...envelope, attempt: nextAttempt }, error);
    return "dead-lettered";
  }

  return "retry";
}

function toBullJobOptions(queueName: QueueName): JobsOptions {
  const queueConfig = QUEUE_CONFIGS[queueName];

  return {
    attempts: queueConfig.default_retry_policy.attempts,
    backoff: {
      type: queueConfig.default_retry_policy.backoff_type,
      delay: queueConfig.default_retry_policy.backoff_delay_ms
    }
  };
}
