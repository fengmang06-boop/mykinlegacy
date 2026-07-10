import { assertNoEtsyWriteCapability, assertEtsyReadOnlyRequest, validateEtsyReadOnlyEnv } from "./read-only-guard";
import { refreshAccessToken } from "./oauth";
import {
  assertEtsyRateBudget,
  isDailyRateLimitResponse,
  recordEtsyRateLimitHeaders,
  type EtsyRequestClass
} from "./rate-limit";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";
const ETSY_MIN_REQUEST_INTERVAL_MS = 350;
const ETSY_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGINATED_ITEMS = Number(process.env.ETSY_MAX_SYNC_ITEMS ?? "2500");

let nextEtsyRequestAt = 0;

type EtsyClientOptions = {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  shopId?: string;
  requestClass?: EtsyRequestClass;
};

type EtsyAuthOptions = Omit<EtsyClientOptions, "shopId" | "requestClass">;

export type EtsyListingSummary = {
  listing_id: number;
  title?: string;
  description?: string;
  price?: { amount?: number; divisor?: number; currency_code?: string } | string | number;
  quantity?: number;
  state?: string;
  tags?: string[];
  materials?: string[];
  taxonomy_path?: string[];
  url?: string;
  updated_timestamp?: number;
  last_modified_timestamp?: number;
  last_modified_tsz?: number;
};

export type EtsyTokenRefreshResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

export type EtsyMeResponse = {
  user_id?: number | string;
  shop_id?: number | string;
  primary_shop_id?: number | string;
  login_name?: string;
};

export type EtsyConnectedShop = {
  userId: string;
  shopId: string;
  shopName: string;
};

type EtsyPaginatedResponse<T> = {
  results?: T[];
  count?: number;
};

type EtsyPaginationOptions = {
  maxItems?: number;
};

function readAuthOptions(options?: EtsyAuthOptions): Required<EtsyAuthOptions> {
  const clientId = options?.clientId ?? process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = options?.clientSecret ?? process.env.ETSY_CLIENT_SECRET ?? "";
  const accessToken = options?.accessToken ?? process.env.ETSY_ACCESS_TOKEN ?? "";

  if (!clientId) throw new Error("Missing ETSY_CLIENT_ID. Add it to .env.local.");
  if (!clientSecret) throw new Error("Missing ETSY_CLIENT_SECRET. Add it to .env.local.");
  if (!accessToken) throw new Error("Missing ETSY_ACCESS_TOKEN. Complete OAuth and add it to .env.local.");

  return { clientId, clientSecret, accessToken };
}

function assignTokenRefresh(token: { access_token: string; refresh_token?: string; expires_in: number }): EtsyTokenRefreshResult {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  process.env.ETSY_ACCESS_TOKEN = token.access_token;
  if (token.refresh_token) process.env.ETSY_REFRESH_TOKEN = token.refresh_token;
  process.env.ETSY_TOKEN_EXPIRES_AT = expiresAt;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEtsySlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextEtsyRequestAt - now);
  nextEtsyRequestAt = Math.max(now, nextEtsyRequestAt) + ETSY_MIN_REQUEST_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

function retryDelay(attempt: number, response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 10000);
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

export async function refreshEtsyTokenIfNeeded(force = false): Promise<EtsyTokenRefreshResult | null> {
  const expiresAt = process.env.ETSY_TOKEN_EXPIRES_AT ? new Date(process.env.ETSY_TOKEN_EXPIRES_AT) : null;
  const expiresSoon = expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : false;
  if (!force && !expiresSoon) return null;
  if (!process.env.ETSY_REFRESH_TOKEN) return null;
  const token = await refreshAccessToken();
  return assignTokenRefresh(token);
}

async function requestEtsy<T>(path: string, init: RequestInit = {}, options?: EtsyClientOptions): Promise<T> {
  assertEtsyReadOnlyRequest(init.method ?? "GET");
  const config = readAuthOptions(options);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assertEtsyRateBudget(options?.requestClass ?? "interactive");
    await waitForEtsySlot();
    const response = await fetch(`${ETSY_API_BASE}${path}`, {
      ...init,
      method: init.method ?? "GET",
      headers: {
        "x-api-key": `${config.clientId}:${config.clientSecret}`,
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/json",
        ...(init.headers ?? {})
      }
    });
    recordEtsyRateLimitHeaders(response.headers, response.status, path);

    if (response.ok) {
      return (await response.json()) as T;
    }

    const body = await response.text();
    if (isDailyRateLimitResponse(response, body)) {
      const exhaustedHeaders = new Headers(response.headers);
      exhaustedHeaders.set("x-remaining-today", "0");
      recordEtsyRateLimitHeaders(exhaustedHeaders, response.status, path);
      throw new Error(`Etsy API daily rate limit reached: ${response.status} ${body}`);
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 2) {
      await sleep(retryDelay(attempt, response));
      continue;
    }

    throw new Error(`Etsy API request failed: ${response.status} ${body}`);
  }

  throw new Error("Etsy API request failed after retries.");
}

async function etsyFetch<T>(path: string, init: RequestInit = {}, options?: EtsyClientOptions): Promise<T> {
  assertEtsyReadOnlyRequest(init.method ?? "GET");
  await refreshEtsyTokenIfNeeded(false);
  try {
    return await requestEtsy<T>(path, init, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Etsy API request failed: 401/.test(message)) throw error;
    const refreshed = await refreshEtsyTokenIfNeeded(true);
    if (!refreshed) throw error;
    return requestEtsy<T>(path, init, { ...options, accessToken: refreshed.accessToken });
  }
}

