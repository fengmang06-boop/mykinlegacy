import { describe, expect, it } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { StripeWebhookService } from "./stripe-webhook.service";
import type { StripeAdapter } from "./stripe.adapter";

describe("StripeWebhookService", () => {
  it("rejects invalid signature", async () => {
    const service = new StripeWebhookService(createWebhookPrismaMock(), {
      constructWebhookEvent: () => {
        throw new Error("invalid");
      }
    } as unknown as StripeAdapter);

    await expect(service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "bad" })).rejects.toMatchObject({
      errorCode: "payment_webhook_invalid"
    });
  });

  it("marks order paid when checkout amount matches", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 4900 }));

    const result = await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(result.processed).toBe(true);
    expect(prisma.state.order.paymentStatus).toBe("paid");
    expect(prisma.state.order.orderStatus).toBe("paid");
    expect(prisma.state.paymentTransactions).toHaveLength(1);
    expect(prisma.state.outboxEvents).toHaveLength(1);
  });

  it("does not mark paid when amount mismatches", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 1 }));

    const result = await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(result.processed).toBe(false);
    expect(prisma.state.order.paymentStatus).toBe("unpaid");
  });

  it("does not mark paid when currency mismatches", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 4900, currency: "eur" }));

    const result = await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(result.processed).toBe(false);
    expect(prisma.state.order.paymentStatus).toBe("unpaid");
  });

  it("does not duplicate transaction or outbox for duplicate webhook", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 4900, id: "evt_dup" }));

    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });
    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(prisma.state.paymentTransactions).toHaveLength(1);
    expect(prisma.state.outboxEvents).toHaveLength(1);
  });

  it("payment_intent.succeeded does not repeat paid status", async () => {
    const prisma = createWebhookPrismaMock();
    prisma.state.order.paymentStatus = "paid";
    prisma.state.order.orderStatus = "paid";
    const service = createWebhookService(prisma, paymentIntentSucceededEvent());

    const result = await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(result.processed).toBe(true);
    expect(prisma.state.statusHistory).toHaveLength(0);
  });

  it("charge.refunded updates payment_status refunded", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, chargeRefundedEvent());

    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(prisma.state.order.paymentStatus).toBe("refunded");
  });

  it("charge.dispute.created updates payment_status disputed", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, chargeDisputeEvent());

    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(prisma.state.order.paymentStatus).toBe("disputed");
  });

  it("does not create GenerationManifest or send email", async () => {
    const prisma = createWebhookPrismaMock();
    const service = createWebhookService(prisma, checkoutEvent({ amountTotal: 4900 }));

    await service.handleWebhook({ rawBody: Buffer.from("{}"), signature: "valid" });

    expect(prisma.state.generationManifestCreated).toBe(false);
    expect(prisma.state.emailSent).toBe(false);
  });
});

function createWebhookService(prisma: ReturnType<typeof createWebhookPrismaMock>, event: unknown) {
  return new StripeWebhookService(prisma, {
    constructWebhookEvent: () => event
  } as unknown as StripeAdapter);
}

function checkoutEvent(input: { amountTotal: number; id?: string; currency?: string }) {
  return {
    id: input.id ?? "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        amount_total: input.amountTotal,
        currency: input.currency ?? "usd",
        url: "https://checkout.stripe.test/session",
        expires_at: 1782700000,
        payment_intent: "pi_test_123",
        client_reference_id: "AHL-20260629-TEST",
        metadata: {
          order_id: "01H00000000000000000000001",
          order_number: "AHL-20260629-TEST"
        }
      }
    }
  };
}

function paymentIntentSucceededEvent() {
  return {
    id: "evt_pi",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_123",
        amount: 4900,
        amount_received: 4900,
        currency: "usd",
        metadata: { order_number: "AHL-20260629-TEST" }
      }
    }
  };
}

function chargeRefundedEvent() {
  return {
    id: "evt_refund",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_test_123",
        metadata: { order_number: "AHL-20260629-TEST" }
      }
    }
  };
}

function chargeDisputeEvent() {
  return {
    id: "evt_dispute",
    type: "charge.dispute.created",
    data: {
      object: {
        id: "dp_test_123",
        metadata: { order_number: "AHL-20260629-TEST" }
      }
    }
  };
}

