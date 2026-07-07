import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api-error";
import { validateCode } from "../common/validation";
import { PrismaService } from "../database/prisma.service";

type ProductClient = {
  product: {
    findMany: (args: unknown) => Promise<ProductRecord[]>;
    findUnique: (args: unknown) => Promise<ProductRecord | null>;
  };
};

interface ProductRecord {
  id: string;
  code: string;
  status: string;
  productType: string;
  defaultLocale: string;
  translations: ProductTranslationRecord[];
  packages: ProductPackageRecord[];
}

interface ProductTranslationRecord {
  locale: string;
  name: string;
  shortDescription: string | null;
  descriptionJson: unknown;
}

interface ProductPackageRecord {
  code: string;
  status: string;
  priceCents: bigint | number;
  currency: string;
  sortOrder: number;
  generationConfigJson: unknown;
  metadataJson: unknown;
  packageDeliverables: PackageDeliverableRecord[];
}

interface PackageDeliverableRecord {
  deliverableCode: string;
  quantity: number;
  required: boolean;
  sortOrder: number;
  configJson: unknown;
  deliverableType: {
    code: string;
    category: string;
    defaultFileExt: string;
    defaultMimeType: string;
    isDigital: boolean;
  };
}

@Injectable()
export class ProductsService {
  private readonly prisma: ProductClient;

  constructor(prismaService: PrismaService) {
    this.prisma = prismaService.db as unknown as ProductClient;
  }

  async listProducts() {
    const products = await this.prisma.product.findMany({
      where: { status: "active" },
      include: productInclude,
      orderBy: { createdAt: "asc" }
    });

    return {
      products: products.map(serializeProduct)
    };
  }

  async getProduct(productCode: string) {
    const code = validateCode(productCode, "product_code");
    const product = await this.prisma.product.findUnique({
      where: { code },
      include: productInclude
    });

    if (!product || product.status !== "active") {
      throw new ApiException({
        errorCode: "product_not_found",
        message: `Product not found: ${code}`,
        userMessage: "The requested product is not available.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "product_code"
      });
    }

    return serializeProduct(product);
  }
}

export const productInclude = {
  translations: true,
  packages: {
    where: { status: "active" },
    include: {
      packageDeliverables: {
        include: { deliverableType: true },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { sortOrder: "asc" }
  }
};

function serializeProduct(product: ProductRecord) {
  return {
    product_code: product.code,
    status: product.status,
    product_type: product.productType,
    default_locale: product.defaultLocale,
    translations: product.translations.map((translation) => ({
      locale: translation.locale,
      name: translation.name,
      short_description: customerSafeProductCopy(translation.shortDescription),
      description: customerSafeProductDescription(translation.descriptionJson)
    })),
    packages: product.packages.map((productPackage) => ({
      package_code: productPackage.code,
      status: productPackage.status,
      price_cents: Number(productPackage.priceCents),
      currency: productPackage.currency,
      sort_order: productPackage.sortOrder,
      generation_config: productPackage.generationConfigJson,
      metadata: productPackage.metadataJson,
      deliverables: productPackage.packageDeliverables.map((deliverable) => ({
        deliverable_code: deliverable.deliverableCode,
        deliverable_type: deliverable.deliverableType.code,
        category: deliverable.deliverableType.category,
        format: deliverable.deliverableType.defaultFileExt,
        mime_type: deliverable.deliverableType.defaultMimeType,
        is_digital: deliverable.deliverableType.isDigital,
        quantity: deliverable.quantity,
        required: deliverable.required,
        sort_order: deliverable.sortOrder,
        config: deliverable.configJson
      }))
    }))
  };
}

function customerSafeProductCopy(value: string | null): string | null {
  if (!value) return value;
  return value
    .replace(/\bAI-generated,\s*/gi, "")
    .replace(/\bAI generated,\s*/gi, "")
    .replace(/\bAI-generated\b/gi, "personalized")
    .replace(/\bAI generated\b/gi, "personalized")
    .replace(
      /\bofficial,\s*legally granted,\s*or historically certified coat of arms\b/gi,
      "official coat of arms, legal heraldic grant, or certified genealogical record"
    )
    .replace(/\blegally granted\b/gi, "legal heraldic grant")
    .replace(/\bhistorically certified\b/gi, "certified genealogical")
    .replace(/\bprivate download vault\b/gi, "private vault")
    .replace(/\s+/g, " ")
    .trim();
}

function customerSafeProductDescription(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(customerSafeProductDescription);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        customerSafeProductDescription(entry)
      ])
    );
  }
  if (typeof value === "string") {
    return customerSafeProductCopy(value);
  }
  return value;
}
