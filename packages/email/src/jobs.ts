import { createEmailLogId, hashEmailAddress } from "./email-log";
import { renderDeliveryReadyEmail } from "./rendering";
import type {
  EmailLogRepository,
  EmailProviderAdapter,
  EmailTemplateRecord
} from "./types";

export interface SendDeliveryEmailJobInput {
  order_id: string;
  order_number: string;
  download_token_id: string;
  raw_token_for_internal_delivery_only?: string;
  recipient_email: string;
  recipient_source?: "customer_pii" | "test_recipient";
  delivery_test_mode?: boolean;
  intended_recipient_hash?: string | null;
  actual_recipient_hash?: string | null;
  expires_at: Date | string;
  app_web_url?: string;
  email_from?: string;
  email_reply_to?: string;
}

export interface SendDeliveryEmailJobOutput {
  email_log_id: string;
  status: "sent" | "failed" | "bounced";
}

export async function sendDeliveryEmailJob(
  input: SendDeliveryEmailJobInput,
  dependencies: {
    provider: EmailProviderAdapter;
    emailLogRepository: EmailLogRepository;
    template?: EmailTemplateRecord | null;
  }
): Promise<SendDeliveryEmailJobOutput> {
  const emailLogId = createEmailLogId();
  const createdAt = new Date();
  const template = dependencies.template ?? null;

  if (!input.raw_token_for_internal_delivery_only) {
    const log = await dependencies.emailLogRepository.createEmailLog({
      id: emailLogId,
      order_id: input.order_id,
      email_template_id: template?.id ?? null,
      provider: dependencies.provider.provider_code,
      provider_message_id: null,
      recipient_email_hash: hashEmailAddress(input.recipient_email),
      status: "failed",
      error_message: "download_token_missing_for_delivery_email",
      payload_json: {
        order_number: input.order_number,
        download_token_id: input.download_token_id,
        raw_token_present: false
      },
      created_at: createdAt,
      sent_at: null
    });
    return { email_log_id: log.id, status: "failed" };
  }

  const rendered = renderDeliveryReadyEmail({
    order_number: input.order_number,
    raw_token_for_internal_delivery_only: input.raw_token_for_internal_delivery_only,
    app_web_url: input.app_web_url ?? process.env.APP_WEB_URL ?? "http://localhost:3000",
    expires_at: input.expires_at instanceof Date ? input.expires_at : new Date(input.expires_at),
    support_email: input.email_reply_to ?? process.env.EMAIL_REPLY_TO ?? "support@example.com",
    subject_template: template?.subject_template,
    body_template: template?.body_template
  });

  const output = await dependencies.provider.sendEmail({
    to_email: input.recipient_email,
    subject: rendered.subject,
    body_text: rendered.body_text,
    body_html: rendered.body_html,
    metadata: {
      order_id: input.order_id,
      order_number: input.order_number,
      download_token_id: input.download_token_id
    },
    idempotency_key: `delivery_ready:${input.order_id}:${input.download_token_id}`
  });
  const status = mapProviderStatus(output.status);
  const log = await dependencies.emailLogRepository.createEmailLog({
    id: emailLogId,
    order_id: input.order_id,
    email_template_id: template?.id ?? null,
    provider: dependencies.provider.provider_code,
    provider_message_id: output.provider_message_id,
    recipient_email_hash: hashEmailAddress(input.recipient_email),
    status,
    error_message: status === "failed" ? "email_delivery_failed" : null,
    payload_json: {
      ...rendered.sanitized_payload,
      download_token_id: input.download_token_id,
      delivery_test_mode: input.delivery_test_mode === true,
      recipient_source: input.recipient_source ?? "customer_pii",
      intended_recipient_hash: input.intended_recipient_hash ?? null,
      actual_recipient_hash: input.actual_recipient_hash ?? hashEmailAddress(input.recipient_email),
      recipient_override_active: input.delivery_test_mode === true && input.recipient_source === "test_recipient"
    },
    created_at: createdAt,
    sent_at: output.sent_at
  });

  return {
    email_log_id: log.id,
    status: status === "bounced" ? "bounced" : status === "sent" ? "sent" : "failed"
  };
}

function mapProviderStatus(status: string): "sent" | "bounced" | "failed" {
  if (status === "sent") {
    return "sent";
  }
  if (status === "bounced") {
    return "bounced";
  }
  return "failed";
}
