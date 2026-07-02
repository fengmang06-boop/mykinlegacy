import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { sendVaultReadyEmail } from "./vault-delivery";

describe("vault delivery email", () => {
  it("passes raw token to delivery service and stores only sanitized email log payload", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "pii-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: "log",
        EMAIL_FROM: "support@mykinlegacy.com"
      }
    });

    expect(result).toMatchObject({ status: "sent", recipient_source: "customer_pii" });
    expect(emailModule.state.lastInput).toMatchObject({
      recipient_email: "customer@example.com",
      raw_token_for_internal_delivery_only: "raw-token-once",
      app_web_url: "https://mykinlegacy.com"
    });
    expect(JSON.stringify(db.state.emailLogs)).not.toContain("raw-token-once");
    expect(JSON.stringify(db.state.emailLogs)).not.toContain("customer@example.com");
  });

  it("uses founder test recipient without needing decryptable customer pii", async () => {
    const db = createDb({
      emailEncrypted: Buffer.from("placeholder:v1:not-decryptable"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        EMAIL_DELIVERY_TEST_MODE: "true",
        EMAIL_TEST_RECIPIENT: "founder@example.com",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: "log"
      }
    });

    expect(result).toMatchObject({ status: "sent", recipient_source: "test_recipient" });
    expect(emailModule.state.lastInput).toMatchObject({
      recipient_email: "founder@example.com",
      recipient_source: "test_recipient",
      delivery_test_mode: true,
      intended_recipient_hash: sha256("customer@example.com")
    });
  });

  it("uses decrypted customer email when test recipient is configured but test mode is false", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "pii-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        EMAIL_DELIVERY_TEST_MODE: "false",
        EMAIL_TEST_RECIPIENT: "service@mykinlegacy.com",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: "log"
      }
    });

    expect(result).toMatchObject({ status: "sent", recipient_source: "customer_pii" });
    expect(emailModule.state.lastInput).toMatchObject({
      recipient_email: "customer@example.com",
      recipient_source: "customer_pii",
      delivery_test_mode: false,
      intended_recipient_hash: sha256("customer@example.com")
    });
    expect(JSON.stringify(emailModule.state.lastInput)).not.toContain("service@mykinlegacy.com");
  });

  it("uses normalized resend provider for live customer delivery", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "pii-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule({ providerCode: "resend" });
    const logs: unknown[] = [];

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        EMAIL_DELIVERY_TEST_MODE: "false",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: ' "resend" ',
        NODE_ENV: "production"
      },
      log: (entry) => logs.push(entry)
    });

    expect(result).toMatchObject({ status: "sent", recipient_source: "customer_pii" });
    expect(emailModule.state.providerEnv).toMatchObject({ EMAIL_PROVIDER: ' "resend" ' });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "EMAIL_DECRYPTION_SUCCESS" }),
        expect.objectContaining({ message: "EMAIL_JOB_CREATED" }),
        expect.objectContaining({ message: "EMAIL_JOB_CONSUMED" }),
        expect.objectContaining({ message: "EMAIL_HANDLER_EXECUTED" }),
        expect.objectContaining({ message: "EMAIL_TRIGGERED" })
      ])
    );
  });

  it("fails live production delivery if provider resolves to mock", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "pii-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule({ providerCode: "mock" });
    const logs: unknown[] = [];

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        EMAIL_DELIVERY_TEST_MODE: "false",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: "log",
        NODE_ENV: "production"
      },
      log: (entry) => logs.push(entry)
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "customer_pii" });
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      status: "failed",
      errorMessage: "email_delivery_exception:live_email_provider_mock_not_allowed"
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        message: "EMAIL_SKIPPED_REASON",
        extra: expect.objectContaining({ reason: "live_email_provider_mock_not_allowed" })
      })
    );
  });

  it("logs failure for internal service inbox as a live customer delivery recipient", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("service@mykinlegacy.com", "pii-key"),
      emailHash: sha256("service@mykinlegacy.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        EMAIL_DELIVERY_TEST_MODE: "false",
        EMAIL_TEST_RECIPIENT: "service@mykinlegacy.com",
        NEXT_PUBLIC_SITE_URL: "https://mykinlegacy.com",
        EMAIL_PROVIDER: "log"
      }
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "unavailable" });
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      status: "failed",
      errorMessage: "unsafe_live_email_recipient_internal_inbox"
    });
  });

  it("prefers customer-facing domain URLs over raw public IP URLs", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "pii-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        NEXT_PUBLIC_SITE_URL: "https://216.128.154.152",
        APP_WEB_URL: "https://mykinlegacy.com",
        PUBLIC_IP: "216.128.154.152",
        EMAIL_PROVIDER: "log"
      }
    });

    expect(emailModule.state.lastInput).toMatchObject({
      app_web_url: "https://mykinlegacy.com"
    });
    expect(JSON.stringify(emailModule.state.lastInput)).not.toContain("216.128.154.152");
  });

  it("handles unavailable recipient gracefully", async () => {
    const db = createDb({
      emailEncrypted: Buffer.from("placeholder:v1:not-decryptable"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: { EMAIL_PROVIDER: "log" }
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "unavailable" });
    expect(result.email_log_id).toBeTruthy();
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      status: "failed",
      errorMessage: "customer_email_not_decryptable",
      payloadJson: expect.objectContaining({
        email_delivery_status: "failed_decryption",
        recipient_source: "unavailable"
      })
    });
  });

  it("logs failed decryption when customer email was encrypted with a different key", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "api-key"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule({ providerCode: "resend" });
    const logs: unknown[] = [];

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "worker-key",
        EMAIL_PROVIDER: "resend",
        EMAIL_DELIVERY_TEST_MODE: "false"
      },
      log: (entry) => logs.push(entry)
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "unavailable" });
    expect(result.email_log_id).toBeTruthy();
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      provider: "resend",
      status: "failed",
      errorMessage: "customer_email_not_decryptable",
      payloadJson: expect.objectContaining({
        email_delivery_status: "failed_decryption"
      })
    });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "EMAIL_DECRYPTION_FAILED",
          extra: expect.objectContaining({ reason: "customer_email_not_decryptable" })
        }),
        expect.objectContaining({
          message: "delivery_failure_reason",
          extra: expect.objectContaining({ reason: "customer_email_not_decryptable" })
        })
      ])
    );
  });

  it("rejects placeholder pii keys during delivery lookup", async () => {
    const db = createDb({
      emailEncrypted: encryptEmail("customer@example.com", "replace_with_customer_pii_encryption_key_from_secret_manager"),
      emailHash: sha256("customer@example.com")
    });
    const emailModule = createEmailModule();

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "replace_with_customer_pii_encryption_key_from_secret_manager",
        EMAIL_PROVIDER: "log"
      }
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "unavailable" });
    expect(emailModule.state.lastInput).toBeNull();
  });

  it("logs missing customer email as a visible delivery failure", async () => {
    const db = createDb({
      emailEncrypted: null,
      emailHash: null
    });
    const emailModule = createEmailModule({ providerCode: "resend" });
    const logs: unknown[] = [];

    const result = await sendVaultReadyEmail({
      db: db as never,
      emailModule: emailModule as never,
      order_id: "order_1",
      order_number: "AHL-TEST",
      download_token_id: "download_token_1",
      raw_token_for_email_only: "raw-token-once",
      expires_at: "2026-07-29T00:00:00.000Z",
      env: {
        CUSTOMER_PII_ENCRYPTION_KEY: "pii-key",
        EMAIL_PROVIDER: "resend",
        EMAIL_DELIVERY_TEST_MODE: "false"
      },
      log: (entry) => logs.push(entry)
    });

    expect(result).toMatchObject({ status: "failed", recipient_source: "unavailable" });
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      provider: "resend",
      status: "failed",
      errorMessage: "customer_email_missing",
      payloadJson: expect.objectContaining({
        email_delivery_status: "failed_missing_email"
      })
    });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "EMAIL_DECRYPTION_FAILED",
          extra: expect.objectContaining({ reason: "customer_email_missing" })
        })
      ])
    );
  });
});

