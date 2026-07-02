import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { ulid } from "ulid";

import { ApiException } from "../common/api-error";
import {
  hashEmail,
  encryptEmailForStorage,
  isCustomerPiiEncryptionConfigured
} from "../common/security";
import {
  optionalBoolean,
  rejectFields,
  requireBoolean,
  requireDataEnvelope,
  requireString,
  validateCode,
  validateEmail,
  validateUlid
} from "../common/validation";
import { PrismaService } from "../database/prisma.service";
import { ORCHESTRATION_REPOSITORY } from "../database/orchestration.provider";

type OrdersClient = {
  product: { findUnique: (args: unknown) => Promise<ProductRecord | null> };
  order: {
    create: (args: unknown) => Promise<OrderRecord>;
    findUnique: (args: unknown) => Promise<OrderRecord | null>;
  };
  orderItem: { create: (args: unknown) => Promise<unknown> };
  orderInput: { create: (args: unknown) => Promise<unknown> };
  orderCustomerPii: { create: (args: unknown) => Promise<unknown> };
  houseIdentityVersion: { findUnique: (args: unknown) => Promise<HouseIdentityVersionRecord | null> };
  consentRecord: {
    create: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<ConsentRecord | null>;
  };
  $transaction: <T>(fn: (client: OrdersClient) => Promise<T>) => Promise<T>;
};

interface ProductRecord {
  id: string;
  code: string;
  status: string;
  packages: ProductPackageRecord[];
}

interface ProductPackageRecord {
  id: string;
  code: string;
  status: string;
  priceCents: bigint | number;
  currency: string;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: bigint | number;
  currency: string;
  metadataJson: unknown;
}

interface HouseIdentityVersionRecord {
  id: string;
  houseId: string;
  houseDnaSnapshotJson: unknown;
}

interface ConsentRecord {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
  heritageDisclaimerAccepted: boolean;
  aiGenerationConsent: boolean;
  emailDeliveryConsent: boolean;
}

interface OrderGenerationRepository {
  findOrder(orderId: string): Promise<{
    id: string;
    order_number: string;
    order_status: string;
    payment_status: string;
    fulfillment_status: string;
  } | null>;
  listOrderItemsByOrder(orderId?: string): Promise<Array<{ id: string; order_id: string }>>;
  findManifestByOrderItem(orderId: string, orderItemId: string): Promise<{
    id: string;
    manifest_status: string;
    expected_assets: unknown[];
    generated_assets: unknown[];
    failed_assets: unknown[];
    optional_assets?: unknown[];
  } | null>;
  findDownloadTokenByOrder(orderId: string): Promise<{ id: string; status: string } | null>;
  listAssetsByOrder?(orderId: string): Promise<OrderArtifactRecord[]>;
}

interface OrderArtifactRecord {
  id: string;
  deliverable_code: string;
  asset_type: string;
  asset_kind?: string;
  status: string;
  file_name?: string;
  file_ext: string;
  mime_type: string;
  size_bytes: number;
  public_url?: null;
}

@Injectable()
export class OrdersService {
  private readonly prisma: OrdersClient;

  constructor(
    prismaService: PrismaService,
    @Optional()
    @Inject(ORCHESTRATION_REPOSITORY)
    private readonly orchestrationRepository?: OrderGenerationRepository
  ) {
    this.prisma = prismaService.db as unknown as OrdersClient;
  }

