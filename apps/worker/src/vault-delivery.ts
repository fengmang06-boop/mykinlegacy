import { createDecipheriv, createHash, randomBytes } from "node:crypto";

interface WorkerEmailProviderAdapter {
  provider_code: "mock" | "resend" | "sendgrid" | "ses";
}

interface EmailModule {
  createEmailProviderFromEnv(env: Record<string, string | undefined>): WorkerEmailProviderAdapter;
  sendDeliveryEmailJob(input: unknown, dependencies: unknown): Promise<{
    email_log_id: string;
    status: "sent" | "failed" | "bounced";
  }>;
}

type PrismaDelegate = {
  findUnique(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
};

export type VaultDeliveryDb = {
  orderCustomerPii: PrismaDelegate;
  emailLog: PrismaDelegate;
};

export interface VaultDeliveryInput {
  db: VaultDeliveryDb;
  emailModule: EmailModule;
  order_id: string;
  order_number: string;
  download_token_id: string;
  raw_token_for_email_only?: string;
  expires_at: string | Date;
  env?: Record<string, string | undefined>;
  log?: (input: {
    level: "info" | "warn" | "error";
    message:
      | "EMAIL_JOB_CREATED"
      | "EMAIL_TRIGGERED"
      | "EMAIL_SKIPPED_REASON"
      | "delivery_attempt_start"
      | "delivery_recipient_source"
      | "resend_provider_selected"
      | "resend_send_start"
      | "resend_send_success"
      | "delivery_failure_reason";
    extra?: Record<string, unknown>;
  }) => void;
}

export async function sendVaultReadyEmail(input: VaultDeliveryInput): Promise<{
  status: "sent" | "failed" | "bounced";
  email_log_id: string | null;
  recipient_source: "customer_pii" | "test_recipient" | "unavailable";
  raw_token_omitted: true;
}> {
  const env = input.env ?? process.env;
  input.log?.({
    level: "info",
    message: "delivery_attempt_start",
    extra: {
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      raw_token_available: Boolean(input.raw_token_for_email_only),
      raw_token_omitted: true
    }
  });
  const recipient = await resolveRecipient(input.db, input.order_id, env);
  if (!recipient.email) {
    input.log?.({
      level: "warn",
      message: "EMAIL_SKIPPED_REASON",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: recipient.reason ?? "delivery_recipient_unavailable",
        recipient_source: "unavailable",
        raw_token_omitted: true
      }
    });
    input.log?.({
      level: "error",
      message: "delivery_failure_reason",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: recipient.reason ?? "delivery_recipient_unavailable",
        raw_token_omitted: true
      }
    });
    await createFailedEmailLog({
      db: input.db,
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      recipient_email_hash: recipient.email_hash ?? sha256(`${input.order_id}:recipient_unavailable`),
      error_message: recipient.reason ?? "delivery_recipient_unavailable"
    });
    return {
      status: "failed",
      email_log_id: null,
      recipient_source: "unavailable",
      raw_token_omitted: true
    };
  }

  let result: Awaited<ReturnType<EmailModule["sendDeliveryEmailJob"]>>;
  try {
    const provider = input.emailModule.createEmailProviderFromEnv(env);
    input.log?.({
      level: "info",
      message: "delivery_recipient_source",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        recipient_source: recipient.source,
        delivery_test_mode: recipient.test_mode,
        intended_recipient_hash: recipient.intended_email_hash,
        actual_recipient_hash: sha256(recipient.email.trim().toLowerCase()),
        raw_token_omitted: true
      }
    });
    input.log?.({
      level: "info",
      message: "resend_provider_selected",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        provider: provider.provider_code,
        expected_resend: !recipient.test_mode,
        raw_token_omitted: true
      }
    });
    if (!recipient.test_mode && env.NODE_ENV === "production" && provider.provider_code === "mock") {
      throw new Error("live_email_provider_mock_not_allowed");
    }
    input.log?.({
      level: "info",
      message: "EMAIL_JOB_CREATED",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        provider: provider.provider_code,
        recipient_source: recipient.source,
        delivery_test_mode: recipient.test_mode,
        intended_recipient_hash: recipient.intended_email_hash,
        actual_recipient_hash: sha256(recipient.email.trim().toLowerCase()),
        download_token_id: input.download_token_id,
        raw_token_omitted: true
      }
    });
    if (provider.provider_code === "resend") {
      input.log?.({
        level: "info",
        message: "resend_send_start",
        extra: {
          order_id: input.order_id,
          order_number: input.order_number,
          recipient_source: recipient.source,
          delivery_test_mode: recipient.test_mode,
          download_token_id: input.download_token_id,
          raw_token_omitted: true
        }
      });
    }
    result = await input.emailModule.sendDeliveryEmailJob(
      {
        order_id: input.order_id,
        order_number: input.order_number,
        download_token_id: input.download_token_id,
        raw_token_for_internal_delivery_only: input.raw_token_for_email_only,
        recipient_email: recipient.email,
        recipient_source: recipient.source,
        delivery_test_mode: recipient.test_mode,
        intended_recipient_hash: recipient.intended_email_hash,
        actual_recipient_hash: sha256(recipient.email.trim().toLowerCase()),
        expires_at: input.expires_at,
        app_web_url: siteUrl(env),
        email_from: env.EMAIL_FROM,
        email_reply_to: env.EMAIL_REPLY_TO ?? env.EMAIL_FROM
      },
      {
        provider,
        emailLogRepository: new PrismaEmailLogRepository(input.db)
      }
    );
    input.log?.({
      level: result.status === "sent" ? "info" : "error",
      message: result.status === "sent" ? "EMAIL_TRIGGERED" : "EMAIL_SKIPPED_REASON",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        provider: provider.provider_code,
        delivery_status: result.status,
        recipient_source: recipient.source,
        delivery_test_mode: recipient.test_mode,
        download_token_id: input.download_token_id,
        raw_token_omitted: true
      }
    });
    if (provider.provider_code === "resend" && result.status === "sent") {
      input.log?.({
        level: "info",
        message: "resend_send_success",
        extra: {
          order_id: input.order_id,
          order_number: input.order_number,
          download_token_id: input.download_token_id,
          raw_token_omitted: true
        }
      });
    }
    if (result.status !== "sent") {
      input.log?.({
        level: "error",
        message: "delivery_failure_reason",
        extra: {
          order_id: input.order_id,
          order_number: input.order_number,
          reason: `provider_status_${result.status}`,
          download_token_id: input.download_token_id,
          raw_token_omitted: true
        }
      });
    }
  } catch (error) {
    input.log?.({
      level: "error",
      message: "EMAIL_SKIPPED_REASON",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: error instanceof Error ? error.message : "email_delivery_exception",
        recipient_source: recipient.source,
        delivery_test_mode: recipient.test_mode,
        download_token_id: input.download_token_id,
        raw_token_omitted: true
      }
    });
    input.log?.({
      level: "error",
      message: "delivery_failure_reason",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: error instanceof Error ? error.message : "email_delivery_exception",
        download_token_id: input.download_token_id,
        raw_token_omitted: true
      }
    });
    await createFailedEmailLog({
      db: input.db,
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      recipient_email_hash: recipient.email_hash ?? sha256(recipient.email.trim().toLowerCase()),
      error_message: error instanceof Error ? `email_delivery_exception:${error.message}` : "email_delivery_exception"
    });
    return {
      status: "failed",
      email_log_id: null,
      recipient_source: recipient.source,
      raw_token_omitted: true
    };
  }

  return {
    status: result.status,
    email_log_id: result.email_log_id,
    recipient_source: recipient.source,
    raw_token_omitted: true
  };
}

