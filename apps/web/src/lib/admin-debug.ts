import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";

import { prisma } from "@ai-heritage/database";

type SearchParams = Record<string, string | string[] | undefined>;

export interface AdminAccess {
  authorized: boolean;
  configured: boolean;
  token: string;
  reason?: string;
}

export interface AdminOrderSummary {
  order_id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  order_status: string;
  fulfillment_status: string;
  total: string;
  asset_count: number;
  expected_asset_count: number;
  generated_asset_count: number;
  download_ready: boolean;
  email_log_count: number;
  customer_pii_status: AdminCustomerPiiStatus;
  meaning_profile: AdminMeaningProfileSummary | null;
  collection_content_status: AdminCollectionContentStatus;
}

export interface AdminCustomerPiiStatus {
  present: boolean;
  payload_format: "encrypted" | "placeholder" | "malformed" | "missing";
  decryptable: boolean;
  order_id_matches: boolean;
}

export interface AdminCollectionContentStatus {
  exists: boolean;
  summary_exists: boolean;
  symbol_guide_exists: boolean;
  family_story_exists: boolean;
  certificate_text_exists: boolean;
  collection_letter_exists: boolean;
  design_basis_exists: boolean;
}

export interface AdminMeaningProfileSummary {
  source_level: string;
  themes: Array<{ theme: string; confidence: string; evidence: string }>;
  symbols: Array<{ symbol: string; meaning: string; rationale: string; source: string }>;
  design_rationale: string[];
  story_direction: string;
  certificate_direction: string;
  boundary_statement: string;
  validation_valid: boolean;
  quality_flags: string[];
}

export interface AdminEmailLogSummary {
  email_log_id: string;
  order_number: string;
  provider: string;
  status: string;
  recipient_masked: string;
  recipient_source: string;
  delivery_test_mode: boolean;
  intended_recipient_masked: string;
  actual_recipient_masked: string;
  subject: string;
  created_at: string;
  sent_at: string | null;
  delivery_metadata: string;
  error_message: string | null;
}

export interface AdminDownloadTokenSummary {
  token_id: string;
  order_number: string;
  token_hash_prefix: string;
  status: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  asset_count: number;
  download_count: number;
}

export interface FounderEditionDashboard {
  checkout_enabled: boolean;
  review_required: boolean;
  order_limit: number;
  paid_orders: number;
  remaining_slots: number;
  tracked_visitors: number;
  real_examples_visits: number;
  questionnaire_starts: number;
  checkout_starts: number;
  successful_deliveries: number;
  vault_opens: number;
  downloads: number;
  refunds: number;
  p0_issues: number;
  pending_founder_reviews: number;
}

export function getAdminAccess(searchParams: SearchParams): AdminAccess {
  const configuredToken = process.env.ADMIN_ACCESS_TOKEN?.trim();
  const providedToken = stringParam(searchParams.token);
  const tokenCandidates = tokenCandidatesFromQuery(providedToken);

  if (!configuredToken || configuredToken.startsWith("replace_with_")) {
    return {
      authorized: false,
      configured: false,
      token: providedToken,
      reason: "ADMIN_ACCESS_TOKEN is not configured."
    };
  }

  if (!providedToken) {
    return {
      authorized: false,
      configured: true,
      token: "",
      reason: "Add ?token=YOUR_ADMIN_ACCESS_TOKEN to view this internal debug page."
    };
  }

  return {
    authorized: tokenCandidates.some((candidate) => safeCompare(candidate, configuredToken)),
    configured: true,
    token: providedToken,
    reason:
      "The provided admin token did not match. If the token contains +, #, &, or =, URL-encode it before opening the page."
  };
}

