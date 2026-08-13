const crypto = require("node:crypto");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const SHOP_ID = "25333110";
const RESERVE_PERCENT = 20;
const LISTING_IDS = [
  "4432511462",
  "1865435490",
  "878616671",
  "4365584443",
  "4516749377",
  "4434426954",
  "949279802",
  "1883023114",
];

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") {
  throw new Error("ETSY_READ_ONLY_MODE must be true");
}
if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") {
  throw new Error("ETSY_WRITE_APPROVED must be false");
}
if (String(process.env.ETSY_SHOP_ID || SHOP_ID) !== SHOP_ID) {
  throw new Error("Unexpected Etsy shop ID");
}

const clientId = process.env.ETSY_CLIENT_ID;
const clientSecret = process.env.ETSY_CLIENT_SECRET;
const refreshToken = process.env.ETSY_REFRESH_TOKEN;
if (!clientId || !clientSecret || !refreshToken) {
  throw new Error("Missing Etsy OAuth configuration");
}

const prisma = new PrismaClient();
const rateLimits = [];
let accessToken = "";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function money(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || null;
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount);
  const divisor = Number(value.divisor);
  return Number.isFinite(amount) && Number.isFinite(divisor) && divisor ? amount / divisor : null;
}

function rateSnapshot(response, path) {
  const limit = Number(response.headers.get("x-limit-per-day"));
  const remaining = Number(response.headers.get("x-remaining-today"));
  return {
    path,
    status: response.status,
    limit_per_day: Number.isFinite(limit) ? limit : null,
    remaining_today: Number.isFinite(remaining) ? remaining : null,
  };
}

function assertReserve(snapshot) {
  if (snapshot.limit_per_day === null || snapshot.remaining_today === null) return;
  const reserve = Math.ceil(snapshot.limit_per_day * (RESERVE_PERCENT / 100));
  if (snapshot.remaining_today <= reserve) {
    throw new Error(`Quota reserve reached: ${snapshot.remaining_today}/${snapshot.limit_per_day}`);
  }
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);
  const body = JSON.parse(text);
  if (!body.access_token) throw new Error("Token refresh did not return an access token");
  accessToken = body.access_token;
  return {
    scope: body.scope || process.env.ETSY_TOKEN_SCOPE || null,
    expires_in: body.expires_in || null,
    refresh_token_rotated: Boolean(body.refresh_token && body.refresh_token !== refreshToken),
  };
}

async function etsyRequest(path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": `${clientId}:${clientSecret}`,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const rate = rateSnapshot(response, path);
  rateLimits.push(rate);
  const text = await response.text();
  if ([401, 403, 409, 429].includes(response.status)) {
    throw new Error(`Immediate-stop HTTP ${response.status} for ${path}: ${text}`);
  }
  if (!response.ok) throw new Error(`Etsy read failed ${response.status} for ${path}: ${text}`);
  assertReserve(rate);
  return text ? JSON.parse(text) : null;
}

function flattenScopes(value) {
  if (Array.isArray(value)) return value.flatMap(flattenScopes);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  if (value && typeof value === "object") {
    return flattenScopes(value.scopes ?? value.scope ?? value.results ?? value.permissions);
  }
  return [];
}

async function officialScopes() {
  const body = await etsyRequest("/scopes", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  });
  const scopes = [...new Set(flattenScopes(body))].sort();
  if (!scopes.includes("listings_r") || !scopes.includes("listings_w")) {
    throw new Error(`Required Etsy scopes missing: ${scopes.join(" ")}`);
  }
  return scopes;
}

function safeJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function localEvidence(listingId) {
  const listing = await prisma.listing.findUnique({
    where: { etsyListingId: listingId },
    include: { images: { orderBy: { position: "asc" } }, inventory: true },
  });
  const transactions = await prisma.etsyTransaction.findMany({
    where: { etsyListingId: listingId },
    select: { quantity: true, price: true, currency: true, createdTimestamp: true },
  });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const within90 = transactions.filter((row) => Number(row.createdTimestamp || 0) >= nowSeconds - 90 * 86400);
  const summarize = (rows) => ({
    orders: rows.length,
    units: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    revenue: rows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.quantity || 0), 0),
    currency: rows.find((row) => row.currency)?.currency || listing?.currency || null,
  });
  const raw = safeJson(listing?.rawJson, {});
  return {
    present: Boolean(listing),
    sku: raw.skus?.[0] || safeJson(listing?.inventory?.rawJson, {}).products?.[0]?.sku || null,
    cumulative_views: raw.views ?? null,
    cumulative_favorites: raw.num_favorers ?? null,
    last_synced_at: listing?.lastSyncedAt?.toISOString() || null,
    historical_all_time: summarize(transactions),
    historical_90d: summarize(within90),
    cached_images: (listing?.images || []).map((image) => ({
      listing_image_id: image.etsyImageId,
      rank: image.position,
      url: image.url,
      raw: safeJson(image.rawJson, null),
    })),
  };
}

