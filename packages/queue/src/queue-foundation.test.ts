import { describe, expect, it } from "vitest";

import {
  ALL_QUEUE_NAMES,
  QUEUE_NAMES,
  buildJobEnvelope,
  buildWorkerLog,
  enqueueJob,
  handleFailureWithDeadLetter,
  moveToDeadLetter,
  placeholderProcessor,
  type JobEnvelope,
  type QueueLike
} from "./index";

class MockQueue implements QueueLike {
  public readonly added: Array<{ name: string; data: JobEnvelope; options: unknown }> = [];

  async add(name: string, data: JobEnvelope, options?: unknown) {
    this.added.push({ name, data, options });
    return { id: data.idempotency_key, name };
  }
}

describe("queue foundation", () => {
  it("defines all Worker Pipeline v1 queue names", () => {
    expect(ALL_QUEUE_NAMES).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it("buildJobEnvelope creates a complete envelope", () => {
    const envelope = buildJobEnvelope({
      job_name: "payment_confirmed_placeholder",
      queue_name: QUEUE_NAMES.paymentConfirmation,
      order_id: "order_1",
      order_number: "A100",
      payload: { ok: true }
    });

    expect(envelope).toMatchObject({
      job_name: "payment_confirmed_placeholder",
      queue_name: QUEUE_NAMES.paymentConfirmation,
      order_id: "order_1",
      order_number: "A100",
      manifest_id: null,
      identity_version_id: null,
      attempt: 0,
      max_attempts: 3,
      payload: { ok: true }
    });
    expect(envelope.job_id).toEqual(expect.any(String));
    expect(envelope.correlation_id).toEqual(expect.any(String));
    expect(envelope.idempotency_key).toEqual(expect.any(String));
    expect(new Date(envelope.created_at).toString()).not.toBe("Invalid Date");
  });

  it("enqueueJob uses idempotency_key as BullMQ job id", async () => {
    const queue = new MockQueue();
    const envelope = buildJobEnvelope({
      job_name: "payment_confirmed_placeholder",
      queue_name: QUEUE_NAMES.paymentConfirmation,
      idempotency_key: "idem-1"
    });

    await enqueueJob(queue, envelope);

    expect(queue.added[0]?.options).toMatchObject({
      jobId: "idem-1"
    });
  });

  it("placeholder processor validates envelope and returns success", async () => {
    const envelope = buildJobEnvelope({
      job_name: "generation_placeholder",
      queue_name: QUEUE_NAMES.generation
    });

    await expect(placeholderProcessor(envelope)).resolves.toEqual({
      success: true,
      placeholder: true,
      queue_name: QUEUE_NAMES.generation,
      job_name: "generation_placeholder"
    });
  });

  it("moves exhausted jobs to dead-letter", async () => {
    const queue = new MockQueue();
    const envelope = buildJobEnvelope({
      job_name: "generation_placeholder",
      queue_name: QUEUE_NAMES.generation,
      attempt: 2,
      max_attempts: 3,
      idempotency_key: "job-1"
    });

    await expect(handleFailureWithDeadLetter(queue, envelope, new Error("boom"))).resolves.toBe(
      "dead-lettered"
    );

    expect(queue.added).toHaveLength(1);
    expect(queue.added[0]?.data.queue_name).toBe(QUEUE_NAMES.deadLetter);
    expect(queue.added[0]?.data.payload).toMatchObject({
      original_queue: QUEUE_NAMES.generation,
      original_job_name: "generation_placeholder",
      error_message: "boom"
    });
  });

  it("moveToDeadLetter preserves original queue and error message", async () => {
    const queue = new MockQueue();
    const envelope = buildJobEnvelope({
      job_name: "pdf_placeholder",
      queue_name: QUEUE_NAMES.pdfGeneration,
      idempotency_key: "pdf-1"
    });

    await moveToDeadLetter(queue, envelope, new Error("pdf failed"));

    expect(queue.added[0]?.data.payload).toMatchObject({
      original_queue: QUEUE_NAMES.pdfGeneration,
      error_message: "pdf failed"
    });
  });

  it("structured logs exclude PII fields", () => {
    const log = buildWorkerLog({
      level: "info",
      message: "job_received",
      extra: {
        customer_email: "person@example.com",
        prompt: "secret prompt",
        safe_field: "kept"
      }
    });

    expect(JSON.stringify(log)).not.toContain("person@example.com");
    expect(JSON.stringify(log)).not.toContain("secret prompt");
    expect(log).toMatchObject({
      extra: {
        safe_field: "kept"
      }
    });
  });
});
