import type { EmailProviderAdapter, EmailProviderCode, SendEmailInput, SendEmailOutput } from "./types";

export class DisabledEmailProvider implements EmailProviderAdapter {
  constructor(public readonly provider_code: Exclude<EmailProviderCode, "mock">) {}

  async sendEmail(_input: SendEmailInput): Promise<SendEmailOutput> {
    throw new Error("email_provider_not_configured");
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const key = String(config.api_key ?? "");
    return key && key !== "replace_me"
      ? { valid: false, errors: ["real_email_provider_disabled_in_mvp"] }
      : { valid: false, errors: ["email_provider_not_configured"] };
  }
}
