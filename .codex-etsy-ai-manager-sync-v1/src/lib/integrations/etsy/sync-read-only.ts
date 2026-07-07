import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../prisma";
import { toJson } from "../../json";
import { scoreListing } from "../../engines/listing-score-engine";
import { analyzeKeywords } from "../../engines/keyword-intelligence-engine";
import { generateRecommendations } from "../../engines/recommendation-engine";
import { scoreBestsellerPotential } from "../../engines/bestseller-potential-engine";
import { createNext30DaysPromotionPlan } from "../../engines/promotion-planner";
import type { EngineListing } from "../../engines/types";
import {
  fetchConnectedShop,
  fetchListingDetails,
  fetchListingImages,
  fetchListingInventory,
  fetchReceipts,
  fetchShop,
  fetchShopListings,
  fetchTransactions,
  refreshEtsyTokenIfNeeded,
  validateEtsyClientEnv,
  type EtsyListingSummary
} from "./client";

type SyncResult = {
  ok: boolean;
  message: string;
  listingsPulled: number;
  imagesPulled: number;
  inventoryPulled: number;
  receiptsPulled: number;
  transactionsPulled: number;
  errors: string[];
};

function parsePrice(price: EtsyListingSummary["price"]): number {
  if (typeof price === "number") return price;
  if (typeof price === "string") return Number(price) || 0;
  if (price?.amount && price?.divisor) return price.amount / price.divisor;
  return 0;
}

function parseCurrency(price: EtsyListingSummary["price"]): string | null {
  if (typeof price === "object" && price?.currency_code) return price.currency_code;
  return null;
}

function formatEnvValue(value: string): string {
  if (value === "" || /[\s"#\\]/.test(value)) return JSON.stringify(value);
  return value;
}

function saveEnvValues(values: Record<string, string | undefined>): void {
  const envPath = path.join(process.cwd(), ".env.local");
  const defined = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])));
  if (!Object.keys(defined).length) return;
  const keys = new Set(Object.keys(defined));
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const kept = existing.filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  });
  fs.writeFileSync(
    envPath,
    `${kept.filter((line) => line.trim()).concat(Object.entries(defined).map(([key, value]) => `${key}=${formatEnvValue(value)}`)).join("\n")}\n`,
    { mode: 0o600 }
  );
  fs.chmodSync(envPath, 0o600);
  Object.assign(process.env, defined);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readPrice(value: unknown): { amount: number | null; currency: string | null } {
  if (typeof value === "number" || typeof value === "string") {
    return { amount: readNumber(value), currency: null };
  }
  if (value && typeof value === "object") {
    const record = value as { amount?: unknown; divisor?: unknown; currency_code?: unknown };
    const amount = readNumber(record.amount);
    const divisor = readNumber(record.divisor);
    return {
      amount: amount !== null && divisor ? amount / divisor : null,
      currency: typeof record.currency_code === "string" ? record.currency_code : null
    };
  }
  return { amount: null, currency: null };
}

function extractResults<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object" && Array.isArray((response as { results?: unknown[] }).results)) {
    return (response as { results: T[] }).results;
  }
  return [];
}

function normalizeListing(raw: EtsyListingSummary, images: EngineListing["images"]): EngineListing & { etsyListingId: string } {
  const productType = raw.taxonomy_path?.slice(-1)[0]?.toLowerCase() ?? "etsy listing";
  const materials = raw.materials?.length ? raw.materials : ["verify material"];
  const tags = raw.tags?.length ? raw.tags : [];

  return {
    etsyListingId: String(raw.listing_id),
    title: raw.title ?? "Untitled Etsy Listing",
    description: raw.description ?? "",
    price: parsePrice(raw.price),
    quantity: raw.quantity ?? 0,
    state: raw.state ?? "unknown",
    tags,
    materials,
    productType,
    targetCustomer: "Imported from Etsy API; refine target customer locally",
    images
  };
}