function createWebhookPrismaMock(): PrismaService & {
  state: {
    order: {
      id: string;
      orderNumber: string;
      orderStatus: string;
      paymentStatus: string;
      fulfillmentStatus: string;
      totalCents: bigint;
      currency: string;
      metadataJson: Record<string, string>;
      orderItems: Array<{
        id: string;
        product: { code: string; translations: never[] };
        package: { code: string };
      }>;
      consentRecords: never[];
    };
    webhookEvents: Map<string, { id: string; providerEventId: string; processingStatus: string }>;
    paymentTransactions: unknown[];
    outboxEvents: unknown[];
    statusHistory: unknown[];
    generationManifestCreated: boolean;
    emailSent: boolean;
  };
} {
  const state = {
    order: {
      id: "01H00000000000000000000001",
      orderNumber: "AHL-20260629-TEST",
      orderStatus: "pending_payment",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      totalCents: 4900n,
      currency: "USD",
      metadataJson: {
        house_id: "01H00000000000000000000010",
        identity_version_id: "01H00000000000000000000011"
      },
      orderItems: [
        {
          id: "01H00000000000000000000002",
          product: { code: "family_legacy_collection", translations: [] },
          package: { code: "premium" }
        }
      ],
      consentRecords: []
    },
    webhookEvents: new Map<string, { id: string; providerEventId: string; processingStatus: string }>(),
    paymentTransactions: [] as unknown[],
    outboxEvents: [] as unknown[],
    statusHistory: [] as unknown[],
    generationManifestCreated: false,
    emailSent: false
  };

  const db = {
    state,
    db: {
      paymentWebhookEvent: {
        findUnique: async (args: unknown) => {
          const eventId = (args as { where: { provider_providerEventId: { providerEventId: string } } }).where
            .provider_providerEventId.providerEventId;
          return state.webhookEvents.get(eventId) ?? null;
        },
        create: async (args: unknown) => {
          const data = (args as { data: { id: string; providerEventId: string; processingStatus: string } }).data;
          const record = {
            id: data.id,
            providerEventId: data.providerEventId,
            processingStatus: data.processingStatus
          };
          state.webhookEvents.set(data.providerEventId, record);
          return record;
        },
        update: async (args: unknown) => {
          const typed = args as { where: { id: string }; data: { processingStatus: string } };
          const record = [...state.webhookEvents.values()].find((item) => item.id === typed.where.id);
          if (!record) {
            throw new Error("Missing webhook event");
          }
          record.processingStatus = typed.data.processingStatus;
          return record;
        }
      },
      order: {
        findUnique: async () => state.order,
        update: async (args: unknown) => {
          Object.assign(state.order, (args as { data: Partial<typeof state.order> }).data);
          return state.order;
        }
      },
      paymentIntent: {
        findUnique: async () => ({ id: "01H00000000000000000000003", providerIntentId: "pi_test_123" }),
        upsert: async () => ({ id: "01H00000000000000000000003", providerIntentId: "cs_test_123" })
      },
      paymentTransaction: {
        findUnique: async (args: unknown) => {
          const id = (args as { where: { provider_providerTransactionId: { providerTransactionId: string } } }).where
            .provider_providerTransactionId.providerTransactionId;
          return state.paymentTransactions.find((item) => (item as { providerTransactionId: string }).providerTransactionId === id) ?? null;
        },
        create: async (args: unknown) => {
          const data = (args as { data: { providerTransactionId: string } }).data;
          state.paymentTransactions.push(data);
          return data;
        }
      },
      orderStatusHistory: {
        create: async (args: unknown) => {
          state.statusHistory.push((args as { data: unknown }).data);
          return {};
        }
      },
      refund: { create: async () => ({}) },
      outboxEvent: {
        create: async (args: unknown) => {
          state.outboxEvents.push((args as { data: unknown }).data);
          return {};
        }
      },
      $transaction: async <T>(handler: (client: unknown) => Promise<T>) => handler(db.db)
    }
  };

  return db as unknown as PrismaService & { state: typeof state };
}