function withPagination(path: string, limit: number, offset: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}

async function etsyFetchAllPages<T>(
  path: string,
  options?: EtsyClientOptions,
  pagination: EtsyPaginationOptions = {}
): Promise<EtsyPaginatedResponse<T> & { pages: number }> {
  const maxItems = Math.max(ETSY_PAGE_SIZE, pagination.maxItems ?? DEFAULT_MAX_PAGINATED_ITEMS);
  const results: T[] = [];
  let count: number | undefined;
  let pages = 0;

  for (let offset = 0; offset < maxItems; offset += ETSY_PAGE_SIZE) {
    const page = await etsyFetch<EtsyPaginatedResponse<T>>(withPagination(path, ETSY_PAGE_SIZE, offset), {}, options);
    const pageResults = Array.isArray(page.results) ? page.results : [];
    results.push(...pageResults);
    count = typeof page.count === "number" ? page.count : count;
    pages += 1;

    if (!pageResults.length) break;
    if (typeof count === "number" && results.length >= count) break;
    if (pageResults.length < ETSY_PAGE_SIZE) break;
  }

  return {
    results: results.slice(0, maxItems),
    count,
    pages
  };
}

export function validateEtsyClientEnv(): { ok: true } | { ok: false; errors: string[] } {
  return validateEtsyReadOnlyEnv();
}

export async function fetchMe(options?: EtsyClientOptions) {
  return etsyFetch<EtsyMeResponse>("/users/me", {}, options);
}

export async function resolveEtsyShopId(options?: EtsyClientOptions): Promise<string> {
  const envShopId = options?.shopId ?? process.env.ETSY_SHOP_ID;
  if (envShopId) return envShopId;

  const me = await fetchMe(options);
  const shopId = me.shop_id ?? me.primary_shop_id;
  if (!shopId) {
    throw new Error("Etsy getMe did not return a shop_id. Confirm the connected account owns a shop.");
  }
  return String(shopId);
}

export async function fetchShop(options?: EtsyClientOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetch(`/shops/${shopId}`, {}, { ...options, shopId });
}

export async function fetchShopListings(options?: EtsyClientOptions, pagination?: EtsyPaginationOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetchAllPages<EtsyListingSummary>(`/shops/${shopId}/listings/active`, { ...options, shopId }, pagination);
}

export async function fetchListings(options?: EtsyClientOptions, pagination?: EtsyPaginationOptions) {
  return fetchShopListings(options, pagination);
}

export async function fetchListingDetails(listingId: string | number, options?: EtsyClientOptions) {
  return etsyFetch<EtsyListingSummary>(`/listings/${listingId}`, {}, options);
}

export async function fetchListingImages(listingId: string | number, options?: EtsyClientOptions) {
  return etsyFetch<{ results?: Array<{ listing_image_id: number | string; url_fullxfull?: string; alt_text?: string; rank?: number }> }>(
    `/listings/${listingId}/images`,
    {},
    options
  );
}

export async function fetchListingInventory(listingId: string | number, options?: EtsyClientOptions) {
  return etsyFetch<{
    products?: Array<{
      product_id?: number | string;
      sku?: string;
      is_deleted?: boolean;
      offerings?: Array<{
        quantity?: number;
        is_enabled?: boolean;
        price?: { amount?: number; divisor?: number; currency_code?: string } | string | number;
      }>;
      property_values?: unknown[];
    }>;
  }>(`/listings/${listingId}/inventory?max_variations_supported=3`, {}, options);
}

export async function fetchReceipts(options?: EtsyClientOptions, pagination?: EtsyPaginationOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetchAllPages<Record<string, unknown>>(`/shops/${shopId}/receipts`, { ...options, shopId }, pagination);
}

export async function fetchTransactions(options?: EtsyClientOptions, pagination?: EtsyPaginationOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetchAllPages<Record<string, unknown>>(`/shops/${shopId}/transactions`, { ...options, shopId }, pagination);
}

export async function fetchReviews(options?: EtsyClientOptions, pagination?: EtsyPaginationOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetchAllPages<Record<string, unknown>>(`/shops/${shopId}/reviews`, { ...options, shopId }, pagination);
}

export async function fetchTaxonomy(options?: EtsyClientOptions) {
  return etsyFetch("/seller-taxonomy/nodes", {}, options);
}

export async function fetchConnectedShop(options?: EtsyClientOptions): Promise<EtsyConnectedShop> {
  const me = await fetchMe(options);
  const shopId = String(me.shop_id ?? me.primary_shop_id ?? options?.shopId ?? process.env.ETSY_SHOP_ID ?? "");
  if (!shopId) {
    throw new Error("Etsy getMe did not return a shop_id. Confirm the connected account owns a shop.");
  }

  const shop = (await fetchShop({ ...options, shopId })) as { shop_id?: number | string; shop_name?: string; name?: string };
  return {
    userId: String(me.user_id ?? ""),
    shopId,
    shopName: shop.shop_name ?? shop.name ?? "Connected Etsy Shop"
  };
}

export async function updateListingDraft(): Promise<never> {
  assertNoEtsyWriteCapability();
  throw new Error("Etsy API write/update is disabled in v1.5 read-only mode.");
}

export async function updateInventory(): Promise<never> {
  assertNoEtsyWriteCapability();
  throw new Error("Etsy API write/update is disabled in v1.5 read-only mode.");
}
