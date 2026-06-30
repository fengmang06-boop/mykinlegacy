import { createHash } from "node:crypto";

import type { EmailProviderAdapter, SendEmailInput, SendEmailOutput } from "./types";

export type MockEmailMode = "success" | "provider_error" | "bounce" | "timeout";

export class MockEmailProvider implements EmailProviderAdapter {
  public readonly provider_code = "mock";
  public readonly sentEmails: SendEmailInput[] = [];

  constructor(private readonly mode: MockEmailMode = "success") {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
    this.sentEmails.push({
      ...input,
      to_email: hashForMemory(input.to_email)
    });

    const providerMessageId = `mock_${createHash("sha256")
      .update(`${input.idempotency_key}:${input.subject}:${input.to_email}`)
      .digest("hex")
      .slice(0, 24)}`;

    if (this.mode === "provider_error") {
      return {
        provider_message_id: providerMessageId,
        status: "failed",
        sent_at: null,
        raw_provider_response_json: { simulated: true, reason: "provider_error" }
      };
    }

    if (this.mode === "bounce") {
      return {
        provider_message_id: providerMessageId,
        status: "bounced",
        sent_at: new Date(0),
        raw_provider_response_json: { simulated: true, reason: "bounce" }
      };
    }

    if (this.mode === "timeout") {
      return {
        provider_message_id: providerMessageId,
        status: "timeout",
        sent_at: null,
        raw_provider_response_json: { simulated: true, reason: "timeout" }
      };
    }

    return {
      provider_message_id: providerMessageId,
      status: "sent",
      sent_at: new Date(0),
      raw_provider_response_json: { simulated: true }
    };
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }
}

function hashForMemory(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
