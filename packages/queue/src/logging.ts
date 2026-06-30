import type { JobEnvelope, NormalizedJobError } from "./types";

export type WorkerLogLevel = "debug" | "info" | "warn" | "error";

export interface WorkerLogInput {
  level: WorkerLogLevel;
  message: string;
  envelope?: JobEnvelope | null;
  queue_name?: string | null;
  job_id?: string | null;
  job_name?: string | null;
  correlation_id?: string | null;
  order_id?: string | null;
  manifest_id?: string | null;
  attempt?: number | null;
  duration_ms?: number | null;
  error?: NormalizedJobError | null;
  extra?: Record<string, unknown>;
}

const PII_KEYS = new Set([
  "customer_email",
  "email",
  "phone",
  "full_name",
  "first_name",
  "last_name",
  "address",
  "house_dna",
  "prompt",
  "normalized_input"
]);

function sanitizeExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!extra) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(extra).filter(([key]) => !PII_KEYS.has(key.toLowerCase()))
  );
}

export function buildWorkerLog(input: WorkerLogInput): Record<string, unknown> {
  const envelope = input.envelope;
  const extra = sanitizeExtra(input.extra);

  return {
    timestamp: new Date().toISOString(),
    level: input.level,
    message: input.message,
    queue_name: input.queue_name ?? envelope?.queue_name ?? null,
    job_id: input.job_id ?? envelope?.job_id ?? null,
    job_name: input.job_name ?? envelope?.job_name ?? null,
    correlation_id: input.correlation_id ?? envelope?.correlation_id ?? null,
    order_id: input.order_id ?? envelope?.order_id ?? null,
    manifest_id: input.manifest_id ?? envelope?.manifest_id ?? null,
    attempt: input.attempt ?? envelope?.attempt ?? null,
    duration_ms: input.duration_ms ?? null,
    error_code: input.error?.error_code ?? null,
    ...(extra ? { extra } : {})
  };
}

export function writeWorkerLog(input: WorkerLogInput): void {
  const log = buildWorkerLog(input);
  const line = JSON.stringify(log);

  if (input.level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}
