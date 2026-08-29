export type AnalyticsEventName =
  | "landing_view"
  | "collection_view"
  | "examples_view"
  | "create_started"
  | "intake_stage_started"
  | "intake_stage_completed"
  | "questionnaire_completed"
  | "stripe_checkout_created"
  | "payment_submitted"
  | "purchase_completed"
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
  | "landing_view"
  | "collection_view"
  | "examples_view"
  | "homepage_view"
  | "real_examples_view"
  | "journal_view"
  | "journal_article_view"
  | "gift_landing_view"
  | "landing_cta_clicked"
  | "create_started"
  | "intake_stage_started"
  | "intake_stage_completed"
  | "interview_step_completed"
  | "questionnaire_completed"
  | "order_created"
  | "consent_completed"
  | "checkout_started"
  | "stripe_checkout_created"
  | "payment_submitted"
  | "checkout_cancelled"
  | "purchase_completed"
  | "founder_delivery_approved"
  | "vault_opened"
  | "collection_downloaded";

export interface Ga4Event {
  name: Ga4EventName;
  params: Record<string, string | boolean>;
}

export type TrafficType =
  | "REAL_VISITOR"
  | "OWNER_INTERNAL"
  | "CODEX_QA"
  | "AUTOMATED_MONITOR"
  | "DEVELOPMENT"
  | "UNKNOWN";

export interface AnalyticsContext {
  session_id?: string;
  source: string;
  medium: string;
  landing_page: string;
  device_category: "mobile" | "tablet" | "desktop" | "unknown";
  traffic_type: TrafficType;
  traffic_type_reason: string;
  reporting_raw: true;
  reporting_excluded_internal: boolean;
  reporting_estimated_external: boolean;
}

const INTERNAL_TRAFFIC = new Set<TrafficType>([
  "OWNER_INTERNAL",
  "CODEX_QA",
  "AUTOMATED_MONITOR",
  "DEVELOPMENT"
]);