  async createOrder(body: unknown) {
    const data = requireDataEnvelope(body);
    rejectFields(data, ["price", "price_cents", "amount", "currency"]);
    const productCode = validateCode(requireString(data, "product_code"), "product_code");
    const packageCode = validateCode(requireString(data, "package_code"), "package_code");
    const interviewId = validateUlid(requireString(data, "interview_id"), "interview_id");
    const houseId = validateUlid(requireString(data, "house_id"), "house_id");
    const identityVersionId = validateUlid(
      requireString(data, "identity_version_id"),
      "identity_version_id"
    );
    const customerEmail = validateEmail(requireString(data, "customer_email"), "customer_email");
    assertCustomerEmailCanBeEncrypted();
    const product = await this.findProductWithPackage(productCode, packageCode);
    const identityVersion = await this.findIdentityVersion(identityVersionId, houseId);
    const productPackage = product.packages[0];
    if (!productPackage) {
      throwPackageNotFound(packageCode);
    }

    const totalCents = BigInt(productPackage.priceCents);
    const orderNumber = createOrderNumber();
    const timestamp = new Date();

    const order = await this.prisma.$transaction(async (transaction) => {
      const orderItemId = ulid();
      const createdOrder = await transaction.order.create({
        data: {
          id: ulid(),
          orderNumber,
          userId: null,
          customerProfileId: null,
          orderStatus: "pending_payment",
          paymentStatus: "unpaid",
          fulfillmentStatus: "not_started",
          subtotalCents: totalCents,
          discountCents: 0n,
          taxCents: 0n,
          totalCents,
          currency: productPackage.currency,
          locale: "en-US",
          source: "public_api",
          metadataJson: {
            interview_id: interviewId,
            house_id: houseId,
            identity_version_id: identityVersionId
          },
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });

      await transaction.orderItem.create({
        data: {
          id: orderItemId,
          orderId: createdOrder.id,
          productId: product.id,
          packageId: productPackage.id,
          quantity: 1,
          unitPriceCents: totalCents,
          totalPriceCents: totalCents,
          currency: productPackage.currency,
          productSnapshotJson: {
            product_code: product.code,
            package_code: productPackage.code,
            price_cents: Number(totalCents),
            currency: productPackage.currency
          },
          status: "pending",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });

      await transaction.orderInput.create({
        data: {
          id: ulid(),
          orderId: createdOrder.id,
          orderItemId,
          productId: product.id,
          inputSchemaVersion: "house_dna_snapshot.v1",
          inputJson: {
            source: "confirmed_house_identity_version",
            house_id: houseId,
            identity_version_id: identityVersion.id,
            house_dna: identityVersion.houseDnaSnapshotJson
          },
          normalizedInputJson: identityVersion.houseDnaSnapshotJson,
          locale: "en-US",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });

      await transaction.orderCustomerPii.create({
        data: {
          id: ulid(),
          orderId: createdOrder.id,
          emailEncrypted: encryptEmailForStorage(customerEmail),
          emailHash: hashEmail(customerEmail),
          nameEncrypted: null,
          billingCountry: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });

      return createdOrder;
    });

    return serializeOrder(order);
  }

  async getOrder(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber }
    });

    if (!order) {
      throw new ApiException({
        errorCode: "order_not_found",
        message: `Order not found: ${orderNumber}`,
        userMessage: "The order could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "order_number"
      });
    }

    if (this.orchestrationRepository) {
      return getOrderGenerationSummary({
        order_id: order.id,
        repository: this.orchestrationRepository
      });
    }

    return {
      ...serializeOrder(order),
      generation_manifest: null,
      download_ready: false,
      download_vault_available: false,
      friendly_progress_status: "waiting_for_generation"
    };
  }

  async getArtifacts(orderNumber: string) {
    const context = await this.getOrderArtifactContext(orderNumber);
    return buildArtifactResponse(context);
  }

  async getPdfArtifacts(orderNumber: string) {
    const context = await this.getOrderArtifactContext(orderNumber);
    const response = buildArtifactResponse(context);
    const pdfArtifacts = response.artifacts.filter(
      (artifact) => artifact.asset_type === "pdf" || artifact.file_ext === "pdf"
    );
    const missingPdfArtifacts = response.missing_artifacts.filter(
      (artifact) => artifact.asset_type === "pdf" || artifact.file_ext === "pdf"
    );
    return {
      ...response,
      status:
        pdfArtifacts.length > 0
          ? response.status
          : missingPdfArtifacts.length > 0
            ? "generation_in_progress"
            : "generation_in_progress",
      artifacts: pdfArtifacts,
      missing_artifacts: missingPdfArtifacts,
      message:
        pdfArtifacts.length > 0
          ? response.message
          : "Generation in progress"
    };
  }

  async getVaultSummary(orderNumber: string) {
    const context = await this.getOrderArtifactContext(orderNumber);
    const response = buildArtifactResponse(context);
    return {
      order_number: response.order_number,
      payment_status: context.order.payment_status,
      order_status: context.order.order_status,
      fulfillment_status: context.order.fulfillment_status,
      vault_ready: response.vault_ready,
      download_ready: response.download_ready,
      download_token_status: context.downloadToken?.status ?? null,
      artifact_count: response.artifacts.length,
      available_artifact_count: response.artifacts.filter((artifact) => artifact.available).length,
      missing_artifact_count: response.missing_artifacts.length,
      status: response.status,
      message: response.message,
      access: {
        download_method: "private_vault_link_required",
        raw_token_exposed: false
      },
      disclaimer:
        "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record."
    };
  }

  async createConsent(orderNumber: string, body: unknown) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber }
    });
    if (!order) {
      throw new ApiException({
        errorCode: "order_not_found",
        message: `Order not found: ${orderNumber}`,
        userMessage: "The order could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "order_number"
      });
    }

    const data = requireDataEnvelope(body);
    const heritageDisclaimerAccepted = requireBoolean(data, "heritage_disclaimer_accepted");
    const consent = {
      termsAccepted: requireBoolean(data, "terms_accepted"),
      privacyPolicyAccepted: requireBoolean(data, "privacy_policy_accepted"),
      heritageDisclaimerAccepted,
      aiGenerationConsent: requireBoolean(data, "ai_generation_consent"),
      emailDeliveryConsent: requireBoolean(data, "email_delivery_consent")
    };
    if (!Object.values(consent).every(Boolean)) {
      throw new ApiException({
        errorCode: "validation_error",
        message: "All required consent fields must be true before generation.",
        userMessage: "Please accept the required consent items.",
        status: HttpStatus.BAD_REQUEST,
        affectedField: "heritage_disclaimer_accepted"
      });
    }

    const timestamp = new Date();
    const metadata = isRecord(order.metadataJson) ? order.metadataJson : {};
    const houseId = typeof metadata.house_id === "string" ? metadata.house_id : null;

    await this.prisma.consentRecord.create({
      data: {
        id: ulid(),
        houseId,
        orderId: order.id,
        termsAccepted: consent.termsAccepted,
        termsAcceptedAt: timestamp,
        privacyPolicyAccepted: consent.privacyPolicyAccepted,
        privacyPolicyAcceptedAt: timestamp,
        heritageDisclaimerAccepted: consent.heritageDisclaimerAccepted,
        heritageDisclaimerAcceptedAt: timestamp,
        aiGenerationConsent: consent.aiGenerationConsent,
        emailDeliveryConsent: consent.emailDeliveryConsent,
        marketingOptIn: optionalBoolean(data, "marketing_opt_in", false),
        galleryOptIn: optionalBoolean(data, "gallery_opt_in", false),
        ipHash: null,
        userAgentHash: null,
        consentVersion: requireString(data, "consent_version"),
        contractVersion: "1.1",
        schemaVersion: "consent_record.v1",
        source: "public_api",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    return {
      order_number: order.orderNumber,
      generation_allowed: true,
      payment_allowed: true
    };
  }

  private async findProductWithPackage(productCode: string, packageCode: string) {
    const product = await this.prisma.product.findUnique({
      where: { code: productCode },
      include: {
        packages: {
          where: { code: packageCode, status: "active" },
          take: 1
        }
      }
    });

    if (!product || product.status !== "active") {
      throw new ApiException({
        errorCode: "product_not_found",
        message: `Product not found: ${productCode}`,
        userMessage: "The selected product is not available.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "product_code"
      });
    }
    if (product.packages.length === 0) {
      throwPackageNotFound(packageCode);
    }
    return product;
  }

  private async findIdentityVersion(identityVersionId: string, houseId: string) {
    const version = await this.prisma.houseIdentityVersion.findUnique({
      where: { id: identityVersionId }
    });
    if (!version || version.houseId !== houseId) {
      throw new ApiException({
        errorCode: "validation_error",
        message: `House identity version not found for order: ${identityVersionId}`,
        userMessage: "The confirmed family identity could not be found. Please review the collection again.",
        status: HttpStatus.BAD_REQUEST,
        affectedField: "identity_version_id"
      });
    }
    return version;
  }

  private async getOrderArtifactContext(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber }
    });
    if (!order) {
      throw new ApiException({
        errorCode: "order_not_found",
        message: `Order not found: ${orderNumber}`,
        userMessage: "The order could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "order_number"
      });
    }

    if (!this.orchestrationRepository) {
      return {
        order: {
          id: order.id,
          order_number: order.orderNumber,
          order_status: order.orderStatus,
          payment_status: order.paymentStatus,
          fulfillment_status: order.fulfillmentStatus
        },
        manifest: null,
        assets: [] as OrderArtifactRecord[],
        downloadToken: null as { id: string; status: string } | null
      };
    }

    const orchestrationOrder = await this.orchestrationRepository.findOrder(order.id);
    if (!orchestrationOrder) {
      throw new ApiException({
        errorCode: "order_not_found",
        message: `Order not found in orchestration repository: ${orderNumber}`,
        userMessage: "The order could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "order_number"
      });
    }
    const orderItems = await this.orchestrationRepository.listOrderItemsByOrder(order.id);
    const manifest = orderItems[0]
      ? await this.orchestrationRepository.findManifestByOrderItem(order.id, orderItems[0].id)
      : null;
    const assets = this.orchestrationRepository.listAssetsByOrder
      ? await this.orchestrationRepository.listAssetsByOrder(order.id)
      : [];
    const downloadToken = await this.orchestrationRepository.findDownloadTokenByOrder(order.id);

    return {
      order: orchestrationOrder,
      manifest,
      assets,
      downloadToken
    };
  }
}

