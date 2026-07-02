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

export type DeliveryRecipientResolution =
  | {
      ok: true;
      recipientEmail: string;
      recipientEmailHash: string;
      intendedRecipientHash: string | null;
      recipientSource: "customer_pii" | "test_recipient";
      deliveryTestMode: boolean;
    }
  | {
      ok: false;
      reason: "missing_pii" | "decrypt_failed" | "invalid_email" | "internal_recipient_blocked";
      recipientEmailHash: string | null;
      intendedRecipientHash: string | null;
      recipientSource: "customer_pii";
      deliveryTestMode: false;
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
      | "EMAIL_JOB_CONSUMED"
      | "EMAIL_TRIGGERED"
      | "EMAIL_HANDLER_EXECUTED"
      | "EMAIL_SKIPPED_REASON"
      | "delivery_attempt_start"
      | "delivery_recipient_source"
      | "resend_provider_selected"
      | "resend_send_start"
      | "resend_send_success"
      | "EMAIL_DECRYPTION_SUCCESS"
      | "EMAIL_DECRYPTION_FAILED"
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
  input.log?.({
    level: "info",
    message: "EMAIL_JOB_CONSUMED",
    extra: {
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      handler: "sendVaultReadyEmail",
      queue_mode: "inline",
      redis_queue: false,
      raw_token_available: Boolean(input.raw_token_for_email_only),
      raw_token_omitted: true
    }
  });
  const recipient = await resolveDeliveryRecipient(input.db, input.order_id, env);
  if (recipient.ok && recipient.recipientSource === "customer_pii") {
    input.log?.({
      level: "info",
      message: "EMAIL_DECRYPTION_SUCCESS",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        intended_email_hash: recipient.intendedRecipientHash,
        raw_token_omitted: true
      }
    });
  }
  if (!recipient.ok) {
    const failureReason = deliveryResolutionReasonToLogReason(recipient.reason);
    input.log?.({
      level: "error",
      message: "EMAIL_DECRYPTION_FAILED",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: failureReason,
        intended_email_hash: recipient.intendedRecipientHash,
        raw_token_omitted: true
      }
    });
    input.log?.({
      level: "warn",
      message: "EMAIL_SKIPPED_REASON",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        reason: failureReason,
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
        reason: failureReason,
        raw_token_omitted: true
      }
    });
    const emailLogId = await createFailedEmailLog({
      db: input.db,
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      provider: providerCodeForFailure(env),
      recipient_email_hash: recipient.recipientEmailHash ?? sha256(`${input.order_id}:recipient_unavailable`),
      error_message: failureReason,
      recipient_source: "unavailable",
      delivery_test_mode: false
    });
    return {
      status: "failed",
      email_log_id: emailLogId,
      recipient_source: "unavailable",
      raw_token_omitted: true
    };
  }

  let result: Awaited<ReturnType<EmailModule["sendDeliveryEmailJob"]>>;
  let selectedProviderCode = providerCodeForFailure(env);
  try {
    const provider = input.emailModule.createEmailProviderFromEnv(env);
    selectedProviderCode = provider.provider_code;
    input.log?.({
      level: "info",
      message: "delivery_recipient_source",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
        intended_recipient_hash: recipient.intendedRecipientHash,
        actual_recipient_hash: recipient.recipientEmailHash,
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
        expected_resend: !recipient.deliveryTestMode,
        raw_token_omitted: true
      }
    });
    if (!recipient.deliveryTestMode && env.NODE_ENV === "production" && provider.provider_code === "mock") {
      throw new Error("live_email_provider_mock_not_allowed");
    }
    input.log?.({
      level: "info",
      message: "EMAIL_JOB_CREATED",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        provider: provider.provider_code,
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
        intended_recipient_hash: recipient.intendedRecipientHash,
        actual_recipient_hash: recipient.recipientEmailHash,
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
          recipient_source: recipient.recipientSource,
          delivery_test_mode: recipient.deliveryTestMode,
          download_token_id: input.download_token_id,
          raw_token_omitted: true
        }
      });
    }
    input.log?.({
      level: "info",
      message: "EMAIL_HANDLER_EXECUTED",
      extra: {
        order_id: input.order_id,
        order_number: input.order_number,
        provider: provider.provider_code,
        handler: "sendDeliveryEmailJob",
        phase: "before_provider_call",
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
        download_token_id: input.download_token_id,
        raw_token_omitted: true
      }
    });
    result = await input.emailModule.sendDeliveryEmailJob(
      {
        order_id: input.order_id,
        order_number: input.order_number,
        download_token_id: input.download_token_id,
        raw_token_for_internal_delivery_only: input.raw_token_for_email_only,
        recipient_email: recipient.recipientEmail,
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
        intended_recipient_hash: recipient.intendedRecipientHash,
        actual_recipient_hash: recipient.recipientEmailHash,
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
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
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
        recipient_source: recipient.recipientSource,
        delivery_test_mode: recipient.deliveryTestMode,
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
    const emailLogId = await createFailedEmailLog({
      db: input.db,
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id,
      provider: selectedProviderCode,
      recipient_email_hash: recipient.recipientEmailHash,
      error_message: error instanceof Error ? `email_delivery_exception:${error.message}` : "email_delivery_exception",
      recipient_source: recipient.recipientSource,
      delivery_test_mode: recipient.deliveryTestMode
    });
    return {
      status: "failed",
      email_log_id: emailLogId,
      recipient_source: recipient.recipientSource,
      raw_token_omitted: true
    };
  }

  return {
    status: result.status,
    email_log_id: result.email_log_id,
    recipient_source: recipient.recipientSource,
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

export async function resolveDeliveryRecipient(
  db: VaultDeliveryDb,
  orderId: string,
  env: Record<string, string | undefined>
): Promise<DeliveryRecipientResolution> {
  const testMode = isEmailDeliveryTestMode(env);
  const testRecipient = env.EMAIL_TEST_RECIPIENT ?? env.MYKINLEGACY_TEST_RECIPIENT_EMAIL;
  if (testMode && testRecipient) {
    const customerRow = await db.orderCustomerPii.findUnique({ where: { orderId } });
    const normalizedTestRecipient = normalizeEmail(testRecipient);
    if (!normalizedTestRecipient) {
      return {
        ok: false,
        reason: "invalid_email",
        recipientEmailHash: null,
        intendedRecipientHash: stringField(customerRow, "emailHash"),
        recipientSource: "customer_pii",
        deliveryTestMode: false
      };
    }
    return {
      ok: true,
      recipientEmail: normalizedTestRecipient,
      recipientEmailHash: sha256(normalizedTestRecipient),
      intendedRecipientHash: stringField(customerRow, "emailHash"),
      recipientSource: "test_recipient",
      deliveryTestMode: true
    };
  }

  const row = await db.orderCustomerPii.findUnique({ where: { orderId } });
  if (!row) {
    return {
      ok: false,
      reason: "missing_pii",
      recipientEmailHash: null,
      intendedRecipientHash: null,
      recipientSource: "customer_pii",
      deliveryTestMode: false
    };
  }
  const emailHash = stringField(row, "emailHash");
  const encrypted = bufferField(row, "emailEncrypted");
  if (!emailHash || !encrypted) {
    return {
      ok: false,
      reason: "missing_pii",
      recipientEmailHash: emailHash,
      intendedRecipientHash: emailHash,
      recipientSource: "customer_pii",
      deliveryTestMode: false
    };
  }
  const decryptedEmail = decryptEmail(encrypted, env);
  const email = normalizeEmail(decryptedEmail);
  if (!email) {
    return {
      ok: false,
      reason: decryptedEmail ? "invalid_email" : "decrypt_failed",
      recipientEmailHash: emailHash,
      intendedRecipientHash: emailHash,
      recipientSource: "customer_pii",
      deliveryTestMode: false
    };
  }
  if (email && isInternalDeliveryInbox(email, testRecipient)) {
    return {
      ok: false,
      reason: "internal_recipient_blocked",
      recipientEmailHash: sha256(email),
      intendedRecipientHash: emailHash,
      recipientSource: "customer_pii",
      deliveryTestMode: false
    };
  }

  return {
    ok: true,
    recipientEmail: email,
    recipientEmailHash: sha256(email),
    intendedRecipientHash: emailHash,
    recipientSource: "customer_pii",
    deliveryTestMode: false
  };
}

type DeliveryRecipientFailureReason = Extract<DeliveryRecipientResolution, { ok: false }>["reason"];

function deliveryResolutionReasonToLogReason(reason: DeliveryRecipientFailureReason): string {
  if (reason === "missing_pii") return "customer_email_missing";
  if (reason === "decrypt_failed") return "customer_email_not_decryptable";
  if (reason === "invalid_email") return "customer_email_invalid";
  if (reason === "internal_recipient_blocked") return "unsafe_live_email_recipient_internal_inbox";
  return "delivery_recipient_unavailable";
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
  provider: "mock" | "resend" | "sendgrid" | "ses";
  recipient_email_hash: string;
  error_message: string;
  recipient_source: "customer_pii" | "test_recipient" | "unavailable";
  delivery_test_mode: boolean;
}): Promise<string> {
  const id = createLocalId();
  await input.db.emailLog.create({
    data: {
      id,
      orderId: input.order_id,
      emailTemplateId: null,
      provider: input.provider,
      providerMessageId: null,
      recipientEmailHash: input.recipient_email_hash,
      status: "failed",
      errorMessage: input.error_message,
      payloadJson: {
        order_number: input.order_number,
        download_token_id: input.download_token_id,
        email_delivery_status: emailDeliveryFailureStatus(input.error_message),
        recipient_source: input.recipient_source,
        delivery_test_mode: input.delivery_test_mode,
        raw_token_present: false,
        masked_download_vault_link: "/download/[redacted]"
      },
      createdAt: new Date(),
      sentAt: null
    }
  });
  return id;
}

function emailDeliveryFailureStatus(errorMessage: string): "failed" | "failed_decryption" | "failed_missing_email" {
  if (errorMessage === "customer_email_missing") {
    return "failed_missing_email";
  }
  if (errorMessage === "customer_email_not_decryptable") {
    return "failed_decryption";
  }
  return "failed";
}

function providerCodeForFailure(env: Record<string, string | undefined>): "mock" | "resend" | "sendgrid" | "ses" {
  const provider = (env.EMAIL_PROVIDER ?? "mock").trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (provider === "resend" || provider === "sendgrid" || provider === "ses") {
    return provider;
  }
  return "mock";
}

function decryptEmail(value: Buffer, env: Record<string, string | undefined>): string | null {
  const serialized = Buffer.from(value).toString("utf8");
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

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
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
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}