const TRAFFIC_TYPES = new Set<TrafficType>([
  "REAL_VISITOR",
  "OWNER_INTERNAL",
  "CODEX_QA",
  "AUTOMATED_MONITOR",
  "DEVELOPMENT",
  "UNKNOWN"
]);

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

    const context = analyticsContext();
    sendGa4Event(eventName, sanitized, options, context);

    const flowId = context.session_id;
    const body = JSON.stringify({
      data: {
        event_name: eventName,
        order_id: typeof sanitized.order_id === "string" ? sanitized.order_id : undefined,
        order_number: typeof sanitized.order_number === "string" ? sanitized.order_number : undefined,
        step_name: options.stepName ?? stepNameForEvent(eventName, sanitized),
        duration_ms: options.durationMs,
        client_timestamp: new Date().toISOString(),
        metadata: {
          ...sanitized,
          ...context,
          ...(flowId ? { flow_id: flowId } : {})
        }
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

  if (
    eventName === "landing_view" ||
    eventName === "collection_view" ||
    eventName === "examples_view" ||
    eventName === "create_started" ||
    eventName === "intake_stage_started" ||
    eventName === "intake_stage_completed" ||
    eventName === "questionnaire_completed" ||
    eventName === "checkout_started" ||
    eventName === "stripe_checkout_created" ||
    eventName === "payment_submitted" ||
    eventName === "purchase_completed"
  ) {
    name = eventName;
  } else if (eventName === "funnel_step_viewed") {
    name =
      stepName === "landing_page"
        ? "homepage_view"
        : stepName === "real_examples"
          ? "real_examples_view"
          : stepName === "gift_landing"
            ? "gift_landing_view"
            : stepName === "journal_landing"
              ? "journal_view"
              : stepName === "journal_article"
                ? "journal_article_view"
                : null;
  } else if (eventName === "landing_cta_clicked") {
    name = "landing_cta_clicked";
  } else if (eventName === "interview_started") {
    name = "create_started";
  } else if (eventName === "interview_step_completed") {
    name = "interview_step_completed";
  } else if (eventName === "funnel_step_completed" && stepName === "guided_interview") {
    name = "questionnaire_completed";
  } else if (eventName === "order_created") {
    name = "order_created";
  } else if (eventName === "consent_completed") {
    name = "consent_completed";
  } else if (eventName === "checkout_cancelled") {
    name = "checkout_cancelled";
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
  if (name === "journal_article_view" && typeof payload.article_slug === "string") {
    params.article_slug = payload.article_slug.slice(0, 80);
  }
  if (name === "landing_cta_clicked" && typeof payload.source === "string") {
    params.source = payload.source.slice(0, 80);
  }
  if (
    name === "landing_cta_clicked" &&
    typeof payload.destination === "string" &&
    /^\/[a-z0-9/_-]*$/i.test(payload.destination)
  ) {
    params.destination = payload.destination.slice(0, 80);
  }
  if (name === "interview_step_completed" && typeof payload.step_code === "string") {
    params.step_code = payload.step_code.slice(0, 80);
  }
  if (
    (name === "intake_stage_started" || name === "intake_stage_completed") &&
    typeof payload.stage_code === "string"
  ) {
    params.stage_code = payload.stage_code.slice(0, 80);
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
  options: { stepName?: string },
  context: AnalyticsContext
): void {
  try {
    const event = ga4EventFor(eventName, payload, options);
    if (!event || typeof window.gtag !== "function") {
      return;
    }
    window.gtag("event", event.name, {
      ...event.params,
      session_id: context.session_id,
      source: context.source,
      medium: context.medium,
      landing_page: context.landing_page,
      device_category: context.device_category,
      traffic_type: context.traffic_type,
      traffic_type_reason: context.traffic_type_reason,
      reporting_view: context.reporting_excluded_internal ? "EXCLUDED_INTERNAL" : "ESTIMATED_EXTERNAL"
    });
  } catch {
    // Measurement must never block customer flows.
  }
}

export function trackFunnelStepViewed(stepName: string, payload: Record<string, unknown> = {}): void {
  try {
    const viewEvent = canonicalViewEvent(stepName);
    if (viewEvent) {
      trackEvent(viewEvent, payload, { stepName });
    }
    trackEvent("funnel_step_viewed", { ...payload, step_name: stepName }, { stepName });
  } catch {
    // Analytics must never crash customer pages.
  }
}

function canonicalViewEvent(stepName: string): AnalyticsEventName | null {
  if (stepName === "landing_page") return "landing_view";
  if (stepName === "collection_page") return "collection_view";
  if (stepName === "real_examples") return "examples_view";
  if (stepName === "checkout") return "checkout_started";
  return null;
}

export function analyticsContext(): AnalyticsContext {
  if (typeof window === "undefined") {
    return {
      source: "unknown",
      medium: "unknown",
      landing_page: "unknown",
      device_category: "unknown",
      traffic_type: "UNKNOWN",
      traffic_type_reason: "server_render",
      reporting_raw: true,
      reporting_excluded_internal: false,
      reporting_estimated_external: false
    };
  }

  const traffic = classifyTraffic();
  const attribution = firstPartyAttribution();
  const excluded = INTERNAL_TRAFFIC.has(traffic.type);
  return {
    session_id: firstPartyFlowId(),
    ...attribution,
    device_category: deviceCategory(),
    traffic_type: traffic.type,
    traffic_type_reason: traffic.reason,
    reporting_raw: true,
    reporting_excluded_internal: excluded,
    reporting_estimated_external: !excluded && traffic.type !== "UNKNOWN"
  };
}

export function classifyTraffic(): { type: TrafficType; reason: string } {
  if (typeof window === "undefined") return { type: "UNKNOWN", reason: "server_render" };
  if (
    process.env.NODE_ENV === "development" ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
  ) {
    return { type: "DEVELOPMENT", reason: "development_runtime" };
  }

  const query = new URLSearchParams(window.location.search);
  const queryMarker = normalizeTrafficType(query.get("mkl_traffic_type") ?? query.get("traffic_type"));
  const qaMarker = query.get("mkl_qa")?.toLowerCase() === "codex" ? "CODEX_QA" : undefined;
  const testMarker = query.get("mkl_test") === "1" ? "CODEX_QA" : undefined;
  const explicitMarker = queryMarker ?? qaMarker ?? testMarker;
  if (explicitMarker) {
    persistTrafficType(explicitMarker);
    return { type: explicitMarker, reason: "explicit_query_marker" };
  }

  const cookieMarker = normalizeTrafficType(
    readCookie("mkl_traffic_type") ?? readCookie("traffic_type")
  );
  if (cookieMarker) return { type: cookieMarker, reason: "explicit_cookie_marker" };

  const userAgent = window.navigator?.userAgent ?? "";
  if (/MyKinLegacyReadOnlyMonitor|Lighthouse|Playwright|HeadlessChrome|bot\b|crawler|spider/i.test(userAgent)) {
    return { type: "AUTOMATED_MONITOR", reason: "automated_user_agent" };
  }
  if (/Mozilla|Chrome|Safari|Firefox|Edg/i.test(userAgent)) {
    return { type: "REAL_VISITOR", reason: "standard_browser_without_internal_marker" };
  }
  return { type: "UNKNOWN", reason: "unclassified_user_agent" };
}

function firstPartyAttribution(): Pick<AnalyticsContext, "source" | "medium" | "landing_page"> {
  const fallback = { source: "direct", medium: "none", landing_page: window.location.pathname };
  try {
    const key = "mykinlegacy_conversion_attribution";
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing) as Partial<typeof fallback>;
      if (parsed.source && parsed.medium && parsed.landing_page) return parsed as typeof fallback;
    }
    const query = new URLSearchParams(window.location.search);
    const campaignSource = safeAttributionValue(query.get("utm_source"));
    const campaignMedium = safeAttributionValue(query.get("utm_medium"));
    let source = campaignSource ?? "direct";
    let medium = campaignMedium ?? "none";
    if (!campaignSource && document.referrer) {
      const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, "");
      source = safeAttributionValue(host) ?? "referral";
      medium = /(^|\.)google\.|(^|\.)bing\.|(^|\.)yahoo\.|duckduckgo\./.test(host)
        ? "organic"
        : "referral";
    }
    const created = {
      source,
      medium,
      landing_page: window.location.pathname.slice(0, 120) || "/"
    };
    window.sessionStorage.setItem(key, JSON.stringify(created));
    return created;
  } catch {
    return fallback;
  }
}

function deviceCategory(): AnalyticsContext["device_category"] {
  const width = window.innerWidth;
  if (!Number.isFinite(width) || width <= 0) return "unknown";
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

function normalizeTrafficType(value: string | null | undefined): TrafficType | undefined {
  const normalized = value?.trim().toUpperCase() as TrafficType | undefined;
  return normalized && TRAFFIC_TYPES.has(normalized) ? normalized : undefined;
}

function persistTrafficType(type: TrafficType): void {
  try {
    document.cookie = `mkl_traffic_type=${type}; Max-Age=2592000; Path=/; SameSite=Lax; Secure`;
  } catch {
    // Classification remains valid for this event even if cookies are unavailable.
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function safeAttributionValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._/-]{1,80}$/.test(normalized) ? normalized : undefined;
}
function firstPartyFlowId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const key = "mykinlegacy_conversion_flow_id";
    const existing = window.sessionStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return undefined;
  }
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
