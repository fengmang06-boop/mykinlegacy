import { describe, expect, it, vi } from "vitest";

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
    const prismaService = createPrismaServiceMock();
    const service = new OrdersService(prismaService);
    const result = await service.createOrder(validOrderBody());

    expect(result.amount.total_cents).toBe(4900);
    expect(result.order_status).toBe("pending_payment");
    expect(result.payment_status).toBe("unpaid");
    expect(result.fulfillment_status).toBe("not_started");
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    expect(JSON.stringify(result)).not.toContain("storage_key");
    expect(JSON.stringify(result)).not.toContain("prompt");
    expect(prismaService.__state.orderCustomerPiiRows).toHaveLength(1);
    expect(prismaService.__state.orderCustomerPiiRows[0]).toMatchObject({
      orderId: "01H00000000000000000000020",
      emailHash: "e233d4a29013e9d87150c6237c6777bedf379ebf1acdc5d6126fec7e8bb74fb5"
    });
    expect(
      Buffer.from(prismaService.__state.orderCustomerPiiRows[0]?.emailEncrypted as Buffer)
        .toString("utf8")
        .startsWith("enc:v1:")
    ).toBe(true);
    expect(prismaService.__state.orderInputRows[0]).toMatchObject({
      inputJson: {
        customer_inputs: {
          recipient: "Michael Johnson",
          occasion: "Retirement",
          family_memories: [
            "He worked for 35 years to support and protect his family, and taught his children through example."
          ]
        }
      }
    });
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  });

  it("rejects order creation if customer PII cannot be read back after write", async () => {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "test-customer-pii-key";
    const service = new OrdersService(createPrismaServiceMock({ piiReadBackMissing: true }));

    await expect(service.createOrder(validOrderBody())).rejects.toMatchObject({
      errorCode: "customer_pii_encryption_not_configured"
    });
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

  it("fails before any order insert when email encryption is unavailable", async () => {
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    const prismaService = createPrismaServiceMock() as unknown as {
      db: { $transaction: ReturnType<typeof vi.fn> };
    };
    prismaService.db.$transaction = vi.fn();
    const service = new OrdersService(prismaService as unknown as PrismaService);

    await expect(service.createOrder(validOrderBody())).rejects.toMatchObject({
      errorCode: "customer_pii_encryption_not_configured"
    });
    expect(prismaService.db.$transaction).not.toHaveBeenCalled();
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

  it("returns safe order artifact list when generated artifacts exist", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository()
    );

    const result = await service.getArtifacts("AHL-20260629-TEST");

    expect(result).toMatchObject({
      order_number: "AHL-20260629-TEST",
      status: "ready",
      message: "Your private vault is ready.",
      customer_delivery_status: "vault_ready",
      download_ready: true,
      artifacts: [
        {
          asset_id: "asset_pdf_1",
          deliverable_code: "family_story_pdf",
          friendly_name: "Family Story",
          asset_type: "pdf",
          file_ext: "pdf",
          mime_type: "application/pdf",
          available: true,
          access: {
            download_method: "private_vault_link_required",
            raw_token_exposed: false
          }
        }
      ],
      missing_artifacts: []
    });
    expect(JSON.stringify(result)).not.toContain("private-assets");
    expect(JSON.stringify(result)).not.toContain("storage_key");
    expect(JSON.stringify(result)).not.toContain("raw-token");
  });

  it("keeps Founder Edition delivery private while review is pending", async () => {
    process.env.FOUNDER_REVIEW_REQUIRED = "true";
    const service = new OrdersService(
      createPrismaServiceMock({
        metadataJson: { founder_edition: true, founder_review_status: "pending" }
      }),
      createOrchestrationRepository()
    );

    try {
      const status = await service.getOrder("AHL-20260629-TEST");
      const artifacts = await service.getArtifacts("AHL-20260629-TEST");

      expect(status).toMatchObject({
        customer_delivery_status: "pending_founder_review",
        download_ready: false,
        download_vault_available: false
      });
      expect(artifacts).toMatchObject({
        customer_delivery_status: "pending_founder_review",
        status: "pending_founder_review",
        download_ready: false,
        vault_ready: false
      });
    } finally {
      delete process.env.FOUNDER_REVIEW_REQUIRED;
    }
  });

  it("returns Generation in progress fallback when artifacts are missing", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository({ assets: [] })
    );

    const result = await service.getArtifacts("AHL-20260629-TEST");

    expect(result).toMatchObject({
      status: "preparing",
      message: "Preparing your collection.",
      customer_delivery_status: "preparing",
      artifacts: [],
      missing_artifacts: [
        {
          deliverable_code: "family_story_pdf",
          friendly_name: "Family Story",
          status: "generation_in_progress",
          available: false,
          message: "Generation in progress"
        }
      ]
    });
  });

  it("returns only PDF artifacts through the PDF endpoint", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository({
        expectedAssets: [
          { deliverable_code: "family_story_pdf", asset_type: "pdf", format: "pdf" },
          { deliverable_code: "crest_variant_1_png", asset_type: "image", format: "png" }
        ],
        assets: [
          sampleArtifact({
            id: "asset_pdf_1",
            deliverable_code: "family_story_pdf",
            asset_type: "pdf",
            file_ext: "pdf",
            mime_type: "application/pdf"
          }),
          sampleArtifact({
            id: "asset_png_1",
            deliverable_code: "crest_variant_1_png",
            asset_type: "image",
            file_ext: "png",
            mime_type: "image/png"
          })
        ]
      })
    );

    const result = await service.getPdfArtifacts("AHL-20260629-TEST");

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.deliverable_code).toBe("family_story_pdf");
    expect(result.artifacts[0]?.mime_type).toBe("application/pdf");
  });

  it("returns safe vault summary without exposing a raw token", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository()
    );

    const result = await service.getVaultSummary("AHL-20260629-TEST");

    expect(result).toMatchObject({
      vault_ready: true,
      download_ready: true,
      download_token_status: "active",
      artifact_count: 1,
      access: {
        download_method: "private_vault_link_required",
        raw_token_exposed: false
      }
    });
    expect(JSON.stringify(result)).not.toContain("download_token_1");
    expect(JSON.stringify(result)).not.toContain("raw-token");
  });

  it("reports email delivery attention instead of customer-facing failure when vault and artifacts are ready", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository({ fulfillmentStatus: "failed" })
    );

    const status = await service.getOrder("AHL-20260629-TEST");
    const artifacts = await service.getArtifacts("AHL-20260629-TEST");

    expect(status).toMatchObject({
      fulfillment_status: "failed",
      customer_delivery_status: "email_delivery_attention",
      download_ready: true
    });
    expect(artifacts).toMatchObject({
      customer_delivery_status: "email_delivery_attention",
      download_ready: true,
      status: "ready"
    });
  });

  it("reports artifact generation failure when failed order has placeholder-sized assets", async () => {
    const service = new OrdersService(
      createPrismaServiceMock(),
      createOrchestrationRepository({
        fulfillmentStatus: "failed",
        assets: [
          sampleArtifact({
            id: "asset_pdf_1",
            deliverable_code: "family_story_pdf",
            asset_type: "pdf",
            file_ext: "pdf",
            mime_type: "application/pdf",
            size_bytes: 100
          })
        ]
      })
    );

    const result = await service.getArtifacts("AHL-20260629-TEST");

    expect(result).toMatchObject({
      customer_delivery_status: "artifact_generation_failed",
      artifacts: [
        {
          deliverable_code: "family_story_pdf",
          available: false,
          message: "Artifact file is not ready"
        }
      ]
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

function createPrismaServiceMock(options: {
  piiReadBackMissing?: boolean;
  metadataJson?: Record<string, unknown>;
} = {}): PrismaService & {
  __state: {
    orderCustomerPiiRows: Array<Record<string, unknown>>;
    orderInputRows: Array<Record<string, unknown>>;
  };
} {
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
    metadataJson: options.metadataJson ?? {
      house_id: "01H00000000000000000000001"
    }
  };
  const state = {
    orderCustomerPiiRows: [] as Array<Record<string, unknown>>,
    orderInputRows: [] as Array<Record<string, unknown>>
  };
  const transactionClient = {
    order: { create: async () => order },
    orderItem: { create: async () => ({}) },
    orderInput: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.orderInputRows.push(args.data);
        return args.data;
      }
    },
    orderCustomerPii: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.orderCustomerPiiRows.push(args.data);
        return args.data;
      },
      findUnique: async (args: { where: { orderId: string } }) => {
        if (options.piiReadBackMissing) return null;
        return (
          state.orderCustomerPiiRows.find((row) => row.orderId === args.where.orderId) ?? null
        );
      }
    }
  };

  return {
    __state: state,
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
      houseInterview: {
        findUnique: async () => ({
          id: "01H00000000000000000000000",
          houseId: "01H00000000000000000000001",
          answersJson: [
            {
              step_code: "name_your_house",
              raw_answer: { selected_options: ["My father"], free_text: "Michael Johnson" }
            },
            {
              step_code: "where_story_begins",
              raw_answer: {
                selected_options: ["Retirement"],
                free_text:
                  "He worked for 35 years to support and protect his family, and taught his children through example."
              }
            }
          ]
        })
      },
      consentRecord: { create: async () => ({}) },
      $transaction: async <T>(handler: (client: typeof transactionClient) => Promise<T>) =>
        handler(transactionClient)
    }
  } as unknown as PrismaService & {
    __state: {
      orderCustomerPiiRows: Array<Record<string, unknown>>;
      orderInputRows: Array<Record<string, unknown>>;
    };
  };
}

