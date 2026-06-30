export type AnalyticsEventName =
  | "landing_cta_clicked"
  | "product_viewed"
  | "interview_started"
  | "interview_step_completed"
  | "interview_abandoned"
  | "house_dna_confirmed"
  | "order_created"
  | "consent_completed"
  | "checkout_started"
  | "checkout_cancelled"
  | "founder_demo_payment_completed"
  | "founder_demo_collection_ready"
  | "founder_demo_vault_opened"
  | "payment_success_returned"
  | "payment_verified"
  | "generation_status_viewed"
  | "download_vault_opened"
  | "asset_download_clicked"
  | "zip_download_clicked"
  | "support_clicked";

const BLOCKED_KEYS = new Set([
  "surname",
  "family_story",
  "private_notes",
  "raw_prompt",
  "rendered_prompt",
  "signed_url",
  "payment_secret",
  "house_dna",
  "storage_key",
  "storage_bucket",
  "provider",
  "api_key",
  "customer_email"
]);

export function sanitizeAnalyticsPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = typeof value === "string" && value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
  return sanitized;
}

export function trackEvent(eventName: AnalyticsEventName, payload: Record<string, unknown> = {}): void {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG !== "true") {
    return;
  }
  const sanitized = sanitizeAnalyticsPayload(payload);
  if (Object.keys(sanitized).length > 0) {
    console.debug("[analytics]", eventName, sanitized);
  } else {
    console.debug("[analytics]", eventName);
  }
}