function buildArtifactResponse(context: {
  order: {
    order_number: string;
    order_status: string;
    payment_status: string;
    fulfillment_status: string;
  };
  manifest: {
    manifest_status: string;
    expected_assets: unknown[];
    generated_assets: unknown[];
    failed_assets: unknown[];
  } | null;
  assets: OrderArtifactRecord[];
  downloadToken: { id: string; status: string } | null;
}) {
  const expectedArtifacts = expectedArtifactEntries(context.manifest?.expected_assets ?? []);
  const actualArtifacts = context.assets.map(mapOrderArtifact);
  const actualCodes = new Set(actualArtifacts.map((artifact) => artifact.deliverable_code));
  const missingArtifacts = expectedArtifacts
    .filter((artifact) => !actualCodes.has(artifact.deliverable_code))
    .map((artifact) => ({
      ...artifact,
      asset_id: null,
      status: "generation_in_progress",
      available: false,
      message: "Generation in progress"
    }));
  const vaultReady = Boolean(context.downloadToken && context.downloadToken.status === "active");
  const complete = actualArtifacts.length > 0 && missingArtifacts.length === 0;

  return {
    order_number: context.order.order_number,
    order_status: context.order.order_status,
    payment_status: context.order.payment_status,
    fulfillment_status: context.order.fulfillment_status,
    manifest_status: context.manifest?.manifest_status ?? null,
    status: complete ? "ready" : "generation_in_progress",
    message: complete ? "Artifacts ready" : "Generation in progress",
    download_ready: vaultReady,
    vault_ready: vaultReady,
    artifacts: actualArtifacts,
    missing_artifacts: missingArtifacts,
    access: {
      download_method: "private_vault_link_required",
      raw_token_exposed: false
    }
  };
}