function createOrchestrationRepository(
  options: {
    fulfillmentStatus?: string;
    manifestStatus?: string;
    failedAssets?: unknown[];
    expectedAssets?: unknown[];
    generatedAssets?: unknown[];
    assets?: Array<{
      id: string;
      deliverable_code: string;
      asset_type: string;
      asset_kind: string;
      status: string;
      file_name: string;
      file_ext: string;
      mime_type: string;
      size_bytes: number;
      public_url: null;
    }>;
  } = {}
): ConstructorParameters<typeof OrdersService>[1] {
  const expectedAssets = options.expectedAssets ?? [
    { deliverable_code: "family_story_pdf", asset_type: "pdf", format: "pdf" }
  ];
  const generatedAssets = options.generatedAssets ?? [
    { deliverable_code: "family_story_pdf", asset_id: "asset_pdf_1" }
  ];
  const assets = options.assets ?? [
    sampleArtifact({
      id: "asset_pdf_1",
      deliverable_code: "family_story_pdf",
      asset_type: "pdf",
      file_ext: "pdf",
      mime_type: "application/pdf"
    })
  ];
  return {
    findOrder: async () => ({
      id: "01H00000000000000000000020",
      order_number: "AHL-20260629-TEST",
      order_status: "completed",
      payment_status: "paid",
      fulfillment_status: options.fulfillmentStatus ?? "completed"
    }),
    listOrderItemsByOrder: async () => [
      { id: "01H00000000000000000000021", order_id: "01H00000000000000000000020" }
    ],
    findManifestByOrderItem: async () => ({
      id: "manifest_1",
      manifest_status: options.manifestStatus ?? "completed",
      expected_assets: expectedAssets,
      generated_assets: generatedAssets,
      failed_assets: options.failedAssets ?? [],
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
    findDownloadTokenByOrder: async () => ({ id: "download_token_1", status: "active" }),
    listAssetsByOrder: async () => assets
  };
}

function sampleArtifact(input: {
  id: string;
  deliverable_code: string;
  asset_type: string;
  file_ext: string;
  mime_type: string;
  size_bytes?: number;
}) {
  return {
    id: input.id,
    deliverable_code: input.deliverable_code,
    asset_type: input.asset_type,
    asset_kind: "generated",
    status: "available",
    file_name: `${input.deliverable_code}.${input.file_ext}`,
    file_ext: input.file_ext,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes ?? 24000,
    public_url: null
  };
}
