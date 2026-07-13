import { describe, expect, it } from "vitest";

import {
  InMemoryEmailLogRepository,
  MockEmailProvider,
  createEmailProviderFromEnv,
  renderDeliveryReadyEmail,
  sendDeliveryEmailJob
} from "./index";

describe("mock email provider and delivery rendering", () => {
  it("sends deterministic mock email without exposing customer email in memory", async () => {
    const provider = new MockEmailProvider();
    const first = await provider.sendEmail({
      to_email: "customer@example.com",
      subject: "Ready",
      body_text: "Body",
      metadata: {},
      idempotency_key: "same-key"
    });
    const second = await provider.sendEmail({
      to_email: "customer@example.com",
      subject: "Ready",
      body_text: "Body",
      metadata: {},
      idempotency_key: "same-key"
    });

    expect(first.provider_message_id).toBe(second.provider_message_id);
    expect(provider.sentEmails[0]?.to_email).not.toBe("customer@example.com");
  });

  it("renders delivery email with vault link and no signed asset URL", () => {
    const rendered = renderDeliveryReadyEmail({
      order_number: "AH-1001",
      raw_token_for_internal_delivery_only: "raw_token_once",
      app_web_url: "https://example.com",
      expires_at: new Date("2026-07-29T00:00:00.000Z"),
      support_email: "support@example.com"
    });

    expect(rendered.body_text).toContain("https://example.com/download/raw_token_once");
    expect(rendered.body_text).not.toContain("216.128.154.152");
    expect(rendered.body_html).toContain("MyKinLegacy");
    expect(rendered.body_html).toContain("Open Your Private Vault");
    expect(rendered.body_html).toContain("https://example.com/download/raw_token_once");
    expect(rendered.body_html).toContain("background:#11100d");
    expect(rendered.subject).toBe("Your MyKinLegacy Private Vault Is Ready");
    expect(rendered.body_text).toContain("primary Family Legacy Certificate");
    expect(rendered.body_text).toContain("Final Crest");
    expect(rendered.body_text).toContain("legal heraldic grants");
    expect(rendered.body_html).toContain("legal heraldic grants");
    expect(rendered.body_text).not.toContain("signed-url");
    expect(rendered.body_text).not.toContain("storage_key");
    expect(rendered.body_html).not.toContain("signed-url");
    expect(rendered.body_html).not.toContain("storage_key");
    expect(rendered.sanitized_payload.masked_download_vault_link).toBe(
      "https://example.com/download/[redacted]"
    );
    expect(JSON.stringify(rendered.sanitized_payload)).not.toContain("raw_token_once");
  });

  it("records test mode recipient routing metadata without storing raw emails", async () => {
    const provider = new MockEmailProvider();
    const emailLogRepository = new InMemoryEmailLogRepository();
    await sendDeliveryEmailJob(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        download_token_id: "download_token_1",
        raw_token_for_internal_delivery_only: "raw_token_once",
        recipient_email: "founder@example.com",
        recipient_source: "test_recipient",
        delivery_test_mode: true,
        intended_recipient_hash: "b".repeat(64),
        actual_recipient_hash: "c".repeat(64),
        expires_at: "2026-07-29T00:00:00.000Z",
        app_web_url: "https://mykinlegacy.com"
      },
      { provider, emailLogRepository }
    );

    expect(emailLogRepository.logs[0]?.payload_json).toMatchObject({
      delivery_test_mode: true,
      recipient_source: "test_recipient",
      intended_recipient_hash: "b".repeat(64),
      actual_recipient_hash: "c".repeat(64),
      recipient_override_active: true
    });
    expect(JSON.stringify(emailLogRepository.logs[0]?.payload_json)).not.toContain(
      "founder@example.com"
    );
  });

  it("records recipient hash and sanitized payload in delivery email job", async () => {
    const provider = new MockEmailProvider();
    const emailLogRepository = new InMemoryEmailLogRepository();
    const result = await sendDeliveryEmailJob(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        download_token_id: "download_token_1",
        raw_token_for_internal_delivery_only: "raw_token_once",
        recipient_email: "customer@example.com",
        expires_at: "2026-07-29T00:00:00.000Z",
        app_web_url: "https://example.com"
      },
      { provider, emailLogRepository }
    );

    expect(result.status).toBe("sent");
    expect(emailLogRepository.logs[0]).toMatchObject({
      id: result.email_log_id,
      recipient_email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      status: "sent"
    });
    expect(JSON.stringify(emailLogRepository.logs[0]?.payload_json)).not.toContain("raw_token_once");
    expect(JSON.stringify(emailLogRepository.logs[0]?.payload_json)).not.toContain("signed-url");
    expect(JSON.stringify(emailLogRepository.logs[0]?.payload_json)).not.toContain(
      "customer@example.com"
    );
  });

  it("rejects service inbox recipient when delivery test mode is disabled", async () => {
    const provider = new MockEmailProvider();
    const emailLogRepository = new InMemoryEmailLogRepository();

    await expect(
      sendDeliveryEmailJob(
        {
          order_id: "order_1",
          order_number: "AH-1001",
          download_token_id: "download_token_1",
          raw_token_for_internal_delivery_only: "raw_token_once",
          recipient_email: "service@mykinlegacy.com",
          recipient_source: "customer_pii",
          delivery_test_mode: false,
          expires_at: "2026-07-29T00:00:00.000Z",
          app_web_url: "https://mykinlegacy.com"
        },
        { provider, emailLogRepository }
      )
    ).rejects.toThrow("unsafe_live_email_recipient_internal_inbox");
    expect(provider.sentEmails).toHaveLength(0);
    expect(emailLogRepository.logs).toHaveLength(0);
  });

  it("send_delivery_email_job failure is contained to email status", async () => {
    const provider = new MockEmailProvider("provider_error");
    const emailLogRepository = new InMemoryEmailLogRepository();
    const result = await sendDeliveryEmailJob(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        download_token_id: "download_token_1",
        raw_token_for_internal_delivery_only: "raw_token_once",
        recipient_email: "customer@example.com",
        expires_at: "2026-07-29T00:00:00.000Z",
        app_web_url: "https://example.com"
      },
      { provider, emailLogRepository }
    );

    expect(result.status).toBe("failed");
    expect(emailLogRepository.logs[0]?.status).toBe("failed");
    expect(emailLogRepository.logs[0]?.error_message).toBe("email_delivery_failed");
  });

  it("does not mark provider acceptance as sent without a real provider message id", async () => {
    const emailLogRepository = new InMemoryEmailLogRepository();
    const result = await sendDeliveryEmailJob(
      {
        order_id: "order_1",
        order_number: "AH-1001",
        download_token_id: "download_token_1",
        raw_token_for_internal_delivery_only: "raw_token_once",
        recipient_email: "customer@example.com",
        expires_at: "2026-07-29T00:00:00.000Z",
        app_web_url: "https://example.com"
      },
      {
        provider: {
          provider_code: "resend",
          validateConfig: () => ({ valid: true, errors: [] }),
          sendEmail: async () => ({
            provider_message_id: null,
            status: "sent",
            sent_at: new Date(),
            raw_provider_response_json: {}
          })
        },
        emailLogRepository
      }
    );

    expect(result.status).toBe("failed");
    expect(emailLogRepository.logs[0]).toMatchObject({
      status: "failed",
      provider_message_id: null,
      error_message: "email_provider_acceptance_not_confirmed",
      sent_at: null
    });
  });

  it("rejects mock delivery providers in production", () => {
    expect(() =>
      createEmailProviderFromEnv({ NODE_ENV: "production", EMAIL_PROVIDER: "mock" })
    ).toThrow("production_email_provider_must_be_real");
    expect(() =>
      createEmailProviderFromEnv({ NODE_ENV: "production", EMAIL_PROVIDER: "log" })
    ).toThrow("production_email_provider_must_be_real");
  });

  it("creates configurable provider from environment without hardcoded secrets", () => {
    expect(createEmailProviderFromEnv({ EMAIL_PROVIDER: "log" }).provider_code).toBe("mock");
    expect(createEmailProviderFromEnv({ EMAIL_PROVIDER: ' "log" ' }).provider_code).toBe("mock");
    expect(
      createEmailProviderFromEnv({
        EMAIL_PROVIDER: ' "resend" ',
        RESEND_API_KEY: "test_key",
        EMAIL_FROM: "support@mykinlegacy.com"
      }).provider_code
    ).toBe("resend");
  });
});
