const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const START_DATE = "2026-01-11";
const END_DATE = "2026-07-12";
const UNKNOWN = "UNKNOWN";
const API_BASE = "https://openapi.etsy.com/v3/application";

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function csvValue(value) {
  if (value === null || typeof value === "undefined" || value === "") value = UNKNOWN;
  let text = String(value);
  if (/^[=+@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(file, columns, rows) {
  const lines = [columns.map(csvValue).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvValue(row[column])).join(","));
  fs.writeFileSync(file, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function moneyValue(value) {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  if (!value || typeof value !== "object") return 0;
  return numberValue(value.amount) / (numberValue(value.divisor) || 100);
}

function transactionTimestamp(row) {
  return numberValue(row.created_timestamp ?? row.create_timestamp ?? row.paid_timestamp);
}

function inventorySkus(inventory) {
  const raw = parseJson(inventory?.rawJson, {});
  const products = Array.isArray(raw.products) ? raw.products : [];
  return [...new Set(products.map((product) => String(product?.sku ?? "").trim()).filter(Boolean))];
}

async function main() {
  loadEnv();
  if (String(process.env.ETSY_READ_ONLY_MODE ?? "true").toLowerCase() !== "true") {
    throw new Error("MDIS export refused: ETSY_READ_ONLY_MODE must be true.");
  }
  if (String(process.env.ETSY_WRITE_APPROVED ?? "false").toLowerCase() !== "false") {
    throw new Error("MDIS export refused: ETSY_WRITE_APPROVED must be false.");
  }

  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = process.env.ETSY_CLIENT_SECRET ?? "";
  let accessToken = process.env.ETSY_ACCESS_TOKEN ?? "";
  const refreshToken = process.env.ETSY_REFRESH_TOKEN ?? "";
  const shopId = process.env.ETSY_SHOP_ID ?? "25333110";
  if (!clientId || !clientSecret || !accessToken) throw new Error("Missing Etsy production credentials.");

  const rateSnapshots = [];
  let tokenRefreshedInMemory = false;
  async function refreshTokenInMemory() {
    if (!refreshToken) throw new Error("Access token expired and no refresh token is available.");
    const response = await fetch("https://openapi.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken })
    });
    if (!response.ok) throw new Error(`Etsy token refresh failed: ${response.status} ${await response.text()}`);
    const token = await response.json();
    accessToken = token.access_token;
    tokenRefreshedInMemory = true;
  }

  async function apiGet(apiPath, retryAuth = true) {
    const response = await fetch(`${API_BASE}${apiPath}`, {
      headers: {
        "x-api-key": `${clientId}:${clientSecret}`,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
    rateSnapshots.push({
      endpoint: apiPath,
      status: response.status,
      limitPerSecond: response.headers.get("x-limit-per-second") ?? UNKNOWN,
      remainingThisSecond: response.headers.get("x-remaining-this-second") ?? UNKNOWN,
      limitPerDay: response.headers.get("x-limit-per-day") ?? UNKNOWN,
      remainingToday: response.headers.get("x-remaining-today") ?? UNKNOWN
    });
    if (response.status === 401 && retryAuth) {
      await refreshTokenInMemory();
      return apiGet(apiPath, false);
    }
    const text = await response.text();
    if (response.status === 429) throw new Error(`Etsy rate limit encountered at ${apiPath}: ${text}`);
    if (!response.ok) throw new Error(`Etsy GET failed at ${apiPath}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : {};
  }

  async function fetchAll(apiPath) {
    const results = [];
    let count = null;
    for (let offset = 0; offset <= 12000; offset += 100) {
      const separator = apiPath.includes("?") ? "&" : "?";
      const page = await apiGet(`${apiPath}${separator}limit=100&offset=${offset}`);
      const rows = Array.isArray(page.results) ? page.results : [];
      results.push(...rows);
      if (typeof page.count === "number") count = page.count;
      if (!rows.length || rows.length < 100 || (count !== null && results.length >= count)) break;
    }
    return results;
  }

  const prisma = new PrismaClient();
  const exportedAt = new Date().toISOString();
  const startEpoch = Math.floor(new Date(`${START_DATE}T00:00:00.000Z`).getTime() / 1000);
  const endEpoch = Math.floor(new Date(`${END_DATE}T23:59:59.999Z`).getTime() / 1000);
  try {
    const [apiListings, apiTransactions, dbShop, dbListings, lastSync] = await Promise.all([
      fetchAll(`/shops/${shopId}/listings/active`),
      fetchAll(`/shops/${shopId}/transactions`),
      prisma.shop.findFirst({ where: { etsyShopId: String(shopId) } }),
      prisma.listing.findMany({ include: { inventory: true }, orderBy: { etsyListingId: "asc" } }),
      prisma.syncLog.findFirst({ orderBy: { createdAt: "desc" } })
    ]);

    const dbByEtsyId = new Map(dbListings.map((listing) => [listing.etsyListingId, listing]));
    const apiByEtsyId = new Map(apiListings.map((listing) => [String(listing.listing_id), listing]));
    const listingIds = [...new Set([...dbByEtsyId.keys(), ...apiByEtsyId.keys()])].sort((a, b) => Number(a) - Number(b));
    const transactions = apiTransactions.filter((row) => {
      const timestamp = transactionTimestamp(row);
      return timestamp >= startEpoch && timestamp <= endEpoch;
    });
    const transactionsByListing = new Map();
    for (const row of transactions) {
      const listingId = String(row.listing_id ?? "");
      if (!transactionsByListing.has(listingId)) transactionsByListing.set(listingId, []);
      transactionsByListing.get(listingId).push(row);
    }

    const skuToListings = new Map();
    const skuByListing = new Map();
    for (const listingId of listingIds) {
      const dbListing = dbByEtsyId.get(listingId);
      const skus = inventorySkus(dbListing?.inventory);
      skuByListing.set(listingId, skus);
      for (const sku of skus) {
        if (!skuToListings.has(sku)) skuToListings.set(sku, new Set());
        skuToListings.get(sku).add(listingId);
      }
    }

    const discoveryRows = listingIds.map((listingId) => {
      const apiListing = apiByEtsyId.get(listingId) ?? {};
      const dbListing = dbByEtsyId.get(listingId);
      const raw = parseJson(dbListing?.rawJson, {});
      const listingTransactions = transactionsByListing.get(listingId) ?? [];
      const revenue = listingTransactions.reduce((sum, row) => sum + moneyValue(row.price ?? row.transaction_price) * Math.max(1, numberValue(row.quantity)), 0);
      return {
        etsy_listing_id: listingId,
        shop_id: String(apiListing.shop_id ?? dbShop?.etsyShopId ?? shopId),
        mensskull_internal_product_id: dbListing?.id ?? UNKNOWN,
        sku: (skuByListing.get(listingId) ?? []).join("|") || UNKNOWN,
        listing_title: apiListing.title ?? dbListing?.title ?? UNKNOWN,
        listing_status: apiListing.state ?? dbListing?.state ?? UNKNOWN,
        reporting_date: END_DATE,
        reporting_period: `${START_DATE}_to_${END_DATE}`,
        views: UNKNOWN,
        lifetime_views_snapshot: raw.views ?? UNKNOWN,
        visits: UNKNOWN,
        impressions: UNKNOWN,
        clicks: UNKNOWN,
        favorites: apiListing.num_favorers ?? raw.num_favorers ?? UNKNOWN,
        add_to_cart_events: UNKNOWN,
        orders: listingTransactions.length,
        revenue: Number(revenue.toFixed(2)),
        currency: listingTransactions.find((row) => row.price?.currency_code)?.price?.currency_code ?? dbListing?.currency ?? dbShop?.currency ?? UNKNOWN,
        etsy_search_traffic: UNKNOWN,
        etsy_app_traffic: UNKNOWN,
        etsy_pages_traffic: UNKNOWN,
        direct_traffic: UNKNOWN,
        external_traffic: UNKNOWN,
        social_traffic: UNKNOWN,
        ads_traffic: UNKNOWN,
        snapshot_timestamp: exportedAt,
        listing_api_last_synced_at: dbListing?.lastSyncedAt?.toISOString() ?? UNKNOWN
      };
    });

    const engagementRows = listingIds.map((listingId) => {
      const apiListing = apiByEtsyId.get(listingId) ?? {};
      const dbListing = dbByEtsyId.get(listingId);
      const raw = parseJson(dbListing?.rawJson, {});
      return {
        etsy_listing_id: listingId,
        shop_id: String(apiListing.shop_id ?? dbShop?.etsyShopId ?? shopId),
        mensskull_internal_product_id: dbListing?.id ?? UNKNOWN,
        sku: (skuByListing.get(listingId) ?? []).join("|") || UNKNOWN,
        favorites: apiListing.num_favorers ?? raw.num_favorers ?? UNKNOWN,
        favorite_date: UNKNOWN,
        cart_additions: UNKNOWN,
        snapshot_timestamp: exportedAt
      };
    });

    const orderRows = transactions.map((row) => {
      const listingId = String(row.listing_id ?? UNKNOWN);
      const dbListing = dbByEtsyId.get(listingId);
      const timestamp = transactionTimestamp(row);
      const rowSku = row.sku ?? row.product_data?.sku;
      return {
        order_id_or_surrogate_id: String(row.receipt_id ?? row.transaction_id ?? UNKNOWN),
        transaction_id: String(row.transaction_id ?? UNKNOWN),
        etsy_listing_id: listingId,
        mensskull_internal_product_id: dbListing?.id ?? UNKNOWN,
        sku: rowSku || (skuByListing.get(listingId) ?? []).join("|") || UNKNOWN,
        sale_date: timestamp ? new Date(timestamp * 1000).toISOString() : UNKNOWN,
        quantity: row.quantity ?? UNKNOWN,
        item_price: moneyValue(row.price ?? row.transaction_price),
        currency: row.price?.currency_code ?? row.transaction_price?.currency_code ?? dbListing?.currency ?? UNKNOWN
      };
    });

    const mappingRows = listingIds.map((listingId) => {
      const dbListing = dbByEtsyId.get(listingId);
      const skus = skuByListing.get(listingId) ?? [];
      const duplicateSkus = skus.filter((sku) => (skuToListings.get(sku)?.size ?? 0) > 1);
      return {
        etsy_listing_id: listingId,
        mensskull_internal_product_id: dbListing?.id ?? UNKNOWN,
        sku: skus.join("|") || UNKNOWN,
        mapping_status: !dbListing ? "UNMATCHED_LISTING_ID" : !skus.length ? "MISSING_SKU" : duplicateSkus.length ? "DUPLICATE_SKU_CONFLICT" : "MATCHED",
        duplicate_sku_conflicts: duplicateSkus.join("|") || UNKNOWN
      };
    });
    for (const row of orderRows.filter((row) => row.etsy_listing_id !== UNKNOWN && !apiByEtsyId.has(row.etsy_listing_id) && !dbByEtsyId.has(row.etsy_listing_id))) {
      mappingRows.push({ etsy_listing_id: row.etsy_listing_id, mensskull_internal_product_id: UNKNOWN, sku: row.sku, mapping_status: "UNMATCHED_TRANSACTION_LISTING_ID", duplicate_sku_conflicts: UNKNOWN });
    }

    const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("exports", "mdis", `${START_DATE}_to_${END_DATE}`);
    fs.mkdirSync(outputDir, { recursive: true });
    writeCsv(path.join(outputDir, `etsy_listing_discovery_${START_DATE}_to_${END_DATE}.csv`), Object.keys(discoveryRows[0]), discoveryRows);
    writeCsv(path.join(outputDir, `etsy_search_discovery_${START_DATE}_to_${END_DATE}.csv`), ["search_query", "date", "etsy_listing_id", "impressions", "visits", "orders", "revenue"], []);
    writeCsv(path.join(outputDir, `etsy_listing_engagement_${START_DATE}_to_${END_DATE}.csv`), Object.keys(engagementRows[0]), engagementRows);
    writeCsv(path.join(outputDir, `etsy_order_mapping_${START_DATE}_to_${END_DATE}.csv`), Object.keys(orderRows[0] ?? {
      order_id_or_surrogate_id: "", transaction_id: "", etsy_listing_id: "", mensskull_internal_product_id: "", sku: "", sale_date: "", quantity: "", item_price: "", currency: ""
    }), orderRows);
    writeCsv(path.join(outputDir, "identifier_mapping_report.csv"), Object.keys(mappingRows[0]), mappingRows);

    const missingRows = [
      { dataset: "listing_discovery", fields: "views|visits|impressions|clicks", reason: "Etsy Open API v3 has no date-bounded discovery analytics endpoint; lifetime views snapshot is exported separately when present.", affected_records: discoveryRows.length },
      { dataset: "listing_discovery", fields: "traffic_sources", reason: "Etsy Open API v3 does not expose shop traffic-source analytics.", affected_records: discoveryRows.length },
      { dataset: "search_discovery", fields: "all", reason: "Etsy Open API v3 does not expose seller search-query performance linked to listings.", affected_records: 0 },
      { dataset: "listing_engagement", fields: "favorite_date|cart_additions", reason: "Listing resources expose aggregate favorer count but not favorite event dates or cart-addition events.", affected_records: engagementRows.length },
      { dataset: "identifier_mapping", fields: "sku", reason: "SKU is UNKNOWN where Etsy inventory products contain no SKU.", affected_records: mappingRows.filter((row) => row.mapping_status === "MISSING_SKU").length }
    ];
    writeCsv(path.join(outputDir, "missing_data_report.csv"), Object.keys(missingRows[0]), missingRows);

    const dictionaryRows = [];
    const addDictionary = (dataset, columns) => columns.forEach(([field, definition, source]) => dictionaryRows.push({ dataset, field, definition, source }));
    addDictionary("listing_discovery", [
      ["etsy_listing_id", "Etsy numeric listing identifier", "Etsy listings API"], ["mensskull_internal_product_id", "Local MENSSKULL Listing.id", "Production SQLite"],
      ["sku", "Pipe-delimited Etsy inventory SKU values", "Etsy inventory sync"], ["views", "Date-bounded listing views; UNKNOWN because API does not expose it", "Unavailable"],
      ["lifetime_views_snapshot", "Cumulative listing views from latest stored Etsy listing detail snapshot", "Etsy listing detail sync"], ["favorites", "Cumulative current num_favorers snapshot", "Etsy listings API"],
      ["orders", "Transaction row count inside requested UTC range", "Etsy transactions API"], ["revenue", "Quantity multiplied by item price inside requested UTC range", "Etsy transactions API"]
    ]);
    addDictionary("listing_engagement", [["favorites", "Cumulative current favorite count", "Etsy listings API"], ["favorite_date", "Favorite event date; UNKNOWN", "Unavailable"], ["cart_additions", "Cart-addition events; UNKNOWN", "Unavailable"]]);
    addDictionary("order_mapping", [["order_id_or_surrogate_id", "Receipt ID, falling back to transaction ID", "Etsy transactions API"], ["sale_date", "Transaction created timestamp in UTC", "Etsy transactions API"], ["item_price", "Per-item transaction price", "Etsy transactions API"]]);
    writeCsv(path.join(outputDir, "field_dictionary.csv"), Object.keys(dictionaryRows[0]), dictionaryRows);

    const rateLimitEncountered = rateSnapshots.some((row) => row.status === 429);
    const finalRate = rateSnapshots.at(-1) ?? {};
    const summary = `# Etsy MDIS API Extraction Summary\n\n` +
      `- Export timestamp: ${exportedAt}\n- Requested coverage: ${START_DATE} through ${END_DATE} inclusive (UTC)\n` +
      `- Shop ID: ${shopId}\n- Mode: read-only\n- Write approval: false\n- Token refreshed in process memory: ${tokenRefreshedInMemory}\n` +
      `- Endpoints used: GET /shops/{shop_id}/listings/active; GET /shops/{shop_id}/transactions\n` +
      `- Production API-sync sources used for enrichment: GET /listings/{listing_id}; GET /listings/{listing_id}/inventory\n` +
      `- Listing discovery records: ${discoveryRows.length}\n- Search discovery records: 0\n- Engagement records: ${engagementRows.length}\n- Order mapping records: ${orderRows.length}\n` +
      `- Identifier mappings: ${mappingRows.length}\n- Missing SKU mappings: ${mappingRows.filter((row) => row.mapping_status === "MISSING_SKU").length}\n` +
      `- Duplicate SKU conflicts: ${mappingRows.filter((row) => row.mapping_status === "DUPLICATE_SKU_CONFLICT").length}\n` +
      `- Unmatched identifiers: ${mappingRows.filter((row) => row.mapping_status.startsWith("UNMATCHED")).length}\n` +
      `- Rate limits encountered: ${rateLimitEncountered ? "YES" : "NO"}\n- Last observed daily remaining: ${finalRate.remainingToday ?? UNKNOWN}\n` +
      `- Last production sync: ${lastSync?.finishedAt?.toISOString() ?? UNKNOWN} (${lastSync?.status ?? UNKNOWN})\n\n` +
      `## API limitations\n\nEtsy Open API v3 does not provide seller analytics endpoints for date-bounded views, visits, impressions, clicks, search queries, traffic-source attribution, favorite event dates, or cart additions. These fields are marked UNKNOWN. Lifetime views are provided only as separately labeled snapshots and must not be interpreted as the requested reporting-period views.\n\n` +
      `## Privacy\n\nNo buyer names, emails, addresses, phone numbers, personal messages, or other unnecessary personal data are included.\n`;
    fs.writeFileSync(path.join(outputDir, "api_extraction_summary.md"), summary, "utf8");
    fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({ exportedAt, startDate: START_DATE, endDate: END_DATE, shopId, recordCounts: { listingDiscovery: discoveryRows.length, searchDiscovery: 0, engagement: engagementRows.length, orderMapping: orderRows.length, identifierMapping: mappingRows.length }, rateSnapshots }, null, 2));
    process.stdout.write(`${outputDir}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