async function main() {
  const capturedAt = new Date().toISOString();
  const token = await refreshAccessToken();
  const scopes = await officialScopes();
  const listings = [];

  for (const listingId of LISTING_IDS) {
    const details = await etsyRequest(
      `/listings/${listingId}?includes=Images,Videos,Personalization`,
      { method: "GET" },
    );
    const inventory = await etsyRequest(`/listings/${listingId}/inventory?max_variations_supported=3`, {
      method: "GET",
    });
    const local = await localEvidence(listingId);
    const images = Array.isArray(details.images) ? details.images : [];
    listings.push({
      listing_id: listingId,
      captured_at: new Date().toISOString(),
      title: details.title ?? null,
      state: details.state ?? null,
      views_cumulative: details.views ?? local.cumulative_views,
      favorites_cumulative: details.num_favorers ?? local.cumulative_favorites,
      price: money(details.price),
      buyer_price: money(details.buyer_price),
      currency: details.price?.currency_code ?? details.buyer_price?.currency_code ?? null,
      quantity: details.quantity ?? null,
      tags: Array.isArray(details.tags) ? details.tags : [],
      materials: Array.isArray(details.materials) ? details.materials : [],
      taxonomy_id: details.taxonomy_id ?? null,
      shipping_profile_id: details.shipping_profile_id ?? null,
      processing_profile_id: details.processing_profile_id ?? null,
      processing_min: details.processing_min ?? null,
      processing_max: details.processing_max ?? null,
      properties: details.properties ?? [],
      personalization: details.personalization ?? details.personalization_questions ?? null,
      description_sha256: sha256(String(details.description ?? "")),
      images: images
        .map((image, index) => ({
          listing_image_id: String(image.listing_image_id),
          rank: Number.isFinite(Number(image.rank)) ? Number(image.rank) : index + 1,
          url_fullxfull: image.url_fullxfull ?? null,
          full_width: image.full_width ?? null,
          full_height: image.full_height ?? null,
          alt_text: image.alt_text ?? null,
          created_timestamp: image.created_timestamp ?? image.creation_tsz ?? null,
        }))
        .sort((a, b) => a.rank - b.rank),
      videos: Array.isArray(details.videos) ? details.videos.map((video) => ({ video_id: video.video_id ?? null })) : [],
      inventory,
      local,
      raw_listing: details,
    });
  }

  const payload = {
    mission: "ETSY_GROWTH_V2_004",
    phase: "READ_ONLY_D0_AND_ASSET_DISCOVERY",
    captured_at: capturedAt,
    safety: {
      etsy_read_only_mode: true,
      etsy_write_approved: false,
      production_writes: 0,
      browser_automation: false,
      requested_listing_ids: LISTING_IDS,
      api_calls: rateLimits.length,
      reserve_percent: RESERVE_PERCENT,
      official_scopes: scopes,
      token_refresh: token,
    },
    rate_limits: rateLimits,
    listings,
  };
  payload.integrity_sha256 = sha256(JSON.stringify(payload));
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main()
  .catch((error) => {
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/[A-Za-z0-9_-]{80,}/g, "[REDACTED]");
    process.stdout.write(`${JSON.stringify({
      mission: "ETSY_GROWTH_V2_004",
      phase: "READ_ONLY_D0_AND_ASSET_DISCOVERY",
      status: "BLOCKED_READ_ERROR",
      error: message,
      safety: {
        etsy_read_only_mode: true,
        etsy_write_approved: false,
        production_writes: 0,
        browser_automation: false,
        api_calls: rateLimits.length,
      },
      rate_limits: rateLimits,
    }, null, 2)}\n`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
