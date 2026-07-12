import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ulid } from "ulid";

import { ApiException } from "../common/api-error";
import {
  decryptEmailFromStorageForVerification,
  hashEmail,
  encryptEmailForStorageStrict,
  isCustomerPiiEncryptionConfigured,
  isValidEncryptedEmailPayload
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
  orderCustomerPii: {
    create: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<OrderCustomerPiiRecord | null>;
  };
  houseIdentityVersion: { findUnique: (args: unknown) => Promise<HouseIdentityVersionRecord | null> };
  houseInterview: { findUnique: (args: unknown) => Promise<HouseInterviewRecord | null> };
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

interface HouseInterviewRecord {
  id: string;
  houseId: string | null;
  answersJson: unknown;
}

interface ConsentRecord {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
  heritageDisclaimerAccepted: boolean;
  aiGenerationConsent: boolean;
  emailDeliveryConsent: boolean;
}

interface OrderCustomerPiiRecord {
  orderId: string;
  emailEncrypted: Buffer | Uint8Array | null;
  emailHash: string | null;
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

type CustomerDeliveryStatus =
  | "preparing"
  | "vault_ready"
  | "email_delivery_attention"
  | "artifact_generation_failed"
  | "failed";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
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
    const customerEmailHash = hashEmail(customerEmail);
    const encryptedCustomerEmail = this.encryptCustomerEmailOrThrow(customerEmail, customerEmailHash);
    const product = await this.findProductWithPackage(productCode, packageCode);
    const identityVersion = await this.findIdentityVersion(identityVersionId, houseId);
    const interview = await this.prisma.houseInterview.findUnique({ where: { id: interviewId } });
    if (!interview || (interview.houseId !== null && interview.houseId !== houseId)) {
      throw new ApiException({
        errorCode: "interview_not_found",
        message: `Interview not found for order: ${interviewId}`,
        userMessage: "The guided interview could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "interview_id"
      });
    }
    const customerInputs = customerInputsFromInterview(interview.answersJson);
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
            identity_version_id: identityVersionId,
            ...(founderEditionMetadata())
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
            house_dna: identityVersion.houseDnaSnapshotJson,
            customer_inputs: customerInputs
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
          emailEncrypted: encryptedCustomerEmail,
          emailHash: customerEmailHash,
          nameEncrypted: null,
          billingCountry: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });
      const persistedPii = await transaction.orderCustomerPii.findUnique({
        where: { orderId: createdOrder.id }
      });
      this.assertPersistedCustomerEmailPii({
        pii: persistedPii,
        orderId: createdOrder.id,
        customerEmailHash
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
      customer_delivery_status: response.customer_delivery_status,
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

  private encryptCustomerEmailOrThrow(customerEmail: string, customerEmailHash: string): Buffer {
    if (!isCustomerPiiEncryptionConfigured()) {
      this.logger.error("ORDER_REJECTED_INVALID_EMAIL", {
        reason: "customer_pii_encryption_not_configured",
        customer_email_hash: customerEmailHash
      });
      throwCustomerEmailEncryptionError("CUSTOMER_PII_ENCRYPTION_KEY must be configured before creating paid orders.");
    }

    try {
      const encrypted = encryptEmailForStorageStrict(customerEmail);
      if (!isValidEncryptedEmailPayload(encrypted)) {
        throw new Error("invalid_encrypted_email_payload");
      }
      this.logger.log("EMAIL_ENCRYPTION_SUCCESS", {
        customer_email_hash: customerEmailHash,
        encrypted_payload_format: "enc:v1"
      });
      return encrypted;
    } catch (error) {
      this.logger.error("EMAIL_ENCRYPTION_FAILED", {
        reason: error instanceof Error ? error.message : "customer_email_encryption_failed",
        customer_email_hash: customerEmailHash
      });
      this.logger.error("ORDER_REJECTED_INVALID_EMAIL", {
        reason: "customer_email_encryption_failed",
        customer_email_hash: customerEmailHash
      });
      throwCustomerEmailEncryptionError("Customer email encryption failed before order creation.");
    }
  }

  private assertPersistedCustomerEmailPii(input: {
    pii: OrderCustomerPiiRecord | null;
    orderId: string;
    customerEmailHash: string;
  }) {
    const emailEncrypted = toBuffer(input.pii?.emailEncrypted ?? null);
    if (
      !input.pii ||
      input.pii.orderId !== input.orderId ||
      input.pii.emailHash !== input.customerEmailHash ||
      !isValidEncryptedEmailPayload(emailEncrypted) ||
      !decryptEmailFromStorageForVerification(emailEncrypted)
    ) {
      this.logger.error("ORDER_REJECTED_INVALID_EMAIL", {
        reason: "customer_pii_post_write_verification_failed",
        order_id: input.orderId,
        customer_email_hash: input.customerEmailHash,
        customer_pii_row_exists: Boolean(input.pii),
        pii_order_id_matches: input.pii?.orderId === input.orderId,
        encrypted_payload_format: isValidEncryptedEmailPayload(emailEncrypted) ? "enc:v1" : "invalid",
        customer_email_decryptable: Boolean(decryptEmailFromStorageForVerification(emailEncrypted))
      });
      throwCustomerEmailEncryptionError("Customer email PII was not persisted correctly for this order.");
    }
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
  const complete =
    actualArtifacts.length > 0 &&
    missingArtifacts.length === 0 &&
    actualArtifacts.every((artifact) => artifact.available);
  const customerDeliveryStatus = customerDeliveryStatusFor({
    payment_status: context.order.payment_status,
    fulfillment_status: context.order.fulfillment_status,
    manifest_status: context.manifest?.manifest_status ?? null,
    failed_assets_count: context.manifest?.failed_assets.length ?? 0,
    vault_ready: vaultReady,
    artifacts_downloadable: complete
  });

  return {
    order_number: context.order.order_number,
    order_status: context.order.order_status,
    payment_status: context.order.payment_status,
    fulfillment_status: context.order.fulfillment_status,
    manifest_status: context.manifest?.manifest_status ?? null,
    customer_delivery_status: customerDeliveryStatus,
    status: complete ? "ready" : customerDeliveryStatus,
    message: customerDeliveryMessage(customerDeliveryStatus),
    download_ready: vaultReady && complete,
    vault_ready: vaultReady && complete,
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
  const available = isArtifactAvailable(asset);
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
    available,
    access: {
      download_method: "private_vault_link_required",
      signed_url_endpoint: null,
      raw_token_exposed: false
    },
    message: available ? null : artifactUnavailableMessage(asset)
  };
}

function isArtifactAvailable(asset: OrderArtifactRecord) {
  return (
    asset.public_url === null &&
    (asset.status === "available" || asset.status === "available_for_download") &&
    asset.size_bytes >= minimumArtifactBytes(asset.file_ext)
  );
}

function artifactUnavailableMessage(asset: OrderArtifactRecord): string {
  if (asset.size_bytes > 0 && asset.size_bytes < minimumArtifactBytes(asset.file_ext)) {
    return "Artifact file is not ready";
  }
  return "Generation in progress";
}

function friendlyDeliverableName(code: string): string {
  const names: Record<string, string> = {
    crest_variant_1_png: "Final Crest",
    symbol_explanation_pdf: "Meaning Behind Your Crest",
    heritage_certificate_pdf: "Heritage Certificate",
    family_story_pdf: "Family Story",
    download_package_zip: "Complete Collection"
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

function minimumArtifactBytes(fileExt: string): number {
  if (fileExt === "zip") return 20 * 1024;
  if (fileExt === "png" || fileExt === "pdf") return 10 * 1024;
  return 1024;
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
  const assets = input.repository.listAssetsByOrder ? await input.repository.listAssetsByOrder(order.id) : [];
  const expectedArtifacts = expectedArtifactEntries(manifest?.expected_assets ?? []);
  const actualArtifacts = assets.map(mapOrderArtifact);
  const actualCodes = new Set(actualArtifacts.map((artifact) => artifact.deliverable_code));
  const missingArtifacts = expectedArtifacts.filter((artifact) => !actualCodes.has(artifact.deliverable_code));
  const vaultReady = Boolean(token && manifest?.manifest_status === "completed");
  const artifactsDownloadable =
    actualArtifacts.length > 0 &&
    missingArtifacts.length === 0 &&
    actualArtifacts.every((artifact) => artifact.available);
  const customerDeliveryStatus = customerDeliveryStatusFor({
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    manifest_status: manifest?.manifest_status ?? null,
    failed_assets_count: manifest?.failed_assets.length ?? 0,
    vault_ready: vaultReady,
    artifacts_downloadable: artifactsDownloadable
  });
  return {
    order_number: order.order_number,
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    customer_delivery_status: customerDeliveryStatus,
    customer_delivery_message: customerDeliveryMessage(customerDeliveryStatus),
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
    download_ready: vaultReady && artifactsDownloadable,
    download_vault_available: Boolean(token),
    friendly_progress_status: customerDeliveryStatus
  };
}

function customerDeliveryStatusFor(input: {
  payment_status: string;
  fulfillment_status: string;
  manifest_status: string | null;
  failed_assets_count: number;
  vault_ready: boolean;
  artifacts_downloadable: boolean;
}): CustomerDeliveryStatus {
  if (input.payment_status !== "paid") return "preparing";
  if (input.vault_ready && input.artifacts_downloadable) {
    return input.fulfillment_status === "failed" ? "email_delivery_attention" : "vault_ready";
  }
  if (
    input.manifest_status === "failed" ||
    input.failed_assets_count > 0 ||
    (input.fulfillment_status === "failed" && !input.artifacts_downloadable)
  ) {
    return "artifact_generation_failed";
  }
  if (input.fulfillment_status === "failed") return "failed";
  return "preparing";
}

function customerDeliveryMessage(status: CustomerDeliveryStatus): string {
  const messages: Record<CustomerDeliveryStatus, string> = {
    preparing: "Preparing your collection.",
    vault_ready: "Your private vault is ready.",
    email_delivery_attention: "Vault ready. Delivery email needs attention.",
    artifact_generation_failed: "Collection preparation failed.",
    failed: "We need to review your order."
  };
  return messages[status];
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

function founderEditionMetadata(): Record<string, unknown> {
  if (process.env.FOUNDER_EDITION_ENABLED?.trim().toLowerCase() !== "true") return {};
  return {
    founder_edition: true,
    founder_edition_launch: "early_access_v1",
    founder_review_status: process.env.FOUNDER_REVIEW_REQUIRED === "true" ? "pending" : "not_required"
  };
}

function customerInputsFromInterview(answersJson: unknown): {
  recipient: string | null;
  occasion: string | null;
  family_memories: string[];
} {
  const answers = Array.isArray(answersJson) ? answersJson.filter(isRecord) : [];
  const answerFor = (stepCode: string) =>
    answers.find((answer) => stringOrNull(answer.step_code) === stepCode);
  const rawAnswerFor = (stepCode: string) => recordObject(answerFor(stepCode), "raw_answer");
  const selectedFor = (stepCode: string) => stringArray(rawAnswerFor(stepCode).selected_options);
  const freeTextFor = (stepCode: string) => stringOrNull(rawAnswerFor(stepCode).free_text);

  const relationship = selectedFor("name_your_house")[0] ?? null;
  const recipient = freeTextFor("name_your_house") ?? recipientLabel(relationship);
  const occasion = selectedFor("where_story_begins")[0] ?? freeTextFor("where_story_begins");
  const memory = freeTextFor("where_story_begins");

  return {
    recipient,
    occasion,
    family_memories: memory && memory !== occasion ? [memory] : []
  };
}

function recipientLabel(value: string | null): string | null {
  if (!value) return null;
  const labels: Record<string, string> = {
    "My father": "Father",
    "My mother": "Mother",
    "My parents": "My Parents",
    "A grandparent": "Grandparent",
    "A couple": "The Couple",
    "Our whole family": "Our Family"
  };
  return labels[value] ?? value;
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

function throwCustomerEmailEncryptionError(message: string): never {
  throw new ApiException({
    errorCode: "customer_pii_encryption_not_configured",
    message,
    userMessage: "We could not securely prepare delivery for this order. Please contact support.",
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    affectedField: "customer_email"
  });
}

function toBuffer(value: Buffer | Uint8Array | null): Buffer | null {
  if (!value) return null;
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
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