export async function getRecentOrders(): Promise<AdminOrderSummary[]> {
  const orders = await prisma.order.findMany({
    take: 40,
    orderBy: { createdAt: "desc" },
    include: {
      assets: { select: { id: true } },
      downloadTokens: { select: { status: true } },
      emailLogs: { select: { id: true } },
      orderCustomerPii: {
        select: {
          orderId: true,
          emailEncrypted: true
        }
      },
      generationManifests: {
        select: {
          expectedAssetsJson: true,
          generatedAssetsJson: true,
          optionalAssetsJson: true
        }
      }
    }
  });

  return orders.map((order) => {
    const manifest = order.generationManifests[0];
    const expectedAssets = arrayFromJson(manifest?.expectedAssetsJson);
    const generatedAssets = arrayFromJson(manifest?.generatedAssetsJson);

    return {
      order_id: order.id,
      order_number: order.orderNumber,
      created_at: order.createdAt.toISOString(),
      payment_status: order.paymentStatus,
      order_status: order.orderStatus,
      fulfillment_status: order.fulfillmentStatus,
      total: `${order.currency} ${formatCents(order.totalCents)}`,
      asset_count: order.assets.length,
      expected_asset_count: expectedAssets.length,
      generated_asset_count: generatedAssets.length,
      download_ready: order.downloadTokens.some((token) => token.status === "active"),
      email_log_count: order.emailLogs.length,
      customer_pii_status: summarizeCustomerPii(order.id, order.orderCustomerPii),
      meaning_profile: summarizeMeaningProfile(manifest?.optionalAssetsJson),
      collection_content_status: summarizeCollectionContentStatus(manifest?.optionalAssetsJson)
    };
  });
}

export async function getRecentEmailLogs(): Promise<AdminEmailLogSummary[]> {
  const logs = await prisma.emailLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true } }
    }
  });

  return logs.map((log) => {
    const payload = objectFromJson(log.payloadJson);
    return {
      email_log_id: log.id,
      order_number: log.order?.orderNumber ?? "not linked",
      provider: log.provider,
      status: log.status,
      recipient_masked: maskHash(log.recipientEmailHash),
      recipient_source: stringValue(payload.recipient_source) ?? "unknown",
      delivery_test_mode: payload.delivery_test_mode === true,
      intended_recipient_masked: maskHashOrDash(stringValue(payload.intended_recipient_hash)),
      actual_recipient_masked: maskHashOrDash(
        stringValue(payload.actual_recipient_hash) ?? log.recipientEmailHash
      ),
      subject: stringValue(payload.subject) ?? "Your MyKinLegacy Private Vault Is Ready",
      created_at: log.createdAt.toISOString(),
      sent_at: log.sentAt?.toISOString() ?? null,
      delivery_metadata: summarizeDeliveryPayload(payload),
      error_message: log.errorMessage
    };
  });
}

export async function getRecentDownloadTokens(): Promise<AdminDownloadTokenSummary[]> {
  const tokens = await prisma.downloadToken.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true } },
      _count: { select: { downloadTokenAssets: true } }
    }
  });

  return tokens.map((token) => ({
    token_id: token.id,
    order_number: token.order.orderNumber,
    token_hash_prefix: `${token.tokenHash.slice(0, 10)}...`,
    status: token.status,
    created_at: token.createdAt.toISOString(),
    expires_at: token.expiresAt.toISOString(),
    revoked_at: token.revokedAt?.toISOString() ?? null,
    asset_count: token._count.downloadTokenAssets,
    download_count: token.downloadCount
  }));
}

