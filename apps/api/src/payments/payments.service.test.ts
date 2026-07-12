import { describe, expect, it } from "vitest";

import { ApiException } from "../common/api-error";
import type { IdempotencyService } from "../common/idempotency.service";
import type { PrismaService } from "../database/prisma.service";
import { PaymentsService } from "./payments.service";
import type { StripeAdapter } from "./stripe.adapter";

describe("PaymentsService", () => {
  it("returns consent_required when consent is missing", async () => {
    const service = createService({ consentComplete: false });

    await expect(service.createStripeCheckoutSession(validCheckoutBody(), "key-1")).rejects.toMatchObject({
      errorCode: "consent_required"
    });
  });

  it("returns order_not_found when order does not exist", async () => {
    const service = createService({ orderExists: false });

    await expect(service.createStripeCheckoutSession(validCheckoutBody(), "key-1")).rejects.toMatchObject({
      errorCode: "order_not_found"
    });
  });

  it("rejects frontend amount", async () => {
    const service = createService({});

    await expect(
      service.createStripeCheckoutSession(
        {
          data: {
            ...validCheckoutBody().data,
            amount_cents: 1
          }
        },
        "key-1"
      )
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("rejects frontend currency override", async () => {
    const service = createService({});

    await expect(
      service.createStripeCheckoutSession(
        {
          data: {
            ...validCheckoutBody().data,
            currency: "EUR"
          }
        },
        "key-1"
      )
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("uses order.total_cents to create Stripe session", async () => {
    const stripeCalls: unknown[] = [];
    const service = createService({ stripeCalls });

    const result = await service.createStripeCheckoutSession(validCheckoutBody(), "key-1");

    expect(stripeCalls[0]).toMatchObject({
      amountCents: 4900,
      currency: "USD",
      productName: "MyKinLegacy Family Legacy Collection"
    });
    expect(result.checkout_session_id).toBe("cs_test_123");
  });

  it("creates payment_intent record", async () => {
    const paymentIntentWrites: unknown[] = [];
    const service = createService({ paymentIntentWrites });

    await service.createStripeCheckoutSession(validCheckoutBody(), "key-1");

    expect(paymentIntentWrites).toHaveLength(1);
    expect(paymentIntentWrites[0]).toMatchObject({
      create: expect.objectContaining({
        provider: "stripe",
        providerIntentId: "cs_test_123",
        amountCents: 4900n
      })
    });
  });

  it("does not return Stripe secret values", async () => {
    const service = createService({});
    const result = await service.createStripeCheckoutSession(validCheckoutBody(), "key-1");

    expect(JSON.stringify(result)).not.toContain("sk_test");
    expect(JSON.stringify(result)).not.toContain("whsec");
  });

  it("blocks checkout when the operational kill switch is paused", async () => {
    process.env.CHECKOUT_ENABLED = "false";
    try {
      const service = createService({});
      await expect(service.createStripeCheckoutSession(validCheckoutBody(), "key-1")).rejects.toMatchObject({
        errorCode: "checkout_paused"
      });
    } finally {
      delete process.env.CHECKOUT_ENABLED;
    }
  });

  it("blocks the 26th paid Founder Edition checkout", async () => {
    const service = createService({
      orderMetadata: { founder_edition: true },
      paidFounderEditionCount: 25
    });
    process.env.FOUNDER_EDITION_ORDER_LIMIT = "25";
    try {
      await expect(service.createStripeCheckoutSession(validCheckoutBody(), "key-1")).rejects.toMatchObject({
        errorCode: "founder_edition_full"
      });
    } finally {
      delete process.env.FOUNDER_EDITION_ORDER_LIMIT;
    }
  });
});

function validCheckoutBody() {
  return {
    data: {
      order_number: "AHL-20260629-TEST",
      success_url: "http://localhost:3000/payment/success?order_number=AHL-20260629-TEST",
      cancel_url: "http://localhost:3000/payment/cancel?order_number=AHL-20260629-TEST"
    }
  };
}

function createService(options: {
  orderExists?: boolean;
  consentComplete?: boolean;
  stripeCalls?: unknown[];
  paymentIntentWrites?: unknown[];
  orderMetadata?: Record<string, unknown>;
  paidFounderEditionCount?: number;
}) {
  const orderExists = options.orderExists ?? true;
  const consentComplete = options.consentComplete ?? true;
  const order = orderExists
    ? {
        id: "01H00000000000000000000001",
        orderNumber: "AHL-20260629-TEST",
        orderStatus: "pending_payment",
        paymentStatus: "unpaid",
        fulfillmentStatus: "not_started",
        totalCents: 4900n,
        currency: "USD",
        metadataJson: options.orderMetadata ?? {},
        orderItems: [
          {
            id: "01H00000000000000000000002",
            productSnapshotJson: {},
            product: {
              code: "family_legacy_collection",
              translations: [{ locale: "en-US", name: "Family Legacy Collection" }]
            },
            package: { code: "premium" }
          }
        ],
        consentRecords: consentComplete
          ? [
              {
                termsAccepted: true,
                privacyPolicyAccepted: true,
                heritageDisclaimerAccepted: true,
                aiGenerationConsent: true,
                emailDeliveryConsent: true
              }
            ]
          : []
      }
    : null;

  const prismaService = {
    db: {
      order: {
        findUnique: async () => order,
        findMany: async () =>
          Array.from({ length: options.paidFounderEditionCount ?? 0 }, () => ({
            metadataJson: { founder_edition: true }
          }))
      },
      paymentIntent: {
        upsert: async (args: unknown) => {
          options.paymentIntentWrites?.push((args as { create: unknown }).create ? args : (args as { data: unknown }).data);
          return { id: "01H00000000000000000000003", providerIntentId: "cs_test_123" };
        }
      }
    }
  } as unknown as PrismaService;
  const stripeAdapter = {
    createCheckoutSession: async (input: unknown) => {
      options.stripeCalls?.push(input);
      return {
        id: "cs_test_123",
        url: "https://checkout.stripe.test/session",
        expiresAt: new Date("2026-06-29T01:00:00.000Z")
      };
    }
  } as unknown as StripeAdapter;
  const idempotency = {
    run: async <T>(input: { handler: () => Promise<T> }) => input.handler()
  } as unknown as IdempotencyService;

  return new PaymentsService(prismaService, stripeAdapter, idempotency);
}
