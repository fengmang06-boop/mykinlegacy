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
    expect(emailModule.state.lastInput).toBeNull();
    expect(db.state.emailLogs[0]).toMatchObject({
      status: "failed",
      errorMessage: "customer_email_not_decryptable"
    });
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
});

function createDb(input: { emailEncrypted: Buffer; emailHash: string }) {
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

function createEmailModule() {
  const state = { lastInput: null as unknown };
  return {
    state,
    createEmailProviderFromEnv: vi.fn(() => ({ provider_code: "mock" })),
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
