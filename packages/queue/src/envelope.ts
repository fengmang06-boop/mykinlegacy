import { randomUUID } from "node:crypto";

import { QUEUE_CONFIGS } from "./config";
import type { BuildJobEnvelopeInput, JobEnvelope } from "./types";

export function buildJobEnvelope<TPayload = Record<string, unknown>>(
  input: BuildJobEnvelopeInput<TPayload>
): JobEnvelope<TPayload> {
  const jobId = input.job_id ?? randomUUID();
  const correlationId = input.correlation_id ?? randomUUID();

  return {
    job_id: jobId,
    job_name: input.job_name,
    queue_name: input.queue_name,
    correlation_id: correlationId,
    order_id: input.order_id ?? null,
    order_number: input.order_number ?? null,
    manifest_id: input.manifest_id ?? null,
    identity_version_id: input.identity_version_id ?? null,
    attempt: input.attempt ?? 0,
    max_attempts: input.max_attempts ?? QUEUE_CONFIGS[input.queue_name].default_retry_policy.attempts,
    idempotency_key: input.idempotency_key ?? `${input.queue_name}:${input.job_name}:${jobId}`,
    created_at: input.created_at ?? new Date().toISOString(),
    payload: input.payload ?? ({} as TPayload)
  };
}

export function isJobEnvelope(value: unknown): value is JobEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<JobEnvelope>;

  return (
    typeof candidate.job_id === "string" &&
    typeof candidate.job_name === "string" &&
    typeof candidate.queue_name === "string" &&
    typeof candidate.correlation_id === "string" &&
    typeof candidate.attempt === "number" &&
    typeof candidate.max_attempts === "number" &&
    typeof candidate.idempotency_key === "string" &&
    typeof candidate.created_at === "string" &&
    typeof candidate.payload === "object"
  );
}

export function assertJobEnvelope(value: unknown): asserts value is JobEnvelope {
  if (!isJobEnvelope(value)) {
    throw new Error("invalid_job_envelope");
  }
}