export async function getFounderEditionDashboard(): Promise<FounderEditionDashboard> {
  const startAt = validDate(process.env.FOUNDER_EDITION_START_AT) ?? new Date("2026-07-01T00:00:00.000Z");
  const orderLimit = positiveInteger(process.env.FOUNDER_EDITION_ORDER_LIMIT, 25);
  const [orders, auditLogs, vaultOpens, downloads, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: startAt } },
      select: {
        paymentStatus: true,
        orderStatus: true,
        fulfillmentStatus: true,
        metadataJson: true,
        emailLogs: { select: { provider: true, status: true } },
        downloadTokens: { select: { status: true } }
      }
    }),
    prisma.auditLog.findMany({
      where: { entityType: "conversion_funnel", createdAt: { gte: startAt } },
      select: { action: true, ipHash: true, metadataJson: true }
    }),
    prisma.downloadEvent.count({ where: { eventType: "page_view", createdAt: { gte: startAt } } }),
    prisma.downloadEvent.count({ where: { eventType: "file_download", createdAt: { gte: startAt } } }),
    prisma.refund.count({ where: { createdAt: { gte: startAt } } })
  ]);

  const founderOrders = orders.filter(
    (order) => objectFromJson(order.metadataJson).founder_edition === true
  );
  const paidOrders = founderOrders.filter((order) => order.paymentStatus === "paid");
  const successfulDeliveries = paidOrders.filter(
    (order) =>
      order.orderStatus === "completed" &&
      order.fulfillmentStatus === "completed" &&
      order.downloadTokens.some((token) => token.status === "active") &&
      order.emailLogs.some((log) => log.provider === "resend" && log.status === "sent")
  ).length;
  const pendingFounderReviews = founderOrders.filter(
    (order) => objectFromJson(order.metadataJson).founder_review_status === "pending"
  ).length;
  const p0Issues = paidOrders.filter(
    (order) => order.orderStatus === "failed" || order.fulfillmentStatus === "failed"
  ).length;
  const eventCount = (action: string, stepName?: string) =>
    auditLogs.filter((log) => {
      if (log.action !== action) return false;
      if (!stepName) return true;
      return stringValue(objectFromJson(log.metadataJson).step_name) === stepName;
    }).length;
  const visitorKeys = new Set(
    auditLogs
      .filter((log) => log.action === "funnel_step_viewed")
      .map((log, index) => log.ipHash ?? `anonymous-${index}`)
  );

  return {
    checkout_enabled: process.env.CHECKOUT_ENABLED?.trim().toLowerCase() !== "false",
    review_required: process.env.FOUNDER_REVIEW_REQUIRED?.trim().toLowerCase() === "true",
    order_limit: orderLimit,
    paid_orders: paidOrders.length,
    remaining_slots: Math.max(0, orderLimit - paidOrders.length),
    tracked_visitors: visitorKeys.size,
    real_examples_visits: eventCount("funnel_step_viewed", "real_examples"),
    questionnaire_starts: eventCount("funnel_step_viewed", "create_page"),
    checkout_starts: eventCount("checkout_started"),
    successful_deliveries: successfulDeliveries,
    vault_opens: vaultOpens,
    downloads,
    refunds,
    p0_issues: p0Issues,
    pending_founder_reviews: pendingFounderReviews
  };
}

export function emailProviderSummary() {
  const provider = process.env.EMAIL_PROVIDER ?? "unset";
  const normalized = provider.toLowerCase();
  return {
    provider,
    externalSendingEnabled:
      normalized === "resend" || normalized === "sendgrid" || normalized === "ses",
    testMode: process.env.EMAIL_DELIVERY_TEST_MODE === "true",
    testRecipientConfigured: Boolean(process.env.EMAIL_TEST_RECIPIENT)
  };
}

function stringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function tokenCandidatesFromQuery(value: string): string[] {
  const trimmed = value.trim();
  const candidates = new Set<string>();

  if (trimmed) {
    candidates.add(trimmed);
    candidates.add(trimmed.replaceAll(" ", "+"));
  }

  return [...candidates];
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(sha256(a));
  const right = Buffer.from(sha256(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatCents(value: bigint): string {
  return (Number(value) / 100).toFixed(2);
}

function arrayFromJson(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function maskHash(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maskHashOrDash(value: string | null): string {
  return value ? maskHash(value) : "-";
}

function summarizeDeliveryPayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (payload.delivery_test_mode === true) {
    parts.push("test_mode=true");
  } else if (payload.delivery_test_mode === false) {
    parts.push("test_mode=false");
  }
  const recipientSource = stringValue(payload.recipient_source);
  if (recipientSource) {
    parts.push(`recipient_source=${recipientSource}`);
  }
  if (payload.recipient_override_active === true) {
    parts.push("recipient_override_active=true");
  }
  const downloadTokenId = stringValue(payload.download_token_id);
  if (downloadTokenId) {
    parts.push(`download_token_id=${downloadTokenId.slice(0, 8)}...`);
  }
  if (payload.masked_download_vault_link) {
    parts.push("masked_vault_link_present=true");
  }
  if (payload.raw_token_present === false) {
    parts.push("raw_token_present=false");
  }
  if (payload.vault_link_only === true) {
    parts.push("vault_link_only=true");
  }
  return parts.length > 0 ? parts.join("; ") : "no sensitive payload exposed";
}

function summarizeCustomerPii(
  orderId: string,
  pii: { orderId: string; emailEncrypted: Buffer | Uint8Array } | null
): AdminCustomerPiiStatus {
  return {
    present: Boolean(pii),
    payload_format: piiPayloadFormat(pii?.emailEncrypted ?? null),
    decryptable: decryptableEmailPayload(pii?.emailEncrypted ?? null),
    order_id_matches: pii?.orderId === orderId
  };
}

function piiPayloadFormat(value: Buffer | Uint8Array | null): AdminCustomerPiiStatus["payload_format"] {
  if (!value) return "missing";
  const serialized = Buffer.from(value).toString("utf8");
  if (serialized.startsWith("enc:v1:")) return "encrypted";
  if (serialized.startsWith("placeholder:v1:")) return "placeholder";
  return "malformed";
}

function decryptableEmailPayload(value: Buffer | Uint8Array | null): boolean {
  if (!value || piiPayloadFormat(value) !== "encrypted") return false;
  const [, , ivBase64, tagBase64, ciphertextBase64] = Buffer.from(value).toString("utf8").split(":");
  const rawKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY ?? process.env.PII_ENCRYPTION_KEY;
  if (
    !rawKey ||
    rawKey === "disabled" ||
    rawKey === "replace_me" ||
    rawKey.startsWith("replace_with_") ||
    !ivBase64 ||
    !tagBase64 ||
    !ciphertextBase64
  ) {
    return false;
  }
  try {
    const key = createHash("sha256").update(rawKey).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64url"));
    Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64url")),
      decipher.final()
    ]).toString("utf8");
    return true;
  } catch {
    return false;
  }
}

function summarizeMeaningProfile(optionalAssetsJson: unknown): AdminMeaningProfileSummary | null {
  const attachment = arrayFromJson(optionalAssetsJson).find(
    (item) => objectFromJson(item).attachment_type === "meaning_engine"
  );
  const profile = objectFromJson(objectFromJson(attachment).meaning_profile);
  if (!Object.keys(profile).length) return null;

  const validation = objectFromJson(profile.validation);
  return {
    source_level: stringValue(profile.source_level) ?? "unknown",
    themes: arrayFromJson(profile.meaning_themes).map((item) => {
      const theme = objectFromJson(item);
      return {
        theme: stringValue(theme.theme) ?? "unknown",
        confidence: stringValue(theme.confidence) ?? "unknown",
        evidence: stringValue(theme.evidence) ?? ""
      };
    }),
    symbols: arrayFromJson(profile.symbol_choices).map((item) => {
      const symbol = objectFromJson(item);
      return {
        symbol: stringValue(symbol.symbol) ?? "unknown",
        meaning: stringValue(symbol.meaning) ?? "",
        rationale: stringValue(symbol.rationale) ?? "",
        source: stringValue(symbol.source) ?? "unknown"
      };
    }),
    design_rationale: arrayFromJson(profile.design_rationale).filter(
      (item): item is string => typeof item === "string"
    ),
    story_direction: stringValue(profile.story_direction) ?? "",
    certificate_direction: stringValue(profile.certificate_direction) ?? "",
    boundary_statement: stringValue(profile.boundary_statement) ?? "",
    validation_valid: validation.valid === true,
    quality_flags: arrayFromJson(validation.quality_flags).filter(
      (item): item is string => typeof item === "string"
    )
  };
}

function summarizeCollectionContentStatus(optionalAssetsJson: unknown): AdminCollectionContentStatus {
  const attachment = arrayFromJson(optionalAssetsJson).find(
    (item) => objectFromJson(item).attachment_type === "meaning_engine"
  );
  const content = objectFromJson(objectFromJson(attachment).collection_content);
  const symbolGuide = arrayFromJson(content.symbol_guide);
  return {
    exists: Object.keys(content).length > 0,
    summary_exists: Boolean(stringValue(content.house_meaning_summary)),
    symbol_guide_exists: symbolGuide.length > 0,
    family_story_exists: Boolean(stringValue(content.family_story)),
    certificate_text_exists: Boolean(stringValue(content.certificate_text)),
    collection_letter_exists: Boolean(stringValue(content.collection_letter)),
    design_basis_exists: Boolean(stringValue(content.design_basis))
  };
}
