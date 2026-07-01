import { buildJobEnvelope } from "./envelope";
import { enqueueJob } from "./bullmq";
import { QUEUE_NAMES } from "./queue-names";
import type { QueueLike } from "./types";

export type OutboxStatus = "pending" | "processing" | "published" | "failed";

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: unknown;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  createdAt: Date;
  publishedAt: Date | null;
}

interface OutboxFindManyArgs {
  where: Record<string, unknown>;
  orderBy: Record<string, string>;
  take: number;
}

interface OutboxUpdateManyArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface OutboxUpdateArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

export interface OutboxRepository {
  findMany(args: OutboxFindManyArgs): Promise<OutboxEventRecord[]>;
  updateMany(args: OutboxUpdateManyArgs): Promise<{ count: number }>;
  update(args: OutboxUpdateArgs): Promise<OutboxEventRecord>;
}

export interface OutboxDispatcherOptions {
  outbox: OutboxRepository;
  queues: {
    paymentConfirmation: QueueLike;
  };
  now?: () => Date;
  batchSize?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export interface OutboxDispatchResult {
  scanned: number;
  published: number;
  failed: number;
  skipped: number;
}

export class OutboxDispatcher {
  private readonly now: () => Date;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: OutboxDispatcherOptions) {
    this.now = options.now ?? (() => new Date());
    this.batchSize = options.batchSize ?? 25;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 30_000;
  }

  async dispatchOnce(): Promise<OutboxDispatchResult> {
    const now = this.now();
    const events = await this.options.outbox.findMany({
      where: {
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
      },
      orderBy: { createdAt: "asc" },
      take: this.batchSize
    });
    const result: OutboxDispatchResult = {
      scanned: events.length,
      published: 0,
      failed: 0,
      skipped: 0
    };

    for (const event of events) {
      const eventResult = await this.dispatchEvent(event);
      result[eventResult] += 1;
    }

    return result;
  }

  async dispatchEvent(event: OutboxEventRecord): Promise<"published" | "failed" | "skipped"> {
    if (event.status !== "pending") {
      return "skipped";
    }

    const locked = await this.options.outbox.updateMany({
      where: { id: event.id, status: "pending" },
      data: { status: "processing" }
    });

    if (locked.count !== 1) {
      return "skipped";
    }

    try {
      if (event.eventType === "order.paid") {
        await this.enqueueOrderPaidPlaceholder(event);
      }

      await this.options.outbox.update({
        where: { id: event.id },
        data: {
          status: "published",
          publishedAt: this.now(),
          nextAttemptAt: null
        }
      });

      return "published";
    } catch (error) {
      await this.markFailed(event, error);
      return "failed";
    }
  }

  private async enqueueOrderPaidPlaceholder(event: OutboxEventRecord): Promise<void> {
    const payload = toPayloadObject(event.payloadJson);
    const envelope = buildJobEnvelope({
      job_name: "payment_confirmed_placeholder",
      queue_name: QUEUE_NAMES.paymentConfirmation,
      correlation_id: getString(payload.correlation_id) ?? `outbox:${event.id}`,
      order_id: getString(payload.order_id) ?? event.aggregateId,
      order_number: getString(payload.order_number),
      idempotency_key: `outbox:${event.id}`,
      payload: {
        outbox_event_id: event.id,
        event_type: event.eventType,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_payload: payload
      }
    });

    await enqueueJob(this.options.queues.paymentConfirmation, envelope);
  }

  private async markFailed(event: OutboxEventRecord, error: unknown): Promise<void> {
    const nextAttempts = event.attempts + 1;
    const permanentlyFailed = nextAttempts >= this.maxAttempts;
    const nextAttemptAt = permanentlyFailed ? null : new Date(this.now().getTime() + this.retryDelayMs);

    await this.options.outbox.update({
      where: { id: event.id },
      data: {
        status: permanentlyFailed ? "failed" : "pending",
        attempts: { increment: 1 },
        nextAttemptAt,
        payloadJson: appendDispatchError(event.payloadJson, error)
      }
    });
  }
}

function toPayloadObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function appendDispatchError(payload: unknown, error: unknown): Record<string, unknown> {
  const payloadObject = toPayloadObject(payload);
  const errorMessage = error instanceof Error ? error.message : "Unknown outbox dispatch error";

  return {
    ...payloadObject,
    last_dispatch_error: errorMessage
  };
}
