export const DELIVERY_READY_EMAIL_DISCLAIMER =
  "MyKinLegacy creates personalized symbolic keepsakes. It does not provide official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records.";

export interface DeliveryReadyEmailInput {
  order_number: string;
  raw_token_for_internal_delivery_only: string;
  app_web_url: string;
  expires_at: Date;
  support_email: string;
  subject_template?: string;
  body_template?: string;
}

export interface RenderedDeliveryEmail {
  subject: string;
  body_text: string;
  body_html: string;
  download_vault_link: string;
  sanitized_payload: Record<string, unknown>;
}

export function renderDeliveryReadyEmail(input: DeliveryReadyEmailInput): RenderedDeliveryEmail {
  const downloadVaultLink = `${input.app_web_url.replace(/\/$/, "")}/download/${
    input.raw_token_for_internal_delivery_only
  }`;
  const variables = {
    order_number: input.order_number,
    download_vault_link: downloadVaultLink,
    expires_at: input.expires_at.toISOString(),
    support_email: input.support_email,
    disclaimer: DELIVERY_READY_EMAIL_DISCLAIMER
  };
  const subject = renderTemplate(
    input.subject_template ?? "Your MyKinLegacy Private Vault Is Ready",
    variables
  );
  const bodyText = renderTemplate(
    input.body_template ??
      [
        "Hello,",
        "",
        "Your MyKinLegacy private vault is ready for order {{order_number}}.",
        "",
        "Open your private vault:",
        "{{download_vault_link}}",
        "",
        "Inside you will find your private Family Legacy Collection artifacts, including crest artwork, a heritage certificate, family story materials, a symbol guide, and the complete collection archive.",
        "",
        "Privacy note: this vault link is private to your order. Please keep it somewhere safe and share it only with trusted family members.",
        "",
        "This link expires at {{expires_at}}.",
        "Need help? Contact {{support_email}}.",
        "",
        "{{disclaimer}}"
      ].join("\n"),
    variables
  );

  return {
    subject,
    body_text: bodyText,
    body_html: `<p>${escapeHtml(bodyText).replaceAll("\n", "<br>")}</p>`,
    download_vault_link: downloadVaultLink,
    sanitized_payload: {
      order_number: input.order_number,
      masked_download_vault_link: maskDownloadLink(downloadVaultLink),
      expires_at: input.expires_at.toISOString(),
      support_email: input.support_email,
      disclaimer_included: true
    }
  };
}

export function maskDownloadLink(downloadVaultLink: string): string {
  return downloadVaultLink.replace(/\/download\/[^/?#]+/, "/download/[redacted]");
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