export async function getEtsySyncStatus() {
  const [shop, lastSync, state, listingCount, imageCount, inventoryCount, receiptCount, transactionCount] = await Promise.all([
    prisma.shop.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.syncLog.findFirst({ where: { source: "etsy_api" }, orderBy: { createdAt: "desc" } }),
    prisma.etsySyncState.findUnique({ where: { id: "etsy" } }),
    prisma.listing.count(),
    prisma.listingImage.count(),
    prisma.listingInventory.count(),
    prisma.etsyReceipt.count(),
    prisma.etsyTransaction.count()
  ]);

  return {
    connected: Boolean(shop?.etsyShopId && process.env.ETSY_ACCESS_TOKEN),
    shop,
    lastSync,
    state,
    counts: {
      listings: listingCount,
      images: imageCount,
      inventory: inventoryCount,
      receipts: receiptCount,
      transactions: transactionCount
    }
  };
}

export async function syncEtsyReadOnly(): Promise<SyncResult> {
  const env = validateEtsyClientEnv();
  if (!env.ok) {
    return {
      ok: false,
      message: env.errors.join(" "),
      listingsPulled: 0,
      imagesPulled: 0,
      inventoryPulled: 0,
      receiptsPulled: 0,
      transactionsPulled: 0,
      errors: env.errors
    };
  }

  const startedAt = new Date();
  const errors: string[] = [];
  let listingsPulled = 0;
  let imagesPulled = 0;
  let inventoryPulled = 0;
  let receiptsPulled = 0;
  let transactionsPulled = 0;
  let shopId: string | undefined;

  try {
    const refreshed = await refreshEtsyTokenIfNeeded(false);
    if (refreshed) {
      saveEnvValues({
        ETSY_ACCESS_TOKEN: refreshed.accessToken,
        ETSY_REFRESH_TOKEN: refreshed.refreshToken,
        ETSY_TOKEN_EXPIRES_AT: refreshed.expiresAt
      });
    }

    const connectedShop = await fetchConnectedShop();
    const etsyShopId = connectedShop.shopId;
    const shopRaw = (await fetchShop({ shopId: connectedShop.shopId })) as Record<string, unknown>;
    const shop = await prisma.shop.upsert({
      where: { etsyShopId },
      update: {
        name: connectedShop.shopName,
        url: typeof shopRaw.url === "string" ? shopRaw.url : null,
        currency: typeof shopRaw.currency_code === "string" ? shopRaw.currency_code : null,
        rawJson: toJson(shopRaw)
      },
      create: {
        etsyShopId,
        name: connectedShop.shopName,
        url: typeof shopRaw.url === "string" ? shopRaw.url : null,
        currency: typeof shopRaw.currency_code === "string" ? shopRaw.currency_code : null,
        rawJson: toJson(shopRaw)
      }
    });
    shopId = shop.id;

    await prisma.etsySyncState.upsert({
      where: { id: "etsy" },
      update: {
        shopId,
        status: "running",
        message: "Etsy read-only sync is running.",
        error: null,
        lastStartedAt: startedAt
      },
      create: {
        id: "etsy",
        shopId,
        status: "running",
        message: "Etsy read-only sync is running.",
        lastStartedAt: startedAt
      }
    });

    const listingResponse = await fetchShopListings({ shopId: connectedShop.shopId });
    const rawListings = listingResponse.results ?? [];

    for (const raw of rawListings) {
      try {
        const details = await fetchListingDetails(raw.listing_id);
        const imageResponse = await fetchListingImages(raw.listing_id);
        const images =
          imageResponse.results?.map((image, index) => ({
            url: image.url_fullxfull ?? "",
            alt: image.alt_text ?? `${details.title ?? raw.title ?? "Etsy listing"} image ${index + 1}`,
            position: image.rank ?? index + 1,
            role: index === 0 ? "thumbnail" : "detail",
            etsyImageId: String(image.listing_image_id ?? ""),
            rawJson: toJson(image)
          })) ?? [];
        const item = normalizeListing({ ...raw, ...details }, images);
        const mergedListing = { ...raw, ...details };

        const listing = await prisma.listing.upsert({
          where: { etsyListingId: item.etsyListingId },
          update: {
            title: item.title,
            description: item.description,
            price: item.price,
            currency: parseCurrency(mergedListing.price),
            quantity: item.quantity,
            state: item.state,
            tags: toJson(item.tags),
            materials: toJson(item.materials),
            productType: item.productType,
            targetCustomer: item.targetCustomer,
            url: mergedListing.url ?? null,
            rawJson: toJson(mergedListing),
            lastSyncedAt: new Date()
          },
          create: {
            shopId: shop.id,
            etsyListingId: item.etsyListingId,
            title: item.title,
            description: item.description,
            price: item.price,
            currency: parseCurrency(mergedListing.price),
            quantity: item.quantity,
            state: item.state,
            tags: toJson(item.tags),
            materials: toJson(item.materials),
            productType: item.productType,
            targetCustomer: item.targetCustomer,
            url: mergedListing.url ?? null,
            rawJson: toJson(mergedListing),
            lastSyncedAt: new Date()
          }
        });

        await prisma.listingImage.deleteMany({ where: { listingId: listing.id } });
        await prisma.listingImage.createMany({
          data: (item.images ?? []).map((image) => ({ ...image, listingId: listing.id }))
        });
        imagesPulled += item.images?.length ?? 0;

        try {
          const inventory = await fetchListingInventory(raw.listing_id);
          const products = Array.isArray(inventory.products) ? inventory.products : [];
          const prices: number[] = [];
          let inventoryQuantity = 0;
          let inventoryCurrency: string | null = null;
          for (const product of products) {
            for (const offering of product.offerings ?? []) {
              inventoryQuantity += offering.quantity ?? 0;
              const price = readPrice(offering.price);
              if (price.amount !== null) prices.push(price.amount);
              if (!inventoryCurrency && price.currency) inventoryCurrency = price.currency;
            }
          }
          await prisma.listingInventory.upsert({
            where: { listingId: listing.id },
            update: {
              etsyListingId: item.etsyListingId,
              productCount: products.length,
              minPrice: prices.length ? Math.min(...prices) : null,
              maxPrice: prices.length ? Math.max(...prices) : null,
              currency: inventoryCurrency,
              quantity: inventoryQuantity,
              rawJson: toJson(inventory),
              syncedAt: new Date()
            },
            create: {
              listingId: listing.id,
              etsyListingId: item.etsyListingId,
              productCount: products.length,
              minPrice: prices.length ? Math.min(...prices) : null,
              maxPrice: prices.length ? Math.max(...prices) : null,
              currency: inventoryCurrency,
              quantity: inventoryQuantity,
              rawJson: toJson(inventory)
            }
          });
          inventoryPulled += 1;
        } catch (error) {
          errors.push(`Inventory ${raw.listing_id}: ${error instanceof Error ? error.message : String(error)}`);
        }

        const score = scoreListing(item);
        const keywords = analyzeKeywords(item);
        const bestseller = scoreBestsellerPotential(item);

        await prisma.listingScore.create({
          data: {
            listingId: listing.id,
            seoScore: score.seoScore,
            ctrScore: score.ctrScore,
            conversionScore: score.conversionScore,
            brandScore: score.brandScore,
            overallScore: score.overallScore,
            scoreReasons: toJson(score.reasons),
            fixPriorities: toJson(score.fixPriorities)
          }
        });

        await prisma.bestsellerScore.create({
          data: {
            listingId: listing.id,
            productMarketFitScore: bestseller.productMarketFitScore,
            searchDemandScore: bestseller.searchDemandScore,
            competitionScore: bestseller.competitionScore,
            giftPotentialScore: bestseller.giftPotentialScore,
            visualHookScore: bestseller.visualHookScore,
            profitPotentialScore: bestseller.profitPotentialScore,
            seasonalityScore: bestseller.seasonalityScore,
            aiSearchPotentialScore: bestseller.aiSearchPotentialScore,
            bestsellerPotentialScore: bestseller.bestsellerPotentialScore,
            verdict: bestseller.verdict,
            reasons: toJson(bestseller.reasons),
            nextActions: toJson(bestseller.nextActions)
          }
        });

        await prisma.approvalQueue.deleteMany({ where: { recommendation: { listingId: listing.id } } });
        await prisma.optimizationRecommendation.deleteMany({ where: { listingId: listing.id } });
        const recommendations = generateRecommendations(item, score, keywords);
        for (const recommendation of recommendations) {
          const created = await prisma.optimizationRecommendation.create({
            data: {
              listingId: listing.id,
              type: recommendation.type,
              priority: recommendation.priority,
              currentValue: recommendation.currentValue,
              suggestedValue: recommendation.suggestedValue,
              reason: recommendation.reason,
              expectedImpact: recommendation.expectedImpact,
              requiresApproval: true
            }
          });
          await prisma.approvalQueue.create({
            data: {
              recommendationId: created.id,
              actionType: recommendation.type,
              beforeSnapshot: recommendation.currentValue,
              afterSnapshot: recommendation.suggestedValue
            }
          });
        }

        await prisma.promotionTask.deleteMany({ where: { listingId: listing.id } });
        await prisma.promotionTask.createMany({
          data: createNext30DaysPromotionPlan(item, keywords).map((task) => ({
            listingId: listing.id,
            channel: task.channel,
            taskDate: task.taskDate,
            title: task.title,
            description: task.description
          }))
        });

        listingsPulled += 1;
      } catch (error) {
        errors.push(`Listing ${raw.listing_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      const receiptResponse = await fetchReceipts({ shopId: connectedShop.shopId });
      const receipts = extractResults<Record<string, unknown>>(receiptResponse);
      for (const receipt of receipts) {
        const receiptId = String(receipt.receipt_id ?? "");
        if (!receiptId) continue;
        const grandTotal = readPrice(receipt.grandtotal ?? receipt.total_price);
        await prisma.etsyReceipt.upsert({
          where: { etsyReceiptId: receiptId },
          update: {
            shopId,
            status: typeof receipt.status === "string" ? receipt.status : null,
            buyerUserId: receipt.buyer_user_id ? String(receipt.buyer_user_id) : null,
            buyerEmail: typeof receipt.buyer_email === "string" ? receipt.buyer_email : null,
            name: typeof receipt.name === "string" ? receipt.name : null,
            totalPrice: grandTotal.amount,
            currency: grandTotal.currency,
            createdTimestamp: readNumber(receipt.created_timestamp) ?? undefined,
            updatedTimestamp: readNumber(receipt.updated_timestamp) ?? undefined,
            rawJson: toJson(receipt),
            syncedAt: new Date()
          },
          create: {
            shopId,
            etsyReceiptId: receiptId,
            status: typeof receipt.status === "string" ? receipt.status : null,
            buyerUserId: receipt.buyer_user_id ? String(receipt.buyer_user_id) : null,
            buyerEmail: typeof receipt.buyer_email === "string" ? receipt.buyer_email : null,
            name: typeof receipt.name === "string" ? receipt.name : null,
            totalPrice: grandTotal.amount,
            currency: grandTotal.currency,
            createdTimestamp: readNumber(receipt.created_timestamp) ?? undefined,
            updatedTimestamp: readNumber(receipt.updated_timestamp) ?? undefined,
            rawJson: toJson(receipt)
          }
        });
        receiptsPulled += 1;
      }
    } catch (error) {
      errors.push(`Receipts: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const transactionResponse = await fetchTransactions({ shopId: connectedShop.shopId });
      const transactions = extractResults<Record<string, unknown>>(transactionResponse);
      for (const transaction of transactions) {
        const transactionId = String(transaction.transaction_id ?? "");
        if (!transactionId) continue;
        const price = readPrice(transaction.price);
        await prisma.etsyTransaction.upsert({
          where: { etsyTransactionId: transactionId },
          update: {
            shopId,
            etsyReceiptId: transaction.receipt_id ? String(transaction.receipt_id) : null,
            etsyListingId: transaction.listing_id ? String(transaction.listing_id) : null,
            title: typeof transaction.title === "string" ? transaction.title : null,
            quantity: readNumber(transaction.quantity) ?? 0,
            price: price.amount,
            currency: price.currency,
            createdTimestamp: readNumber(transaction.created_timestamp) ?? undefined,
            rawJson: toJson(transaction),
            syncedAt: new Date()
          },
          create: {
            shopId,
            etsyTransactionId: transactionId,
            etsyReceiptId: transaction.receipt_id ? String(transaction.receipt_id) : null,
            etsyListingId: transaction.listing_id ? String(transaction.listing_id) : null,
            title: typeof transaction.title === "string" ? transaction.title : null,
            quantity: readNumber(transaction.quantity) ?? 0,
            price: price.amount,
            currency: price.currency,
            createdTimestamp: readNumber(transaction.created_timestamp) ?? undefined,
            rawJson: toJson(transaction)
          }
        });
        transactionsPulled += 1;
      }
    } catch (error) {
      errors.push(`Transactions: ${error instanceof Error ? error.message : String(error)}`);
    }

    const finishedAt = new Date();
    const status = errors.length ? "partial_success" : "success";
    const message = `Etsy read-only sync pulled ${listingsPulled} listing(s), ${receiptsPulled} receipt(s), and ${transactionsPulled} transaction(s).`;
    await prisma.syncLog.create({
      data: {
        shopId,
        source: "etsy_api",
        mode: "read_only",
        status,
        message,
        itemCount: listingsPulled + receiptsPulled + transactionsPulled,
        listingsPulled,
        imagesPulled,
        inventoryPulled,
        receiptsPulled,
        transactionsPulled,
        errors: errors.length ? toJson(errors) : null,
        startedAt,
        finishedAt
      }
    });
    await prisma.etsySyncState.upsert({
      where: { id: "etsy" },
      update: {
        shopId,
        status,
        message,
        error: errors.length ? toJson(errors) : null,
        listingsCount: listingsPulled,
        imagesCount: imagesPulled,
        inventoryCount: inventoryPulled,
        receiptsCount: receiptsPulled,
        transactionsCount: transactionsPulled,
        lastFinishedAt: finishedAt
      },
      create: {
        id: "etsy",
        shopId,
        status,
        message,
        error: errors.length ? toJson(errors) : null,
        listingsCount: listingsPulled,
        imagesCount: imagesPulled,
        inventoryCount: inventoryPulled,
        receiptsCount: receiptsPulled,
        transactionsCount: transactionsPulled,
        lastStartedAt: startedAt,
        lastFinishedAt: finishedAt
      }
    });

    return { ok: errors.length === 0, message, listingsPulled, imagesPulled, inventoryPulled, receiptsPulled, transactionsPulled, errors };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await prisma.syncLog.create({
      data: {
        shopId,
        source: "etsy_api",
        mode: "read_only",
        status: "failed",
        message,
        itemCount: 0,
        listingsPulled: 0,
        imagesPulled: 0,
        inventoryPulled: 0,
        receiptsPulled: 0,
        transactionsPulled: 0,
        errors: toJson([message]),
        startedAt,
        finishedAt
      }
    });
    await prisma.etsySyncState.upsert({
      where: { id: "etsy" },
      update: {
        shopId,
        status: "failed",
        message,
        error: toJson([message]),
        lastFinishedAt: finishedAt
      },
      create: {
        id: "etsy",
        shopId,
        status: "failed",
        message,
        error: toJson([message]),
        lastStartedAt: startedAt,
        lastFinishedAt: finishedAt
      }
    });
    return {
      ok: false,
      message,
      listingsPulled: 0,
      imagesPulled: 0,
      inventoryPulled: 0,
      receiptsPulled: 0,
      transactionsPulled: 0,
      errors: [message]
    };
  }
}