class PrismaEmailLogRepository {
  constructor(private readonly db: VaultDeliveryDb) {}

  async createEmailLog(input: {
    id: string;
    order_id: string | null;
    email_template_id: string | null;
    provider: "mock" | "resend" | "sendgrid" | "ses";
    provider_message_id: string | null;
    recipient_email_hash: string;
    status: "queued" | "sent" | "delivered" | "bounced" | "failed";
    error_message: string | null;
    payload_json: Record<string, unknown>;
    created_at: Date;
    sent_at: Date | null;
  }) {
    return this.db.emailLog.create({
      data: {
        id: input.id,
        orderId: input.order_id,
        emailTemplateId: input.email_template_id,
        provider: input.provider,
        providerMessageId: input.provider_message_id,
        recipientEmailHash: input.recipient_email_hash,
        status: input.status,
        errorMessage: input.error_message,
        payloadJson: input.payload_json,
        createdAt: input.created_at,
        sentAt: input.sent_at
      }
    });
  }
}

async function resolveRecipient(
  db: VaultDeliveryDb,
  orderId: string,
  env: Record<string, string | undefined>
): Promise<{
  email: string | null;
  email_hash: string | null;
  intended_email_hash: string | null;
  source: "customer_pii" | "test_recipient";
  test_mode: boolean;
  reason?: string;
}> {
  const testMode = isEmailDeliveryTestMode(env);
  const testRecipient = env.EMAIL_TEST_RECIPIENT ?? env.MYKINLEGACY_TEST_RECIPIENT_EMAIL;
  if (testMode && testRecipient) {
    const customerRow = await db.orderCustomerPii.findUnique({ where: { orderId } });
    return {
      email: testRecipient,
      email_hash: sha256(testRecipient.trim().toLowerCase()),
      intended_email_hash: stringField(customerRow, "emailHash"),
      source: "test_recipient",
      test_mode: true
    };
  }

  const row = await db.orderCustomerPii.findUnique({ where: { orderId } });
  const emailHash = stringField(row, "emailHash");
  const encrypted = bufferField(row, "emailEncrypted");
  const email = encrypted ? decryptEmail(encrypted, env) : null;
  if (email && isInternalDeliveryInbox(email, testRecipient)) {
    return {
      email: null,
      email_hash: sha256(email.trim().toLowerCase()),
      intended_email_hash: emailHash,
      source: "customer_pii",
      test_mode: false,
      reason: "unsafe_live_email_recipient_internal_inbox"
    };
  }

  return {
    email,
    email_hash: emailHash,
    intended_email_hash: emailHash,
    source: "customer_pii",
    test_mode: false,
    reason: email ? undefined : "customer_email_not_decryptable"
  };
}

