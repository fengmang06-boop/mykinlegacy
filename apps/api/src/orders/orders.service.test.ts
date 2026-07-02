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
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "test-customer-pii-key";
    const service = new OrdersService(createPrismaServiceMock());
    const result = await service.createOrder(validOrderBody());

    expect(result.amount.total_cents).toBe(4900);
    expect(result.order_status).toBe("pending_payment");
    expect(result.payment_status).toBe("unpaid");
    expect(result.fulfillment_status).toBe("not_started");
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    expect(JSON.stringify(result)).not.toContain("storage_key");
    expect(JSON.stringify(result)).not.toContain("prompt");
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  });

  it("rejects order creation when customer email cannot be encrypted", async () => {
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    const service = new OrdersService(createPrismaServiceMock());

    await expect(service.createOrder(validOrderBody())).rejects.toMatchObject({
      errorCode: "customer_pii_encryption_not_configured"
    });
  });

  it("gets order status without download or manifest", async () => {
    const service = new OrdersService(createPrismaServiceMock());
    const result = await service.getOrder("AHL-20260629-TEST");

    expect(result.generation_manifest).toBeNull();
    expect(result.download_ready).toBe(false);
  });

  it("gets paid order generation and vault readiness from orchestration repository", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository()
    );
    const result = await service.getOrder("AHL-20260629-TEST");

    expect(result).toMatchObject({
      order_number: "AHL-20260629-TEST",
      payment_status: "paid",
      fulfillment_status: "completed",
      generation_manifest: {
        manifest_status: "completed",
        expected_assets_count: 1,
        generated_assets_count: 1,
        failed_assets_count: 0,
        meaning_profile: {
          source_level: "customer_informed",
          themes: [
            {
              theme: "Protection",
              confidence: "high",
              evidence: "Family values mention protecting younger generations."
            }
          ],
          symbols: [
            {
              symbol: "Oak",
              meaning: "Strength",
              rationale: "Selected for steady family protection.",
              source: "customer_input"
            }
          ],
          design_rationale: ["Use grounded, protective composition."],
          story_direction: "A story about protection across generations.",
          certificate_direction: "A keepsake certificate centered on family continuity.",
          boundary_statement:
            "MyKinLegacy creates personalized symbolic keepsakes. It does not provide official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records.",
          validation: { valid: true, quality_flags: [], banned_claims_found: [] }
        },
        collection_content: {
          house_meaning_summary: "A private symbolic keepsake shaped around protection.",
          symbol_guide: [
            {
              symbol: "Oak",
              meaning: "Strength",
              why_chosen: "Chosen because the family values protection.",
              emotional_relevance: "Oak gives the collection a steady family anchor."
            }
          ],
          family_story: "A warm story about protection across generations.",
          certificate_text: "Presented as a private symbolic keepsake.",
          collection_letter: "To the family, this collection honors what matters.",
          design_basis: "The design uses oak as a protective anchor.",
          boundary_statement:
            "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record."
        }
      },
      download_ready: true,
      download_vault_available: true
    });
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
    orderInput: { create: async () => ({}) },
    orderCustomerPii: { create: async () => ({}) }
  };

  return {
    db: {
      product: { findUnique: async () => product },
      order: { findUnique: async () => order },
      houseIdentityVersion: {
        findUnique: async () => ({
          id: "01H00000000000000000000002",
          houseId: "01H00000000000000000000001",
          houseDnaSnapshotJson: {
            house_name: "House of Alder",
            surname: "Alder",
            family_values: ["protection"],
            colors: { primary: ["gold", "ivory"] }
          }
        })
      },
      consentRecord: { create: async () => ({}) },
      $transaction: async <T>(handler: (client: typeof transactionClient) => Promise<T>) =>
        handler(transactionClient)
    }
  } as unknown as PrismaService;
}

function createOrchestrationRepository(): ConstructorParameters<typeof OrdersService>[1] {
  return {
    findOrder: async () => ({
      id: "01H00000000000000000000020",
      order_number: "AHL-20260629-TEST",
      order_status: "completed",
      payment_status: "paid",
      fulfillment_status: "completed"
    }),
    listOrderItemsByOrder: async () => [
      { id: "01H00000000000000000000021", order_id: "01H00000000000000000000020" }
    ],
    findManifestByOrderItem: async () => ({
      id: "manifest_1",
      manifest_status: "completed",
      expected_assets: [{ deliverable_code: "download_package_zip" }],
      generated_assets: [{ deliverable_code: "download_package_zip", asset_id: "asset_1" }],
      failed_assets: [],
      optional_assets: [
        {
          attachment_type: "meaning_engine",
          meaning_profile: {
            source_level: "customer_informed",
            meaning_themes: [
              {
                theme: "Protection",
                confidence: "high",
                evidence: "Family values mention protecting younger generations."
              }
            ],
            symbol_choices: [
              {
                symbol: "Oak",
                meaning: "Strength",
                rationale: "Selected for steady family protection.",
                source: "customer_input"
              }
            ],
            design_rationale: ["Use grounded, protective composition."],
            story_direction: "A story about protection across generations.",
            certificate_direction: "A keepsake certificate centered on family continuity.",
            boundary_statement:
              "MyKinLegacy creates personalized symbolic keepsakes. It does not provide official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records.",
            validation: { valid: true, quality_flags: [], banned_claims_found: [] }
          },
          collection_content: {
            house_meaning_summary: "A private symbolic keepsake shaped around protection.",
            symbol_guide: [
              {
                symbol: "Oak",
                meaning: "Strength",
                why_chosen: "Chosen because the family values protection.",
                emotional_relevance: "Oak gives the collection a steady family anchor."
              }
            ],
            family_story: "A warm story about protection across generations.",
            certificate_text: "Presented as a private symbolic keepsake.",
            collection_letter: "To the family, this collection honors what matters.",
            design_basis: "The design uses oak as a protective anchor.",
            boundary_statement:
              "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record."
          }
        }
      ]
    }),
    findDownloadTokenByOrder: async () => ({ id: "download_token_1", status: "active" })
  };
}
