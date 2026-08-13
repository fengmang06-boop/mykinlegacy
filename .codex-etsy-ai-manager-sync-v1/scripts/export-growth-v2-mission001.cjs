const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function surrogate(prefix, value) {
  if (!value) return null;
  return `${prefix}_${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 20)}`;
}

loadEnv();

if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") {
  throw new Error("ETSY_READ_ONLY_MODE must be true");
}
if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") {
  throw new Error("ETSY_WRITE_APPROVED must be false");
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const [
    shops,
    listings,
    receipts,
    transactions,
    plans,
    baselines,
    trackings,
    syncState,
    syncLogs,
  ] = await Promise.all([
    prisma.shop.findMany({ select: { id: true, etsyShopId: true, name: true, currency: true, updatedAt: true } }),
    prisma.listing.findMany({
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        inventory: true,
      },
    }),
    prisma.etsyReceipt.findMany(),
    prisma.etsyTransaction.findMany(),
    prisma.etsyGrowthPlan.findMany(),
    prisma.etsyGrowthBaseline.findMany(),
    prisma.etsyGrowthDailyTracking.findMany(),
    prisma.etsySyncState.findMany(),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const safeListings = listings.map((listing) => {
    const raw = parseJson(listing.rawJson, {});
    const inventoryRaw = parseJson(listing.inventory?.rawJson, {});
    const tags = parseJson(listing.tags, []);
    const materials = parseJson(listing.materials, []);
    const sku = firstDefined(
      raw.sku,
      raw.skus?.[0],
      inventoryRaw.products?.[0]?.sku,
      inventoryRaw.products?.[0]?.offerings?.[0]?.sku,
    );
    return {
      listing_id: listing.etsyListingId,
      internal_listing_id: listing.id,
      shop_id: listing.shopId,
      sku,
      title: listing.title,
      state: listing.state,
      created_at: listing.createdAt,
      updated_at: listing.updatedAt,
      last_synced_at: listing.lastSyncedAt,
      etsy_created_timestamp: firstDefined(raw.creation_timestamp, raw.created_timestamp),
      etsy_updated_timestamp: firstDefined(raw.last_modified_timestamp, raw.updated_timestamp),
      cumulative_views: numberValue(firstDefined(raw.views, raw.views_count)),
      cumulative_favorites: numberValue(firstDefined(raw.num_favorers, raw.favorers)),
      price: listing.price,
      currency: listing.currency,
      quantity: listing.inventory?.quantity ?? listing.quantity,
      taxonomy_id: firstDefined(raw.taxonomy_id, raw.taxonomyId),
      shipping_profile_id: firstDefined(raw.shipping_profile_id, raw.shippingProfileId),
      product_type: listing.productType || null,
      target_customer: listing.targetCustomer || null,
      materials: Array.isArray(materials) ? materials : [],
      tags: Array.isArray(tags) ? tags : [],
      description_length: listing.description?.length ?? 0,
      description_present: Boolean(listing.description),
      first_image: listing.images[0]
        ? {
            image_id: listing.images[0].etsyImageId,
            position: listing.images[0].position,
            role: listing.images[0].role,
            alt_present: Boolean(listing.images[0].alt),
          }
        : null,
    };
  });

  const safeReceipts = receipts.map((receipt) => ({
    order_id: surrogate("ord", receipt.etsyReceiptId),
    status: receipt.status,
    total_price: receipt.totalPrice,
    currency: receipt.currency,
    created_timestamp: receipt.createdTimestamp,
    updated_timestamp: receipt.updatedTimestamp,
    synced_at: receipt.syncedAt,
  }));

  const safeTransactions = transactions.map((transaction) => ({
    transaction_id: surrogate("txn", transaction.etsyTransactionId),
    order_id: surrogate("ord", transaction.etsyReceiptId),
    listing_id: transaction.etsyListingId,
    title: transaction.title,
    quantity: transaction.quantity,
    price: transaction.price,
    currency: transaction.currency,
    created_timestamp: transaction.createdTimestamp,
    synced_at: transaction.syncedAt,
  }));

  const output = {
    mission: "ETSY_GROWTH_V2_001",
    exported_at: new Date().toISOString(),
    source: "production SQLite via Prisma read-only select operations",
    safety: {
      etsy_read_only_mode: true,
      etsy_write_approved: false,
      etsy_api_calls: 0,
      production_writes: 0,
      customer_pii_exported: false,
    },
    counts: {
      shops: shops.length,
      listings: safeListings.length,
      receipts: safeReceipts.length,
      transactions: safeTransactions.length,
      growth_plans: plans.length,
      growth_baselines: baselines.length,
      growth_trackings: trackings.length,
    },
    shops,
    listings: safeListings,
    receipts: safeReceipts,
    transactions: safeTransactions,
    growth_plans: plans.map((plan) => ({
      id: plan.id,
      listing_id: plan.listingId,
      batch_key: plan.batchKey,
      product_name: plan.productName,
      status: plan.status,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    })),
    growth_baselines: baselines.map((baseline) => ({
      id: baseline.id,
      plan_id: baseline.planId,
      listing_id: baseline.listingId,
      baseline_date: baseline.baselineDate,
      views: baseline.views,
      favorites: baseline.favorites,
      orders: baseline.orders,
      revenue: baseline.revenue,
      created_at: baseline.createdAt,
    })),
    growth_trackings: trackings.map((tracking) => ({
      id: tracking.id,
      plan_id: tracking.planId,
      listing_id: tracking.listingId,
      tracking_date: tracking.trackingDate,
      views: tracking.views,
      favorites: tracking.favorites,
      orders: tracking.orders,
      revenue: tracking.revenue,
      source: tracking.source,
      created_at: tracking.createdAt,
      updated_at: tracking.updatedAt,
    })),
    sync_state: syncState,
    recent_sync_logs: syncLogs.map((log) => ({
      source: log.source,
      mode: log.mode,
      status: log.status,
      item_count: log.itemCount,
      receipts_pulled: log.receiptsPulled,
      transactions_pulled: log.transactionsPulled,
      started_at: log.startedAt,
      finished_at: log.finishedAt,
      created_at: log.createdAt,
    })),
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().finally(() => prisma.$disconnect());
