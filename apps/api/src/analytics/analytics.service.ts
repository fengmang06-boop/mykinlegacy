import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ulid } from "ulid";

import { PrismaService } from "../database/prisma.service";

interface AnalyticsDb {
  order: {
    findUnique(input: unknown): Promise<{ id: string; orderNumber: string } | null>;
  };
  auditLog: {
    create(input: unknown): Promise<unknown>;
  };
}

const ALLOWED_EVENTS = new Set([
  "funnel_step_viewed",
  "funnel_step_completed",
  "checkout_started",
  "checkout_completed",
  "payment_success",
  "vault_opened",
  "email_sent_confirmed",
  "artifact_downloaded"
]);

const BLOCKED_KEYS = new Set([
  "email",
  "customer_email",
  "raw_email",
  "download_token",
  "token",
  "vault_token",
  "raw_token",
  "signed_url",
  "storage_key",
  "storage_bucket",
  "payment_secret",
  "api_key",
  "secret",
  "private_notes",
  "family_story",
  "raw_prompt",
  "rendered_prompt"
]);

export interface AnalyticsEventInput {
  event_name?: unknown;
  order_id?: unknown;
  order_number?: unknown;
  step_name?: unknown;
  duration_ms?: unknown;
  metadata?: unknown;
  client_timestamp?: unknown;
}

export interface AnalyticsRequestSignals {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly db: AnalyticsDb;

  constructor(prismaService: PrismaService) {
    this.db = prismaService.db as unknown as AnalyticsDb;
  }

  async track(input: AnalyticsEventInput, signals: AnalyticsRequestSignals = {}) {
    const eventName = stringValue(input.event_name);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      throw new BadRequestException("Unsupported analytics event.");
    }

    const stepName = stringValue(input.step_name) ?? eventName;
    const orderNumber = stringValue(input.order_number);
    const inputOrderId = stringValue(input.order_id);
    const durationMs = numberValue(input.duration_ms);
    const clientTimestamp = stringValue(input.client_timestamp);
    const order = await this.findOrder(inputOrderId, orderNumber);
    const now = new Date();

    await this.db.auditLog.create({
      data: {
        id: ulid(),
        actorType: "customer",
        actorId: null,
        action: eventName,
        entityType: "conversion_funnel",
        entityId: order?.id ?? (isUlid(inputOrderId) ? inputOrderId : null),
        ipHash: signals.ip ? sha256(signals.ip) : null,
        beforeJson: null,
        afterJson: null,
        metadataJson: {
          contract_version: "1.0",
          order_id: order?.id ?? (isUlid(inputOrderId) ? inputOrderId : null),
          order_number: order?.orderNumber ?? orderNumber ?? null,
          timestamp: now.toISOString(),
          client_timestamp: clientTimestamp,
          step_name: stepName,
          duration_ms: durationMs,
          user_agent_hash: signals.userAgent ? sha256(signals.userAgent) : null,
          metadata: sanitizeRecord(input.metadata)
        },
        createdAt: now
      }
    });

    return {
      accepted: true,
      event_name: eventName,
      step_name: stepName
    };
  }

  private async findOrder(orderId?: string, orderNumber?: string) {
    if (orderId && isUlid(orderId)) {
      return this.db.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true }
      });
    }
    if (orderNumber) {
      return this.db.order.findUnique({
        where: { orderNumber },
        select: { id: true, orderNumber: true }
      });
    }
    return null;
  }
}

function sanitizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (BLOCKED_KEYS.has(normalizedKey) || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
      continue;
    }
    sanitized[key] = sanitizeValue(rawValue);
  }
  return sanitized;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 160)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeRecord(value);
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 160) : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.round(value));
}

function isUlid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
