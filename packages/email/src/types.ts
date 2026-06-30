export type EmailProviderCode = "mock" | "resend" | "sendgrid" | "ses";
export type EmailSendStatus = "sent" | "failed" | "bounced" | "timeout";

export interface SendEmailInput {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  metadata: Record<string, unknown>;
  idempotency_key: string;
}

export interface SendEmailOutput {
  provider_message_id: string;
  status: EmailSendStatus;
  sent_at: Date | null;
  raw_provider_response_json?: Record<string, unknown>;
}

export interface EmailProviderAdapter {
  provider_code: EmailProviderCode;
  sendEmail(input: SendEmailInput): Promise<SendEmailOutput>;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] };
}

export interface EmailTemplateRecord {
  id: string;
  code: string;
  locale: string;
  version: number;
  status: "active" | "draft" | "retired";
  subject_template: string;
  body_template: string;
}

export interface EmailLogRecord {
  id: string;
  order_id: string | null;
  email_template_id: string | null;
  provider: EmailProviderCode;
  provider_message_id: string | null;
  recipient_email_hash: string;
  status: "queued" | "sent" | "delivered" | "bounced" | "failed";
  error_message: string | null;
  payload_json: Record<string, unknown>;
  created_at: Date;
  sent_at: Date | null;
}

export interface EmailLogRepository {
  createEmailLog(input: EmailLogRecord): Promise<EmailLogRecord>;
}