function createDb(input: { emailEncrypted: Buffer | null; emailHash: string | null }) {
  const state = { emailLogs: [] as unknown[] };
  return {
    state,
    orderCustomerPii: {
      findUnique: vi.fn(async () => ({
        emailEncrypted: input.emailEncrypted,
        emailHash: input.emailHash
      }))
    },
    emailLog: {
      create: vi.fn(async (args: { data: unknown }) => {
        state.emailLogs.push(args.data);
        return args.data;
      })
    }
  };
}

function createEmailModule(options: { providerCode?: "mock" | "resend" } = {}) {
  const state = { lastInput: null as unknown, providerEnv: null as unknown };
  return {
    state,
    createEmailProviderFromEnv: vi.fn((env: unknown) => {
      state.providerEnv = env;
      return { provider_code: options.providerCode ?? "mock" };
    }),
    sendDeliveryEmailJob: vi.fn(async (input: unknown, dependencies: { emailLogRepository: { createEmailLog(input: unknown): Promise<unknown> } }) => {
      state.lastInput = input;
      await dependencies.emailLogRepository.createEmailLog({
        id: "email_log_1",
        order_id: "order_1",
        email_template_id: null,
        provider: "mock",
        provider_message_id: "mock_1",
        recipient_email_hash: "a".repeat(64),
        status: "sent",
        error_message: null,
        payload_json: {
          masked_download_vault_link: "https://mykinlegacy.com/download/[redacted]",
          download_token_id: "download_token_1"
        },
        created_at: new Date("2026-06-29T00:00:00.000Z"),
        sent_at: new Date("2026-06-29T00:00:00.000Z")
      });
      return { email_log_id: "email_log_1", status: "sent" };
    })
  };
}

function encryptEmail(email: string, keySeed: string): Buffer {
  const key = createHash("sha256").update(keySeed).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`,
    "utf8"
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