function isEmailDeliveryTestMode(env: Record<string, string | undefined>): boolean {
  return env.EMAIL_DELIVERY_TEST_MODE?.trim().toLowerCase() === "true";
}

function isInternalDeliveryInbox(email: string, testRecipient?: string): boolean {
  const normalized = email.trim().toLowerCase();
  const internalRecipients = new Set(
    ["service@mykinlegacy.com", testRecipient?.trim().toLowerCase()].filter(
      (value): value is string => Boolean(value)
    )
  );
  return internalRecipients.has(normalized);
}

async function createFailedEmailLog(input: {
  db: VaultDeliveryDb;
  order_id: string;
  order_number: string;
  download_token_id: string;
  recipient_email_hash: string;
  error_message: string;
}) {
  await input.db.emailLog.create({
    data: {
      id: createLocalId(),
      orderId: input.order_id,
      emailTemplateId: null,
      provider: "mock",
      providerMessageId: null,
      recipientEmailHash: input.recipient_email_hash,
      status: "failed",
      errorMessage: input.error_message,
      payloadJson: {
        order_number: input.order_number,
        download_token_id: input.download_token_id,
        raw_token_present: false,
        masked_download_vault_link: "/download/[redacted]"
      },
      createdAt: new Date(),
      sentAt: null
    }
  });
}

function decryptEmail(value: Buffer, env: Record<string, string | undefined>): string | null {
  const serialized = value.toString("utf8");
  if (serialized.startsWith("placeholder:v1:")) {
    return null;
  }
  if (!serialized.startsWith("enc:v1:")) {
    return null;
  }

  const [, , ivBase64, tagBase64, ciphertextBase64] = serialized.split(":");
  const rawKey = env.CUSTOMER_PII_ENCRYPTION_KEY ?? env.PII_ENCRYPTION_KEY;
  if (!rawKey || isPlaceholderSecret(rawKey) || !ivBase64 || !tagBase64 || !ciphertextBase64) {
    return null;
  }

  try {
    const key = createHash("sha256").update(rawKey).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function siteUrl(env: Record<string, string | undefined>): string {
  const candidates = [
    env.APP_WEB_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.APP_BASE_URL,
    env.SITE_URL,
    env.DOMAIN ? `https://${env.DOMAIN}` : undefined,
    env.NODE_ENV === "production" ? "https://mykinlegacy.com" : "http://localhost:3000"
  ];
  const publicIp = env.PUBLIC_IP;

  for (const candidate of candidates) {
    const normalized = normalizeCustomerUrl(candidate, publicIp);
    if (normalized) return normalized;
  }

  return "http://localhost:3000";
}

function normalizeCustomerUrl(value: string | undefined, publicIp?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const hostIsIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
    if (hostIsIp || (publicIp && url.hostname === publicIp)) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function createLocalId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let id = "";
  for (const byte of randomBytes(26)) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPlaceholderSecret(value: string): boolean {
  return value === "disabled" || value === "replace_me" || value.startsWith("replace_with_");
}

function stringField(row: unknown, key: string): string | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function bufferField(row: unknown, key: string): Buffer | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return Buffer.isBuffer(value) ? value : null;
}
