import { describe, expect, it } from "vitest";

import { OutboxDispatcher, QUEUE_NAMES, type JobEnvelope, type OutboxEventRecord, type QueueLike } from "./index";

class MockQueue implements QueueLike {
  public shouldFail = false;
  public readonly added: Array<{ name: string; data: JobEnvelope; options: unknown }> = [];

  async add(name: string, data: JobEnvelope, options?: unknown) {
    if (this.shouldFail) {
      throw new Error("queue unavailable");
    }

    this.added.push({ name, data, options });
    return { id: data.idempotency_key, name };
  }
}

class MockOutbox {
  public readonly events: OutboxEventRecord[];

  constructor(events: OutboxEventRecord[]) {
    this.events = events;
  }

  async findMany() {
    return this.events.filter((event) => event.status === "pending");
  }

  async updateMany(args: { where: { id: string; status?: string }; data: Partial<OutboxEventRecord> }) {
    const event = this.events.find(
      (candidate) =>
        candidate.id === args.where.id &&
        (!args.where.status || candidate.status === args.where.status)
    );

    if (!event) {
      return { count: 0 };
    }

    Object.assign(event, args.data);
    return { count: 1 };
  }

  async update(args: { where: { id: string }; data: Record<string, unknown> }) {
    const event = this.events.find((candidate) => candidate.id === args.where.id);

    if (!event) {
      throw new Error("event_not_found");
    }

    applyUpdate(event, args.data);
    return event;
  }
}

describe("outbox dispatcher", () => {
  it("enqueues order.paid pending event as payment-confirmation placeholder job", async () => {
    const event = createOutboxEvent("evt_1", "order.paid");
    const queue = new MockQueue();
    const outbox = new MockOutbox([event]);
    const dispatcher = new OutboxDispatcher({
      outbox,
      queues: { paymentConfirmation: queue },
      now: fixedNow
    });

    await expect(dispatcher.dispatchOnce()).resolves.toEqual({
      scanned: 1,
      published: 1,
      failed: 0,
      skipped: 0
    });

    expect(queue.added).toHaveLength(1);
    expect(queue.added[0]?.data).toMatchObject({
      queue_name: QUEUE_NAMES.paymentConfirmation,
      job_name: "payment_confirmed_placeholder",
      order_id: "order_1",
      order_number: "A100",
      idempotency_key: "outbox:evt_1"
    });
    expect(event.status).toBe("published");
    expect(event.publishedAt?.toISOString()).toBe(fixedNow().toISOString());
  });

  it("does not process already published events", async () => {
    const event = {
      ...createOutboxEvent("evt_2", "order.paid"),
      status: "published" as const
    };
    const queue = new MockQueue();
    const dispatcher = new OutboxDispatcher({
      outbox: new MockOutbox([event]),
      queues: { paymentConfirmation: queue }
    });

    await expect(dispatcher.dispatchEvent(event)).resolves.toBe("skipped");
    expect(queue.added).toHaveLength(0);
  });

  it("increments attempts and schedules retry when enqueue fails", async () => {
    const event = createOutboxEvent("evt_3", "order.paid");
    const queue = new MockQueue();
    queue.shouldFail = true;
    const dispatcher = new OutboxDispatcher({
      outbox: new MockOutbox([event]),
      queues: { paymentConfirmation: queue },
      now: fixedNow,
      retryDelayMs: 10_000
    });

    await expect(dispatcher.dispatchOnce()).resolves.toMatchObject({
      failed: 1
    });

    expect(event.status).toBe("pending");
    expect(event.attempts).toBe(1);
    expect(event.nextAttemptAt?.toISOString()).toBe("2026-06-29T00:00:10.000Z");
  });
});

function createOutboxEvent(id: string, eventType: string): OutboxEventRecord {
  return {
    id,
    eventType,
    aggregateType: "order",
    aggregateId: "order_1",
    payloadJson: {
      correlation_id: "corr_1",
      order_id: "order_1",
      order_number: "A100"
    },
    status: "pending",
    attempts: 0,
    nextAttemptAt: null,
    createdAt: fixedNow(),
    publishedAt: null
  };
}

function fixedNow() {
  return new Date("2026-06-29T00:00:00.000Z");
}

function applyUpdate(event: OutboxEventRecord, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (key === "attempts" && isIncrement(value)) {
      event.attempts += value.increment;
      continue;
    }

    (event as unknown as Record<string, unknown>)[key] = value;
  }
}

function isIncrement(value: unknown): value is { increment: number } {
  return (
    value !== null &&
    typeof value === "object" &&
    "increment" in value &&
    typeof (value as { increment: unknown }).increment === "number"
  );
}
