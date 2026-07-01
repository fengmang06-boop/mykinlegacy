import type { EmailProviderAdapter, SendEmailInput, SendEmailOutput } from "./types";

export class ResendEmailProvider implements EmailProviderAdapter {
  public readonly provider_code = "resend";

  constructor(
    private readonly config: {
      apiKey?: string;
      fromEmail?: string;
      replyTo?: string;
    }
  ) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
    const validation = this.validateConfig();
    if (!validation.valid) {
      return {
        provider_message_id: "resend_not_configured",
        status: "failed",
        sent_at: null,
        raw_provider_response_json: { errors: validation.errors }
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: this.config.fromEmail,
        to: [input.to_email],
        reply_to: this.config.replyTo,
        subject: input.subject,
        text: input.body_text,
        html: input.body_html
      })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        provider_message_id: stringField(payload.id) ?? "resend_failed",
        status: "failed",
        sent_at: null,
        raw_provider_response_json: sanitizedProviderPayload(payload)
      };
    }

    return {
      provider_message_id: stringField(payload.id) ?? "resend_sent",
      status: "sent",
      sent_at: new Date(),
      raw_provider_response_json: sanitizedProviderPayload(payload)
    };
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.config.apiKey || this.config.apiKey === "disabled" || this.config.apiKey === "replace_me") {
      errors.push("RESEND_API_KEY is required for EMAIL_PROVIDER=resend");
    }
    if (!this.config.fromEmail) {
      errors.push("EMAIL_FROM is required for EMAIL_PROVIDER=resend");
    }
    return { valid: errors.length === 0, errors };
  }
}

function stringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function sanitizedProviderPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !/(email|to|from|html|text|body)/i.test(key))
  );
}
