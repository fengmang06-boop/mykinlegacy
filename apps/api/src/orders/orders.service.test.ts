import { describe, expect, it } from "vitest";

import { ApiException } from "../common/api-error";
import type { PrismaService } from "../database/prisma.service";
import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  it("rejects frontend price", async () => {
    const service = new OrdersService(createPrismaServiceMock());

    await expect(
      service.createOrder({
        data: {
          product_code: "family_legacy_collection",
          package_code: "premium",
          interview_id: "01H00000000000000000000000",
          house_id: "01H00000000000000000000001",
          identity_version_id: "01H00000000000000000000002",
          customer_email: "customer@example.com",
          price_cents: 1
        }
      })
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("creates pending order using database package price", async () => {
    const service = new OrdersService(createPrismaServiceMock());
    const result = await service.createOrder(validOrderBody());

    expect(result.amount.total_cents).toBe(4900);
    expect(result.order_status).toBe("pending_payment");
    expect(result.payment_status).toBe("unpaid");
    expect(result.fulfillment_status).toBe("not_started");
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    expect(JSON.stringify(result)).not.toContain("storage_key");
    expect(JSON.stringify(result)).not.toContain("prompt");
  });

  it("gets order status without download or manifest", async () => {
    const service = new OrdersService(createPrismaServiceMock());
    const result = await service.getOrder("AHL-20260629-TEST");

    expect(result.generation_manifest).toBeNull();
    expect(result.download_ready).toBe(false);
  });

  it("rejects missing heritage disclaimer consent", async () => {
    const service = new OrdersService(createPrismaServiceMock());

    await expect(
      service.createConsent("AHL-20260629-TEST", {
        data: {
          terms_accepted: true,
          privacy_policy_accepted: true,
          heritage_disclaimer_accepted: false,
          ai_generation_consent: true,
          email_delivery_consent: true,
          consent_version: "2026-06-29"
        }
      })
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("creates complete consent and allows generation", async () => {
    const service = new OrdersService(createPrismaServiceMock());
    const result = await service.createConsent("AHL-20260629-TEST", {
      data: {
        terms_accepted: true,
        privacy_policy_accepted: true,
        heritage_disclaimer_accepted: true,
        ai_generation_consent: true,
        email_delivery_consent: true,
        marketing_opt_in: false,
        gallery_opt_in: false,
        consent_version: "2026-06-29"
      }
    });

    expect(result.generation_allowed).toBe(true);
    expect(result.payment_allowed).toBe(true);
  });
});

function validOrderBody() {
  return {
    data: {
      product_code: "family_legacy_collection",
      package_code: "premium",
      interview_id: "01H00000000000000000000000",
      house_id: "01H00000000000000000000001",
      identity_version_id: "01H00000000000000000000002",
      customer_email: "customer@example.com"
    }
  };
}

function createPrismaServiceMock(): PrismaService {
  const product = {
    id: "01H00000000000000000000010",
    code: "family_legacy_collection",
    status: "active",
    packages: [
      {
        id: "01H00000000000000000000011",
        code: "premium",
        status: "active",
        priceCents: 4900n,
        currency: "USD"
      }
    ]
  };
  const order = {
    id: "01H00000000000000000000020",
    orderNumber: "AHL-20260629-TEST",
    orderStatus: "pending_payment",
    paymentStatus: "unpaid",
    fulfillmentStatus: "not_started",
    totalCents: 4900n,
    currency: "USD",
    metadataJson: {
      house_id: "01H00000000000000000000001"
    }
  };
  const transactionClient = {
    order: { create: async () => order },
    orderItem: { create: async () => ({}) },
    orderCustomerPii: { create: async () => ({}) }
  };

  return {
    db: {
      product: { findUnique: async () => product },
      order: { findUnique: async () => order },
      consentRecord: { create: async () => ({}) },
      $transaction: async <T>(handler: (client: typeof transactionClient) => Promise<T>) =>
        handler(transactionClient)
    }
  } as unknown as PrismaService;
}
