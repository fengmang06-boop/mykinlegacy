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
  const expiresAt = input.expires_at.toISOString();
  const variables = {
    order_number: input.order_number,
    download_vault_link: downloadVaultLink,
    expires_at: expiresAt,
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
    body_html: input.body_template
      ? `<p>${escapeHtml(bodyText).replaceAll("\n", "<br>")}</p>`
      : renderBrandedDeliveryHtml(variables),
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

function renderBrandedDeliveryHtml(variables: Record<string, string>): string {
  const vaultLink = escapeHtml(variables.download_vault_link ?? "");
  const orderNumber = escapeHtml(variables.order_number ?? "");
  const expiresAt = escapeHtml(variables.expires_at ?? "");
  const supportEmail = escapeHtml(variables.support_email ?? "");
  const disclaimer = escapeHtml(variables.disclaimer ?? "");

  return [
    '<!doctype html>',
    '<html>',
    '<body style="margin:0;padding:0;background:#070706;color:#2a2419;font-family:Georgia,Times,serif;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070706;margin:0;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff8e8;border:1px solid #c9a24a;border-radius:18px;overflow:hidden;">',
    '<tr>',
    '<td style="background:#11100d;padding:26px 28px;border-bottom:1px solid rgba(201,162,74,0.45);">',
    '<div style="color:#c9a24a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">MyKinLegacy</div>',
    '<div style="color:#f7ead0;font-size:28px;line-height:1.1;font-weight:bold;margin-top:8px;">Your Private Vault Is Ready</div>',
    '<div style="color:#d8c9aa;font-size:14px;line-height:1.6;margin-top:10px;">A private Family Legacy Collection has been prepared for your order.</div>',
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:28px;">',
    `<p style="margin:0 0 16px;color:#342b1e;font-size:16px;line-height:1.65;">Hello,</p>`,
    `<p style="margin:0 0 18px;color:#342b1e;font-size:16px;line-height:1.65;">Your MyKinLegacy private vault is ready for order <strong>${orderNumber}</strong>.</p>`,
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">',
    '<tr>',
    `<td style="border-radius:999px;background:#c9a24a;"><a href="${vaultLink}" style="display:inline-block;padding:14px 22px;color:#11100d;text-decoration:none;font-size:15px;font-weight:bold;border-radius:999px;">Open Your Private Vault</a></td>`,
    '</tr>',
    '</table>',
    '<div style="background:#f3ead7;border:1px solid #dbc083;border-radius:14px;padding:16px 18px;margin:0 0 20px;">',
    '<p style="margin:0;color:#5d4a2b;font-size:14px;line-height:1.6;"><strong>What is inside:</strong> your private Family Legacy Collection artifacts, including symbolic crest artwork, a heritage certificate, family story materials, a symbol guide, and the complete collection archive.</p>',
    '</div>',
    `<p style="margin:0 0 10px;color:#5d4a2b;font-size:14px;line-height:1.6;"><strong>Privacy note:</strong> this vault link is private to your order. Keep it somewhere safe and share it only with trusted family members.</p>`,
    `<p style="margin:0 0 10px;color:#5d4a2b;font-size:14px;line-height:1.6;"><strong>Link expiration:</strong> ${expiresAt}</p>`,
    `<p style="margin:0 0 22px;color:#5d4a2b;font-size:14px;line-height:1.6;"><strong>Need help?</strong> Contact <a href="mailto:${supportEmail}" style="color:#8d6a17;">${supportEmail}</a>.</p>`,
    `<p style="margin:0;color:#6f614c;font-size:12px;line-height:1.6;border-top:1px solid #e2d1ac;padding-top:18px;">${disclaimer}</p>`,
    '</td>',
    '</tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
