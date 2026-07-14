export type AnalyticsEventName =
  | "funnel_step_viewed"
  | "funnel_step_completed"
  | "checkout_completed"
  | "payment_success"
  | "vault_opened"
  | "founder_delivery_approved"
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

export type Ga4EventName =
  | "homepage_view"
  | "real_examples_view"
  | "gift_landing_view"
  | "create_started"
  | "questionnaire_completed"
  | "checkout_started"
  | "purchase_completed"
  | "founder_delivery_approved"
  | "vault_opened"
  | "collection_downloaded";

export interface Ga4Event {
  name: Ga4EventName;
  params: Record<string, string | boolean>;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

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
  try {
    const sanitized = sanitizeAnalyticsPayload(payload);
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true" && Object.keys(sanitized).length > 0) {
      console.debug("[analytics]", eventName, sanitized);
    } else if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
      console.debug("[analytics]", eventName);
    }

    if (typeof window === "undefined") {
      return;
    }

    sendGa4Event(eventName, sanitized, options);

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
    try {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        if (sent) {
          return;
        }
      }
    } catch {
      // Fall through to fetch. Analytics must never crash customer pages.
    }

    try {
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        keepalive: true
      }).catch(() => {
        // Analytics must never block checkout, payment, vault, or download flows.
      });
    } catch {
      // Analytics must never block checkout, payment, vault, or download flows.
    }
  } catch {
    // Analytics must never block checkout, payment, vault, or download flows.
  }
}

export function ga4EventFor(
  eventName: AnalyticsEventName,
  payload: Record<string, unknown> = {},
  options: { stepName?: string } = {}
): Ga4Event | null {
  const stepName = options.stepName ?? stepNameForEvent(eventName, payload);
  let name: Ga4EventName | null = null;

  if (eventName === "funnel_step_viewed") {
    name =
      stepName === "landing_page"
        ? "homepage_view"
        : stepName === "real_examples"
          ? "real_examples_view"
          : stepName === "gift_landing"
            ? "gift_landing_view"
            : stepName === "create_page"
              ? "create_started"
              : null;
  } else if (eventName === "funnel_step_completed" && stepName === "guided_interview") {
    name = "questionnaire_completed";
  } else if (eventName === "checkout_started") {
    name = "checkout_started";
  } else if (eventName === "payment_success") {
    name = "purchase_completed";
  } else if (eventName === "founder_delivery_approved") {
    name = "founder_delivery_approved";
  } else if (eventName === "vault_opened") {
    name = "vault_opened";
  } else if (
    eventName === "artifact_downloaded" &&
    (payload.deliverable_code === "download_package_zip" || payload.file_ext === "zip")
  ) {
    name = "collection_downloaded";
  }

  if (!name) {
    return null;
  }

  const params: Record<string, string | boolean> = {};
  if (typeof window !== "undefined") {
    params.page_path = window.location.pathname;
  }
  if (name === "gift_landing_view" && typeof payload.gift_slug === "string") {
    params.gift_slug = payload.gift_slug.slice(0, 80);
  }
  if (typeof payload.source === "string" && /^(order_status|download_vault)$/.test(payload.source)) {
    params.source = payload.source;
  }
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
    params.debug_mode = true;
  }

  return { name, params };
}

function sendGa4Event(
  eventName: AnalyticsEventName,
  payload: Record<string, unknown>,
  options: { stepName?: string }
): void {
  try {
    const event = ga4EventFor(eventName, payload, options);
    if (!event || typeof window.gtag !== "function") {
      return;
    }
    window.gtag("event", event.name, event.params);
  } catch {
    // Measurement must never block customer flows.
  }
}

export function trackFunnelStepViewed(stepName: string, payload: Record<string, unknown> = {}): () => void {
  const startedAt = safeNow();
  try {
    trackEvent("funnel_step_viewed", { ...payload, step_name: stepName }, { stepName });
  } catch {
    // Analytics must never crash customer pages.
  }
  return () => {
    try {
      trackEvent(
        "funnel_step_completed",
        { ...payload, step_name: stepName },
        { stepName, durationMs: Math.round(safeNow() - startedAt) }
      );
    } catch {
      // Analytics must never crash customer pages.
    }
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

function safeNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
