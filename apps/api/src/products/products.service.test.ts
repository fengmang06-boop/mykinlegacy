import { describe, expect, it } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  it("returns active family_legacy_collection from database seed data shape", async () => {
    const service = new ProductsService(createPrismaServiceMock());
    const result = await service.listProducts();

    expect(result.products[0]?.product_code).toBe("family_legacy_collection");
  });

  it("returns premium package and 8 deliverables", async () => {
    const service = new ProductsService(createPrismaServiceMock());
    const result = await service.getProduct("family_legacy_collection");

    expect(result.packages[0]?.package_code).toBe("premium");
    expect(result.packages[0]?.price_cents).toBe(4900);
    expect(result.packages[0]?.deliverables).toHaveLength(8);
  });
});

function createPrismaServiceMock(): PrismaService {
  const product = createProductRecord();
  return {
    db: {
      product: {
        findMany: async () => [product],
        findUnique: async () => product
      }
    }
  } as unknown as PrismaService;
}

function createProductRecord() {
  const deliverables = [
    "crest_variant_1_png",
    "crest_variant_2_png",
    "crest_variant_3_png",
    "transparent_crest_png",
    "heritage_certificate_pdf",
    "family_story_pdf",
    "symbol_explanation_pdf",
    "download_package_zip"
  ];

  return {
    id: "01H00000000000000000000000",
    code: "family_legacy_collection",
    status: "active",
    productType: "digital",
    defaultLocale: "en-US",
    translations: [],
    packages: [
      {
        code: "premium",
        status: "active",
        priceCents: 4900n,
        currency: "USD",
        sortOrder: 1,
        generationConfigJson: {},
        metadataJson: {},
        packageDeliverables: deliverables.map((deliverableCode, index) => ({
          deliverableCode,
          quantity: 1,
          required: true,
          sortOrder: index + 1,
          configJson: {},
          deliverableType: {
            code: deliverableCode.includes("zip") ? "download_package_zip" : "crest_variant_png",
            category: deliverableCode.includes("pdf") ? "pdf" : "image",
            defaultFileExt: deliverableCode.endsWith("zip") ? "zip" : deliverableCode.endsWith("pdf") ? "pdf" : "png",
            defaultMimeType: "application/octet-stream",
            isDigital: true
          }
        }))
      }
    ]
  };
}
