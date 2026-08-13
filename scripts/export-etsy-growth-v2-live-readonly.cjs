const crypto = require("crypto");
const fs = require("fs");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RESOURCE = 10;
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

const clientId = process.env.ETSY_CLIENT_ID;
const clientSecret = process.env.ETSY_CLIENT_SECRET;
const refreshToken = process.env.ETSY_REFRESH_TOKEN;
const shopId = process.env.ETSY_SHOP_ID;
if (!clientId || !clientSecret || !refreshToken || !shopId) {
  throw new Error("Missing Etsy OAuth or shop configuration");
}

function surrogate(prefix, value) {
  if (!value) return null;
  return `${prefix}_${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 20)}`;
}

function money(value) {
  if (typeof value === "number") return { amount: value, currency: null };
  if (typeof value === "string") return { amount: Number(value) || null, currency: null };
  if (!value || typeof value !== "object") return { amount: null, currency: null };
  const amount = Number(value.amount);
  const divisor = Number(value.divisor);
  return {
    amount: Number.isFinite(amount) && Number.isFinite(divisor) && divisor ? amount / divisor : null,
    currency: value.currency_code || null,
  };
}

async function getAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);
  const body = await response.json();
  return { accessToken: body.access_token, scope: body.scope || process.env.ETSY_TOKEN_SCOPE || null };
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

async function fetchPages(resource, accessToken, rateLimits) {
  const rows = [];
  let reportedCount = null;
  for (let page = 0; page < MAX_PAGES_PER_RESOURCE; page += 1) {
    const offset = page * PAGE_SIZE;
    const path = `/shops/${shopId}/${resource}?limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        "x-api-key": `${clientId}:${clientSecret}`,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const rate = rateSnapshot(response, path);
    rateLimits.push(rate);
    if (!response.ok) throw new Error(`${resource} read failed: ${response.status} ${await response.text()}`);
    assertReserve(rate);
    const body = await response.json();
    const pageRows = Array.isArray(body.results) ? body.results : [];
    rows.push(...pageRows);
    if (typeof body.count === "number") reportedCount = body.count;
    if (!pageRows.length || pageRows.length < PAGE_SIZE || (reportedCount !== null && rows.length >= reportedCount)) break;
  }
  return { rows, reportedCount };
}

async function main() {
  const startedAt = new Date().toISOString();
  const { accessToken, scope } = await getAccessToken();
  const scopes = String(scope || "").split(/\s+/).filter(Boolean);
  if (!scopes.includes("transactions_r")) throw new Error("transactions_r is required");

  const rateLimits = [];
  const receiptsResult = await fetchPages("receipts", accessToken, rateLimits);
  const transactionsResult = await fetchPages("transactions", accessToken, rateLimits);

  const receipts = receiptsResult.rows.map((row) => {
    const total = money(row.grandtotal ?? row.total_price);
    return {
      order_id: surrogate("ord", row.receipt_id),
      status: row.status ?? null,
      is_paid: row.is_paid ?? null,
      is_canceled: row.is_canceled ?? null,
      total_price: total.amount,
      currency: total.currency,
      created_timestamp: row.created_timestamp ?? null,
      updated_timestamp: row.updated_timestamp ?? null,
    };
  });

  const transactions = transactionsResult.rows.map((row) => {
    const price = money(row.price);
    const productData = row.product_data && typeof row.product_data === "object" ? row.product_data : {};
    return {
      transaction_id: surrogate("txn", row.transaction_id),
      order_id: surrogate("ord", row.receipt_id),
      listing_id: row.listing_id ? String(row.listing_id) : null,
      sku: productData.sku ?? row.sku ?? null,
      title: row.title ?? null,
      quantity: Number(row.quantity) || 0,
      price: price.amount,
      currency: price.currency,
      created_timestamp: row.created_timestamp ?? null,
    };
  });

  process.stdout.write(`${JSON.stringify({
    mission: "ETSY_GROWTH_V2_001",
    exported_at: new Date().toISOString(),
    started_at: startedAt,
    source: "Etsy Open API official receipts and transactions endpoints",
    safety: {
      etsy_read_only_mode: true,
      etsy_write_approved: false,
      production_writes: 0,
      etsy_api_calls: rateLimits.length,
      customer_pii_exported: false,
      scopes_verified: scopes,
      quota_reserve_percent: RESERVE_PERCENT,
    },
    coverage: {
      receipts_reported: receiptsResult.reportedCount,
      receipts_exported: receipts.length,
      transactions_reported: transactionsResult.reportedCount,
      transactions_exported: transactions.length,
    },
    rate_limits: rateLimits,
    receipts,
    transactions,
  }, null, 2)}\n`);
}

main();
