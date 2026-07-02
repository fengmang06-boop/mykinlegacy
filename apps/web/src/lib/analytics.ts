export type AnalyticsEventName =
  | "funnel_step_viewed"
  | "funnel_step_completed"
  | "checkout_completed"
  | "payment_success"
  | "vault_opened"
  | "email_sent_confirmed"
  | "artifact_downloaded"
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
  "email",
  "surname",
  "family_story",
  "private_notes",
  "raw_prompt",
  "rendered_prompt",
  "signed_url",
  "download_token",
  "token",
  "vault_token",
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
    const normalizedKey = key.toLowerCase();
    if (BLOCKED_KEYS.has(normalizedKey) || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
      continue;
    }
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

export function trackEvent(
  eventName: AnalyticsEventName,
  payload: Record<string, unknown> = {},
  options: { durationMs?: number; stepName?: string } = {}
): void {
  const sanitized = sanitizeAnalyticsPayload(payload);
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true" && Object.keys(sanitized).length > 0) {
    console.debug("[analytics]", eventName, sanitized);
  } else if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
    console.debug("[analytics]", eventName);
  }

  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    data: {
      event_name: eventName,
      order_id: typeof sanitized.order_id === "string" ? sanitized.order_id : undefined,
      order_number: typeof sanitized.order_number === "string" ? sanitized.order_number : undefined,
      step_name: options.stepName ?? stepNameForEvent(eventName, sanitized),
      duration_ms: options.durationMs,
      client_timestamp: new Date().toISOString(),
      metadata: sanitized
    }
  });

  const url = `${analyticsBaseUrl()}/analytics/events`;
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (sent) {
      return;
    }
  }

  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
    keepalive: true
  }).catch(() => {
    // Analytics must never block checkout, payment, vault, or download flows.
  });
}

export function trackFunnelStepViewed(stepName: string, payload: Record<string, unknown> = {}): () => void {
  const startedAt = now();
  trackEvent("funnel_step_viewed", { ...payload, step_name: stepName }, { stepName });
  return () => {
    trackEvent(
      "funnel_step_completed",
      { ...payload, step_name: stepName },
      { stepName, durationMs: Math.round(now() - startedAt) }
    );
  };
}

function analyticsBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
  return raw.replace(/\/$/, "");
}

function stepNameForEvent(eventName: AnalyticsEventName, payload: Record<string, unknown>): string {
  if (typeof payload.step_name === "string") {
    return payload.step_name;
  }
  return eventName;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeAnalyticsPayload(value as Record<string, unknown>);
  }
  return undefined;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
