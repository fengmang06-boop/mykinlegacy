const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const SHOP_ID = "25333110";
const TARGETS = ["4432511462", "878616671"];
const T2_CONTROL = "949279802";
const REQUEST_INTERVAL_MS = 1250;
const MAX_429_RETRIES = 2;
const RESERVE_PERCENT = 20;

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
if (!clientId || !clientSecret || !process.env.ETSY_REFRESH_TOKEN) {
  throw new Error("Missing Etsy OAuth configuration");
}

const prisma = new PrismaClient();
const requestLog = [];
const partial = { listings: [], local_synthetic_control_candidates: [] };
let accessToken = "";
let nextRequestAt = 0;
let latestRate = { limit_per_day: null, remaining_today: null, limit_per_second: null };
let tokenEvidence = null;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function money(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || null;
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount);
  const divisor = Number(value.divisor);
  return Number.isFinite(amount) && Number.isFinite(divisor) && divisor ? amount / divisor : null;
}

function headerNumber(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function rateSnapshot(response, apiPath, attempt) {
  const snapshot = {
    timestamp: new Date().toISOString(),
    path: apiPath,
    attempt,
    status: response.status,
    limit_per_second: headerNumber(response.headers, ["x-limit-per-second"]),
    remaining_this_second: headerNumber(response.headers, ["x-remaining-this-second", "x-remaining-this-secon"]),
    limit_per_day: headerNumber(response.headers, ["x-limit-per-day"]),
    remaining_today: headerNumber(response.headers, ["x-remaining-today"]),
    retry_after_seconds: headerNumber(response.headers, ["retry-after"]),
  };
  latestRate = {
    limit_per_day: snapshot.limit_per_day ?? latestRate.limit_per_day,
    remaining_today: snapshot.remaining_today ?? latestRate.remaining_today,
    limit_per_second: snapshot.limit_per_second ?? latestRate.limit_per_second,
  };
  requestLog.push(snapshot);
  return snapshot;
}

function assertReserve(requiredCalls = 1) {
  const limit = latestRate.limit_per_day;
  const remaining = latestRate.remaining_today;
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return;
  const reserve = Math.ceil(limit * RESERVE_PERCENT / 100);
  if (remaining - requiredCalls < reserve) {
    throw new Error(`Quota reserve reached: ${remaining}/${limit}`);
  }
}

async function waitForPacedSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  if (wait) await sleep(wait);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

function persistTokenValues(values) {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) throw new Error("Production .env.local not found for token persistence");
  const backupDir = path.join(
    "/root",
    "mensskull-etsy-backups",
    "growth-v2-mission005-token-refresh",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(envFile, path.join(backupDir, ".env.local"));
  const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
  const keys = new Set(Object.keys(updates));
  const kept = fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  }).filter((line) => line.trim());
  const formatted = Object.entries(updates).map(([key, value]) =>
    `${key}=${/[\s"#\\]/.test(value) ? JSON.stringify(value) : value}`,
  );
  const temp = `${envFile}.mission005-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);
  return backupDir;
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: process.env.ETSY_REFRESH_TOKEN,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);
  const body = JSON.parse(text);
  if (!body.access_token) throw new Error("Token refresh did not return an access token");
  accessToken = body.access_token;
  const expiresAt = new Date(Date.now() + Number(body.expires_in || 3600) * 1000).toISOString();
  const backupDir = persistTokenValues({
    ETSY_ACCESS_TOKEN: body.access_token,
    ETSY_REFRESH_TOKEN: body.refresh_token || process.env.ETSY_REFRESH_TOKEN,
    ETSY_TOKEN_EXPIRES_AT: expiresAt,
    ETSY_TOKEN_SCOPE: body.scope || process.env.ETSY_TOKEN_SCOPE,
  });
  tokenEvidence = {
    scope: body.scope || process.env.ETSY_TOKEN_SCOPE || null,
    expires_at: expiresAt,
    refresh_token_rotated: Boolean(body.refresh_token && body.refresh_token !== process.env.ETSY_REFRESH_TOKEN),
    persisted: true,
    backup_dir: backupDir,
  };
}

async function etsyRequest(apiPath, init = {}) {
  assertReserve();
  for (let attempt = 1; attempt <= MAX_429_RETRIES + 1; attempt += 1) {
    await waitForPacedSlot();
    const response = await fetch(`${API_BASE}${apiPath}`, {
      ...init,
      headers: {
        "x-api-key": `${clientId}:${clientSecret}`,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    const snapshot = rateSnapshot(response, apiPath, attempt);
    const text = await response.text();
    if (response.status === 429 && attempt <= MAX_429_RETRIES) {
      const retryAfterMs = Math.max(1500, Number(snapshot.retry_after_seconds || 0) * 1000);
      const backoffMs = Math.max(retryAfterMs, 1250 * (2 ** (attempt - 1)));
      await sleep(backoffMs);
      continue;
    }
    if (response.status === 429) throw new Error(`Persistent HTTP 429 for ${apiPath}: ${text}`);
    if ([401, 403, 409].includes(response.status)) {
      throw new Error(`Immediate-stop HTTP ${response.status} for ${apiPath}: ${text}`);
    }
    if (!response.ok) throw new Error(`Etsy read failed ${response.status} for ${apiPath}: ${text}`);
    assertReserve();
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`Unreachable request state for ${apiPath}`);
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
    cached_updated_timestamp: raw.updated_timestamp ?? null,
    cached_views: raw.views ?? null,
    cached_favorites: raw.num_favorers ?? null,
    last_synced_at: listing?.lastSyncedAt?.toISOString() || null,
    all_time: summarize(transactions),
    last_90d: summarize(transactions.filter((row) => Number(row.createdTimestamp || 0) >= nowSeconds - 90 * 86400)),
  };
}

async function readFullListing(listingId, includeInventory) {
  const listing = await etsyRequest(`/listings/${listingId}?includes=Videos,Personalization,BuyerPrice`, { method: "GET" });
  const imageResponse = await etsyRequest(`/listings/${listingId}/images`, { method: "GET" });
  const inventory = includeInventory
    ? await etsyRequest(`/listings/${listingId}/inventory?max_variations_supported=3`, { method: "GET" })
    : null;
  const local = await localEvidence(listingId);
  const images = Array.isArray(imageResponse?.results) ? imageResponse.results : [];
  return {
    listing_id: listingId,
    captured_at: new Date().toISOString(),
    state: listing.state ?? null,
    title: listing.title ?? null,
    tags: Array.isArray(listing.tags) ? listing.tags : [],
    description_sha256: sha256(String(listing.description ?? "")),
    price: money(listing.price),
    buyer_price: money(listing.buyer_price),
    sale_price: money(listing.buyer_price) !== null && money(listing.buyer_price) < money(listing.price)
      ? money(listing.buyer_price)
      : null,
    currency: listing.price?.currency_code ?? listing.buyer_price?.currency_code ?? null,
    quantity: listing.quantity ?? null,
    shipping_profile_id: listing.shipping_profile_id ?? null,
    processing_profile_id: listing.processing_profile_id ?? null,
    readiness_state_id: listing.readiness_state_id ?? null,
    processing_min: listing.processing_min ?? null,
    processing_max: listing.processing_max ?? null,
    taxonomy_id: listing.taxonomy_id ?? null,
    views: listing.views ?? local.cached_views,
    favorites: listing.num_favorers ?? local.cached_favorites,
    updated_timestamp: listing.updated_timestamp ?? local.cached_updated_timestamp,
    materials: Array.isArray(listing.materials) ? listing.materials : [],
    properties: Array.isArray(listing.properties) ? listing.properties : [],
    personalization: listing.personalization ?? listing.personalization_questions ?? null,
    images: images.map((image, index) => ({
      listing_image_id: String(image.listing_image_id),
      rank: Number.isFinite(Number(image.rank)) ? Number(image.rank) : index + 1,
      url_fullxfull: image.url_fullxfull ?? null,
      full_width: image.full_width ?? null,
      full_height: image.full_height ?? null,
      alt_text: image.alt_text ?? null,
      created_timestamp: image.created_timestamp ?? image.creation_tsz ?? null,
    })).sort((a, b) => a.rank - b.rank),
    inventory,
    local,
    raw_listing: listing,
    raw_images: imageResponse,
  };
}

async function syntheticControlCandidates() {
  const rows = await prisma.listing.findMany({
    include: { images: { orderBy: { position: "asc" } }, inventory: true },
  });
  const transactionGroups = await prisma.etsyTransaction.groupBy({
    by: ["etsyListingId"],
    _count: { _all: true },
    _sum: { quantity: true, price: true },
  });
  const tx = new Map(transactionGroups.map((row) => [String(row.etsyListingId), row]));
  return rows
    .filter((row) => /(wallet|pants|chain|keychain|bracelet)/i.test(row.title || ""))
    .filter((row) => ![...TARGETS, T2_CONTROL, "4516749377"].includes(String(row.etsyListingId)))
    .map((row) => {
      const raw = safeJson(row.rawJson, {});
      const group = tx.get(String(row.etsyListingId));
      return {
        listing_id: String(row.etsyListingId),
        title: row.title,
        state: row.state,
        price: row.price,
        currency: row.currency,
        views: raw.views ?? null,
        favorites: raw.num_favorers ?? null,
        updated_timestamp: raw.updated_timestamp ?? null,
        taxonomy_id: row.taxonomyId,
        image_count: row.images.length,
        order_count_local_all_time: group?._count?._all ?? 0,
        units_local_all_time: group?._sum?.quantity ?? 0,
        last_synced_at: row.lastSyncedAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
}

async function main() {
  const capturedAt = new Date().toISOString();
  await refreshAccessToken();
  const scopes = await officialScopes();
  for (const listingId of TARGETS) partial.listings.push(await readFullListing(listingId, true));
  partial.listings.push(await readFullListing(T2_CONTROL, false));
  partial.local_synthetic_control_candidates = await syntheticControlCandidates();
  const recovered429 = requestLog.filter((row) => row.status === 429).filter((row) =>
    requestLog.some((later) => later.path === row.path && later.attempt > row.attempt && later.status >= 200 && later.status < 300),
  ).length;
  const payload = {
    mission: "ETSY_GROWTH_V2_005",
    phase: "PACED_READ_ONLY_D0_AND_ASSET_DISCOVERY",
    status: requestLog.some((row) => row.status === 429) ? "API_RATE_LIMIT_RECOVERED" : "API_HEALTHY",
    captured_at: capturedAt,
    safety: {
      etsy_read_only_mode: true,
      etsy_write_approved: false,
      production_writes: 0,
      browser_automation: false,
      shop_id: SHOP_ID,
      requested_listing_ids: [...TARGETS, T2_CONTROL],
      api_calls: requestLog.length,
      reserve_percent: RESERVE_PERCENT,
      official_scopes: scopes,
      token_refresh: tokenEvidence,
      qps_pacing_ms: REQUEST_INTERVAL_MS,
      max_429_retries: MAX_429_RETRIES,
      api_429_count: requestLog.filter((row) => row.status === 429).length,
      api_429_recovered_count: recovered429,
    },
    rate_limits: requestLog,
    latest_rate_limit: latestRate,
    listings: partial.listings,
    local_synthetic_control_candidates: partial.local_synthetic_control_candidates,
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
      mission: "ETSY_GROWTH_V2_005",
      phase: "PACED_READ_ONLY_D0_AND_ASSET_DISCOVERY",
      status: /429/.test(message) ? "API_RATE_LIMIT_PERSISTENT" : "BLOCKED_READ_ERROR",
      error: message,
      safety: {
        etsy_read_only_mode: true,
        etsy_write_approved: false,
        production_writes: 0,
        browser_automation: false,
        api_calls: requestLog.length,
        api_429_count: requestLog.filter((row) => row.status === 429).length,
      },
      rate_limits: requestLog,
      latest_rate_limit: latestRate,
      partial,
    }, null, 2)}\n`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

