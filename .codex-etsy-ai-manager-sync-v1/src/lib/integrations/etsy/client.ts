import { assertNoEtsyWriteCapability, assertEtsyReadOnlyRequest, validateEtsyReadOnlyEnv } from "./read-only-guard";
import { refreshAccessToken } from "./oauth";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

type EtsyClientOptions = {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  shopId?: string;
};

type EtsyAuthOptions = Omit<EtsyClientOptions, "shopId">;

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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Etsy API request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
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

export async function fetchShopListings(options?: EtsyClientOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetch<{ results?: EtsyListingSummary[]; count?: number }>(`/shops/${shopId}/listings/active?limit=100`, {}, { ...options, shopId });
}

export async function fetchListings(options?: EtsyClientOptions) {
  return fetchShopListings(options);
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

export async function fetchReceipts(options?: EtsyClientOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetch(`/shops/${shopId}/receipts?limit=100`, {}, { ...options, shopId });
}

export async function fetchTransactions(options?: EtsyClientOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetch(`/shops/${shopId}/transactions?limit=100`, {}, { ...options, shopId });
}

export async function fetchReviews(options?: EtsyClientOptions) {
  const shopId = await resolveEtsyShopId(options);
  return etsyFetch(`/shops/${shopId}/reviews?limit=100`, {}, { ...options, shopId });
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