function expectedArtifactEntries(expectedAssets: unknown[]) {
  return expectedAssets
    .map((item) => {
      if (!isRecord(item)) return null;
      const deliverableCode = stringOrNull(item.deliverable_code);
      if (!deliverableCode) return null;
      const format = stringOrNull(item.format) ?? fileExtFromDeliverableCode(deliverableCode);
      const assetType = stringOrNull(item.asset_type) ?? assetTypeFromFormat(format);
      return {
        deliverable_code: deliverableCode,
        friendly_name: friendlyDeliverableName(deliverableCode),
        asset_type: assetType,
        file_ext: format,
        mime_type: mimeTypeFromFormat(format)
      };
    })
    .filter((item): item is {
      deliverable_code: string;
      friendly_name: string;
      asset_type: string;
      file_ext: string;
      mime_type: string;
    } => Boolean(item));
}

function mapOrderArtifact(asset: OrderArtifactRecord) {
  return {
    asset_id: asset.id,
    deliverable_code: asset.deliverable_code,
    friendly_name: friendlyDeliverableName(asset.deliverable_code),
    asset_type: asset.asset_type,
    asset_kind: asset.asset_kind ?? null,
    file_name: asset.file_name ?? null,
    file_ext: asset.file_ext,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    status: asset.status,
    available: isArtifactAvailable(asset),
    access: {
      download_method: "private_vault_link_required",
      signed_url_endpoint: null,
      raw_token_exposed: false
    },
    message: isArtifactAvailable(asset) ? null : "Generation in progress"
  };
}

