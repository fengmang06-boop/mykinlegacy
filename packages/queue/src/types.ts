import type { JobsOptions } from "bullmq";

import type { QueueName } from "./queue-names";

export type BackoffType = "fixed" | "exponential";

export interface RetryPolicy {
  attempts: number;
  backoff_type: BackoffType;
  backoff_delay_ms: number;
  timeout_ms: number;
}

export interface QueueConfig {
  queue_name: QueueName;
  purpose: string;
  default_concurrency: number;
  default_retry_policy: RetryPolicy;
  timeout_ms: number;
  dead_letter_enabled: boolean;
}

export interface JobEnvelope<TPayload = Record<string, unknown>> {
  job_id: string;
  job_name: string;
  queue_name: QueueName;
  correlation_id: string;
  order_id: string | null;
  order_number: string | null;
  manifest_id: string | null;
  identity_version_id: string | null;
  attempt: number;
  max_attempts: number;
  idempotency_key: string;
  created_at: string;
  payload: TPayload;
}

export interface BuildJobEnvelopeInput<TPayload = Record<string, unknown>> {
  job_id?: string;
  job_name: string;
  queue_name: QueueName;
  correlation_id?: string;
  order_id?: string | null;
  order_number?: string | null;
  manifest_id?: string | null;
  identity_version_id?: string | null;
  attempt?: number;
  max_attempts?: number;
  idempotency_key?: string;
  created_at?: string;
  payload?: TPayload;
}

export interface QueueAddResult {
  id?: string;
  name?: string;
}

export interface QueueLike {
  add(name: string, data: JobEnvelope, options?: JobsOptions): Promise<QueueAddResult>;
}

export interface WorkerLike {
  close(): Promise<void>;
}

export interface NormalizedJobError {
  error_code: string;
  error_message: string;
  stack?: string;
}

export interface DeadLetterPayload {
  [key: string]: unknown;
  original_queue: QueueName;
  original_job_name: string;
  original_envelope: JobEnvelope;
  error_code: string;
  error_message: string;
  failed_at: string;
}

export interface PlaceholderProcessorResult {
  success: true;
  placeholder: true;
  queue_name: QueueName;
  job_name: string;
}
