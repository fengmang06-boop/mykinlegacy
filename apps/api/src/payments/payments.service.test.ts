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

    expect(stripeCalls[0]).toMatchObject({ amountCents: 4900, currency: "USD" });
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
        metadataJson: {},
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
      order: { findUnique: async () => order },
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