function isArtifactAvailable(asset: OrderArtifactRecord) {
  return (
    asset.public_url === null &&
    (asset.status === "available" || asset.status === "available_for_download")
  );
}

function friendlyDeliverableName(code: string): string {
  const names: Record<string, string> = {
    crest_variant_1_png: "Crest Artwork 1",
    crest_variant_2_png: "Crest Artwork 2",
    crest_variant_3_png: "Crest Artwork 3",
    transparent_crest_png: "Transparent Crest Artwork",
    symbol_explanation_pdf: "Symbol Guide",
    heritage_certificate_pdf: "Heritage Certificate",
    family_story_pdf: "Family Story",
    download_package_zip: "Complete Collection Archive"
  };
  return (
    names[code] ??
    code
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function fileExtFromDeliverableCode(code: string): string {
  if (code.endsWith("_pdf")) return "pdf";
  if (code.endsWith("_zip")) return "zip";
  if (code.endsWith("_png")) return "png";
  return "bin";
}

function assetTypeFromFormat(format: string): string {
  if (format === "pdf") return "pdf";
  if (format === "zip") return "archive";
  if (format === "png" || format === "webp" || format === "jpg" || format === "jpeg") {
    return "image";
  }
  return "archive";
}

function mimeTypeFromFormat(format: string): string {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    png: "image/png",
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg"
  };
  return types[format] ?? "application/octet-stream";
}

async function getOrderGenerationSummary(input: {
  order_id: string;
  repository: OrderGenerationRepository;
}) {
  const order = await input.repository.findOrder(input.order_id);
  if (!order) throw new Error("order_not_found");
  const orderItems = await input.repository.listOrderItemsByOrder(order.id);
  const manifest = orderItems[0]
    ? await input.repository.findManifestByOrderItem(order.id, orderItems[0].id)
    : null;
  const token = await input.repository.findDownloadTokenByOrder(order.id);
  return {
    order_number: order.order_number,
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    generation_manifest: manifest
      ? {
          manifest_id: manifest.id,
          manifest_status: manifest.manifest_status,
          expected_assets_count: manifest.expected_assets.length,
          generated_assets_count: manifest.generated_assets.length,
          failed_assets_count: manifest.failed_assets.length,
          meaning_profile: meaningProfileSummary(manifest.optional_assets),
          collection_content: collectionContentSummary(manifest.optional_assets)
        }
      : null,
    download_ready: Boolean(token && manifest?.manifest_status === "completed"),
    download_vault_available: Boolean(token),
    friendly_progress_status: friendlyProgress(order.fulfillment_status)
  };
}

function friendlyProgress(fulfillmentStatus: string): string {
  if (fulfillmentStatus === "completed") return "download_ready";
  if (fulfillmentStatus === "generating") return "generating_assets";
  if (fulfillmentStatus === "queued") return "generation_queued";
  return "waiting_for_generation";
}

function meaningProfileSummary(optionalAssets: unknown[] | undefined) {
  const attachment = (optionalAssets ?? []).find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  if (!isRecord(attachment)) return null;
  const profile = recordObject(attachment, "meaning_profile");
  if (!Object.keys(profile).length) return null;
  const validation = recordObject(profile, "validation");

  return {
    source_level: stringOrNull(profile.source_level),
    themes: recordArray(profile.meaning_themes).map((theme) => {
      const record = isRecord(theme) ? theme : {};
      return {
        theme: stringOrNull(record.theme),
        confidence: stringOrNull(record.confidence),
        evidence: stringOrNull(record.evidence)
      };
    }),
    symbols: recordArray(profile.symbol_choices).map((symbol) => {
      const record = isRecord(symbol) ? symbol : {};
      return {
        symbol: stringOrNull(record.symbol),
        meaning: stringOrNull(record.meaning),
        rationale: stringOrNull(record.rationale),
        source: stringOrNull(record.source)
      };
    }),
    design_rationale: stringArray(profile.design_rationale),
    story_direction: stringOrNull(profile.story_direction),
    certificate_direction: stringOrNull(profile.certificate_direction),
    boundary_statement: stringOrNull(profile.boundary_statement),
    validation: {
      valid: validation.valid === true,
      quality_flags: stringArray(validation.quality_flags),
      banned_claims_found: stringArray(validation.banned_claims_found)
    }
  };
}

function collectionContentSummary(optionalAssets: unknown[] | undefined) {
  const attachment = (optionalAssets ?? []).find(
    (item) => isRecord(item) && item.attachment_type === "meaning_engine"
  );
  if (!isRecord(attachment)) return null;
  const content = recordObject(attachment, "collection_content");
  if (!Object.keys(content).length) return null;
  return {
    house_meaning_summary: stringOrNull(content.house_meaning_summary),
    symbol_guide: recordArray(content.symbol_guide).map((symbol) => {
      const record = isRecord(symbol) ? symbol : {};
      return {
        symbol: stringOrNull(record.symbol),
        meaning: stringOrNull(record.meaning),
        why_chosen: stringOrNull(record.why_chosen),
        emotional_relevance: stringOrNull(record.emotional_relevance)
      };
    }),
    family_story: stringOrNull(content.family_story),
    certificate_text: stringOrNull(content.certificate_text),
    collection_letter: stringOrNull(content.collection_letter),
    design_basis: stringOrNull(content.design_basis),
    boundary_statement: stringOrNull(content.boundary_statement)
  };
}

function recordObject(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const child = value[key];
  return isRecord(child) ? child : {};
}

function recordArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeOrder(order: OrderRecord) {
  return {
    order_number: order.orderNumber,
    order_status: order.orderStatus,
    payment_status: order.paymentStatus,
    fulfillment_status: order.fulfillmentStatus,
    amount: {
      total_cents: Number(order.totalCents)
    },
    currency: order.currency
  };
}

function assertCustomerEmailCanBeEncrypted(): void {
  if (isCustomerPiiEncryptionConfigured()) {
    return;
  }

  throw new ApiException({
    errorCode: "customer_pii_encryption_not_configured",
    message: "CUSTOMER_PII_ENCRYPTION_KEY must be configured before creating paid orders.",
    userMessage: "We could not securely prepare delivery for this order. Please contact support.",
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    affectedField: "customer_email"
  });
}

function createOrderNumber(): string {
  return `AHL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${ulid().slice(0, 8)}`;
}

function throwPackageNotFound(packageCode: string): never {
  throw new ApiException({
    errorCode: "package_not_found",
    message: `Package not found: ${packageCode}`,
    userMessage: "The selected package is not available.",
    status: HttpStatus.NOT_FOUND,
    affectedField: "package_code"
  });
}
