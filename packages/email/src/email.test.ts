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
    expect(rendered.subject).toBe("Your MyKinLegacy Private Vault Is Ready");
    expect(rendered.body_text).toContain("crest artwork");
    expect(rendered.body_text).toContain("legal heraldic grants");
    expect(rendered.body_text).not.toContain("signed-url");
    expect(rendered.body_text).not.toContain("storage_key");
    expect(rendered.sanitized_payload.masked_download_vault_link).toBe(
      "https://example.com/download/[redacted]"
    );
    expect(JSON.stringify(rendered.sanitized_payload)).not.toContain("raw_token_once");
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

  it("creates configurable provider from environment without hardcoded secrets", () => {
    expect(createEmailProviderFromEnv({ EMAIL_PROVIDER: "log" }).provider_code).toBe("mock");
    expect(
      createEmailProviderFromEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "test_key",
        EMAIL_FROM: "support@mykinlegacy.com"
      }).provider_code
    ).toBe("resend");
  });
});
