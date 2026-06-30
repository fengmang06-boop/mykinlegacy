import { assertJobEnvelope } from "./envelope";
import { buildWorkerLog } from "./logging";
import type { JobEnvelope, PlaceholderProcessorResult } from "./types";

export async function placeholderProcessor(envelope: JobEnvelope): Promise<PlaceholderProcessorResult> {
  const startedAt = Date.now();

  assertJobEnvelope(envelope);
  buildWorkerLog({
    level: "info",
    message: "placeholder_job_received",
    envelope,
    duration_ms: Date.now() - startedAt
  });

  return {
    success: true,
    placeholder: true,
    queue_name: envelope.queue_name,
    job_name: envelope.job_name
  };
}

export const cleanupPlaceholderJobs = [
  "cleanup_temp_files_job",
  "cleanup_old_idempotency_keys",
  "cleanup_expired_interviews"
] as const;
