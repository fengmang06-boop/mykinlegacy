import { createHash, timingSafeEqual } from "node:crypto";

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
}

export interface AdminEmailLogSummary {
  email_log_id: string;
  order_number: string;
  provider: string;
  status: string;
  recipient_masked: string;
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

export function getAdminAccess(searchParams: SearchParams): AdminAccess {
  const configuredToken = process.env.ADMIN_ACCESS_TOKEN;
  const providedToken = stringParam(searchParams.token);

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
    authorized: safeCompare(providedToken, configuredToken),
    configured: true,
    token: providedToken,
    reason: "The provided admin token did not match."
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
      generationManifests: {
        select: {
          expectedAssetsJson: true,
          generatedAssetsJson: true
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
      email_log_count: order.emailLogs.length
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

function maskHash(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function summarizeDeliveryPayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
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
