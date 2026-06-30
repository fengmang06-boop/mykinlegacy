import { ALL_QUEUE_NAMES, QUEUE_NAMES, type QueueName } from "./queue-names";
import type { QueueConfig, RetryPolicy } from "./types";

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  backoff_type: "exponential",
  backoff_delay_ms: 5_000,
  timeout_ms: 120_000
};

const QUEUE_PURPOSES: Record<QueueName, string> = {
  [QUEUE_NAMES.paymentConfirmation]: "Placeholder queue for post-payment orchestration handoff.",
  [QUEUE_NAMES.generationManifest]: "Future GenerationManifest creation queue.",
  [QUEUE_NAMES.generation]: "Future end-to-end generation orchestration queue.",
  [QUEUE_NAMES.promptRendering]: "Future prompt rendering queue.",
  [QUEUE_NAMES.aiImageGeneration]: "Future AI image generation queue.",
  [QUEUE_NAMES.aiTextGeneration]: "Future AI text generation queue.",
  [QUEUE_NAMES.aiOutputValidation]: "Future AI output validation queue.",
  [QUEUE_NAMES.imagePostprocess]: "Future image post-processing queue.",
  [QUEUE_NAMES.pdfGeneration]: "Future PDF generation queue.",
  [QUEUE_NAMES.zipPackaging]: "Future ZIP package queue.",
  [QUEUE_NAMES.assetStorage]: "Future private asset storage queue.",
  [QUEUE_NAMES.downloadToken]: "Future download token provisioning queue.",
  [QUEUE_NAMES.emailDelivery]: "Future transactional email delivery queue.",
  [QUEUE_NAMES.cleanup]: "Placeholder cleanup queue.",
  [QUEUE_NAMES.deadLetter]: "Dead-letter queue for exhausted failed jobs."
};

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = Object.fromEntries(
  ALL_QUEUE_NAMES.map((queueName) => [
    queueName,
    {
      queue_name: queueName,
      purpose: QUEUE_PURPOSES[queueName],
      default_concurrency: queueName === QUEUE_NAMES.deadLetter ? 1 : 2,
      default_retry_policy: {
        ...DEFAULT_RETRY_POLICY,
        attempts: queueName === QUEUE_NAMES.deadLetter ? 1 : DEFAULT_RETRY_POLICY.attempts
      },
      timeout_ms: DEFAULT_RETRY_POLICY.timeout_ms,
      dead_letter_enabled: queueName !== QUEUE_NAMES.deadLetter
    }
  ])
) as Record<QueueName, QueueConfig>;
