export interface ApiEnvelope<T> {
  request_id: string;
  correlation_id: string;
  success: boolean;
  data: T | null;
  error: ErrorContract | null;
}

export interface ErrorContract {
  contract_version: "1.1";
  error_code: string;
  user_message: string;
  retryable: boolean;
  severity: string;
}

export class ApiClientError extends Error {
  constructor(readonly contract: ErrorContract) {
    super(contract.user_message);
    this.name = "ApiClientError";
  }
}

export interface ProductDetail {
  product_code: string;
  translations: Array<{ locale: string; name: string; short_description: string | null }>;
  packages: Array<{
    package_code: string;
    price_cents: number;
    currency: string;
    deliverables: Array<{
      deliverable_code: string;
      deliverable_type: string;
      format: string;
      quantity: number;
      required: boolean;
    }>;
  }>;
}

export interface OrderStatus {
  order_number: string;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  amount?: { total_cents: number };
  currency?: string;
  generation_manifest?: {
    expected_assets_count?: number;
    generated_assets_count?: number;
    manifest_status?: string;
    meaning_profile?: VaultMeaningProfile | null;
  } | null;
  download_ready?: boolean;
}

export interface VaultMeaningProfile {
  source_level?: string | null;
  themes?: Array<{ theme?: string | null; confidence?: string | null; evidence?: string | null }>;
  symbols?: Array<{
    symbol?: string | null;
    meaning?: string | null;
    rationale?: string | null;
    source?: string | null;
  }>;
  design_rationale?: string[];
  story_direction?: string | null;
  certificate_direction?: string | null;
  boundary_statement?: string | null;
  validation?: {
    valid?: boolean;
    quality_flags?: string[];
    banned_claims_found?: string[];
  };
}

export interface DownloadVault {
  order_number: string;
  download_token_status: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  assets_ready: boolean;
  assets_summary: Array<Record<string, unknown>>;
  disclaimer: string;
}

export interface DownloadAsset {
  asset_id: string;
  deliverable_code: string;
  friendly_name: string;
  asset_type: string;
  file_ext: string;
  mime_type: string;
  size_bytes: number;
  available: boolean;
  status: string;
}

export interface FounderDemoPayment {
  order_number: string;
  download_token: string;
  collection_ready_url: string;
}

export interface FounderDemoInterview {
  interview_id: string;
  current_step: string;
  expires_at: string;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000/api/v1") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  createInterview() {
    return this.request<{ interview_id: string; current_step: string; expires_at: string }>("/interviews", {
      method: "POST",
      body: { locale: "en-US" },
      idempotent: true
    });
  }

  getInterview(interviewId: string) {
    return this.request<Record<string, unknown>>(`/interviews/${encodeURIComponent(interviewId)}`);
  }

  submitInterviewAnswer(interviewId: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/interviews/${encodeURIComponent(interviewId)}/answers`, {
      method: "POST",
      body,
      idempotent: true
    });
  }

  normalizeInterviewInput(interviewId: string, rawInput: string) {
    return this.request<Record<string, unknown>>(`/interviews/${encodeURIComponent(interviewId)}/normalize`, {
      method: "POST",
      body: { raw_input: rawInput },
      idempotent: true
    });
  }

  confirmHouseDNA(interviewId: string, houseDna?: Record<string, unknown>) {
    return this.request<{ house_id: string; identity_version_id: string }>(
      `/interviews/${encodeURIComponent(interviewId)}/confirm`,
      {
        method: "POST",
        body: houseDna ? { house_dna: houseDna } : {},
        idempotent: true
      }
    );
  }

  getProducts() {
    return this.request<{ products: ProductDetail[] }>("/products");
  }

  getProductDetail(productCode: string) {
    return this.request<ProductDetail>(`/products/${encodeURIComponent(productCode)}`);
  }

  createOrder(body: Record<string, unknown>) {
    return this.request<OrderStatus>("/orders", { method: "POST", body, idempotent: true });
  }

  createConsent(orderNumber: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/orders/${encodeURIComponent(orderNumber)}/consent`, {
      method: "POST",
      body,
      idempotent: true
    });
  }

  createStripeCheckoutSession(body: Record<string, unknown>) {
    return this.request<{ checkout_url: string; checkout_session_id: string; expires_at: string }>(
      "/payments/stripe/create-checkout-session",
      { method: "POST", body, idempotent: true }
    );
  }

  createFounderDemoPayment(orderNumber: string): FounderDemoPayment {
    const token = `dev-demo-${orderNumber}-${createClientId()}`;
    return {
      order_number: orderNumber,
      download_token: token,
      collection_ready_url: `/payment/success?order_number=${encodeURIComponent(orderNumber)}&demo=1&token=${encodeURIComponent(token)}`
    };
  }

  createFounderDemoInterview(): FounderDemoInterview {
    return {
      interview_id: `founder-demo-${createClientId()}`,
      current_step: "name_your_house",
      expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString()
    };
  }

  getOrderStatus(orderNumber: string) {
    return this.request<OrderStatus>(`/orders/${encodeURIComponent(orderNumber)}`);
  }

  getDownloadVault(token: string) {
    return this.request<DownloadVault>(`/downloads/${encodeURIComponent(token)}`);
  }

  getDownloadAssets(token: string) {
    return this.request<DownloadAsset[]>(`/downloads/${encodeURIComponent(token)}/assets`);
  }

  createSignedAssetUrl(token: string, assetId: string) {
    return this.request<{ asset_id: string; signed_url: string; expires_at: string }>(
      `/downloads/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}/signed-url`,
      { method: "POST", idempotent: true }
    );
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: Record<string, unknown>; idempotent?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-request-id": createClientId(),
      "x-correlation-id": getCorrelationId()
    };
    if (options.idempotent) {
      headers["idempotency-key"] = createClientId();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify({ data: options.body }) : undefined,
      cache: "no-store"
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || !envelope.success || envelope.error) {
      throw new ApiClientError(
        envelope.error ?? {
          contract_version: "1.1",
          error_code: "network_error",
          user_message: "The request could not be completed.",
          retryable: true,
          severity: "medium"
        }
      );
    }
    return envelope.data as T;
  }
}

export function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getCorrelationId(): string {
  if (typeof window === "undefined") {
    return createClientId();
  }
  const key = "ai_heritage_correlation_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const next = createClientId();
  window.sessionStorage.setItem(key, next);
  return next;
}
