import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Listing, ListingImage, ListingInventory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EtsyApiError,
  fetchListingBaselineDetails,
  type EtsyListingInventoryResponse,
  type EtsyListingSummary
} from "./client";
import { getEtsyDailyReserve, getEtsyRateLimitSnapshot } from "./rate-limit";
import { isReadOnlyMode } from "./read-only-guard";
import { isEtsyWriteApprovalFlagEnabled } from "./write-guard";

export const MAX_BASELINE_LISTINGS = 3;
const DEFAULT_CACHE_MAX_AGE_MINUTES = 360;

type CachedListing = Listing & {
  images: ListingImage[];
  inventory: ListingInventory | null;
};

export type ListingBaselineSource = "database" | "cache" | "etsy_api";

export type ListingBaseline = {
  listing_id: string;
  title: string;
  tags: string[];
  state: string;
  price: unknown;
  quantity: number;
  taxonomy_id: number | string | null;
  shipping_profile_id: number | string | null;
  images: Array<{
    listing_image_id: string;
    rank: number;
  }>;
  last_updated_timestamp: number | string | null;
  baseline_source: ListingBaselineSource;
  baseline_captured_at: string;
  baseline_sha256: string;
};

export type ListingBaselineReport = {
  batch_key: string;
  generated_at: string;
  mode: "read_only";
  etsy_read_only_mode: true;
  etsy_write_approved: false;
  requested_listing_ids: string[];
  api_calls_used: number;
  stopped_on_429: boolean;
  quota: {
    remaining_today: number | null;
    daily_limit: number | null;
    reserve_required: number | null;
  };
  listings: ListingBaseline[];
  report_sha256: string;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hashJson(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateListingIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_BASELINE_LISTINGS) {
    throw new Error(`listingIds must contain between 1 and ${MAX_BASELINE_LISTINGS} Etsy listing IDs.`);
  }
  const ids = input.map((value) => String(value));
  if (ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error("Every Etsy listing ID must contain digits only.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate Etsy listing IDs are not allowed.");
  }
  return ids;
}

export function validateBatchKey(input: unknown): string {
  if (typeof input === "undefined") return `baseline-${new Date().toISOString().slice(0, 10)}`;
  const value = String(input).trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw new Error("batchKey must use lowercase letters, digits, and hyphens only.");
  }
  return value;
}

function cacheTimestamp(listing: CachedListing): Date | null {
  return listing.lastSyncedAt ?? listing.updatedAt ?? null;
}

function cacheIsRecent(listing: CachedListing, now = Date.now()): boolean {
  const timestamp = cacheTimestamp(listing);
  if (!timestamp) return false;
  const configured = Number(process.env.ETSY_BASELINE_CACHE_MAX_AGE_MINUTES ?? DEFAULT_CACHE_MAX_AGE_MINUTES);
  const maxAgeMinutes = Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_CACHE_MAX_AGE_MINUTES;
  return now - timestamp.getTime() <= maxAgeMinutes * 60_000;
}

function rawListing(listing: CachedListing): Record<string, unknown> {
  return parseJson<Record<string, unknown>>(listing.rawJson, {});
}

function cacheHasCompleteBaseline(listing: CachedListing): boolean {
  const raw = rawListing(listing);
  const tags = parseJson<unknown>(listing.tags, null);
  const imagesComplete = listing.images.every((image) => Boolean(image.etsyImageId) && Number.isInteger(image.position));
  return (
    Array.isArray(tags) &&
    typeof listing.title === "string" &&
    Boolean(listing.state) &&
    Number.isFinite(listing.price) &&
    Number.isInteger(listing.quantity) &&
    raw.taxonomy_id !== null &&
    typeof raw.taxonomy_id !== "undefined" &&
    raw.shipping_profile_id !== null &&
    typeof raw.shipping_profile_id !== "undefined" &&
    (typeof raw.updated_timestamp !== "undefined" ||
      typeof raw.last_modified_timestamp !== "undefined" ||
      typeof raw.last_modified_tsz !== "undefined") &&
    imagesComplete &&
    Boolean(cacheTimestamp(listing))
  );
}

function withBaselineHash(value: Omit<ListingBaseline, "baseline_sha256">): ListingBaseline {
  return { ...value, baseline_sha256: hashJson(value) };
}

function baselineFromCache(listing: CachedListing, capturedAt: string): ListingBaseline {
  const raw = rawListing(listing);
  const timestamp = cacheTimestamp(listing);
  return withBaselineHash({
    listing_id: listing.etsyListingId,
    title: listing.title,
    tags: parseJson<string[]>(listing.tags, []),
    state: listing.state,
    price: { amount: listing.price, currency_code: listing.currency ?? null },
    quantity: listing.quantity,
    taxonomy_id: (raw.taxonomy_id as number | string | null | undefined) ?? null,
    shipping_profile_id: (raw.shipping_profile_id as number | string | null | undefined) ?? null,
    images: listing.images
      .map((image) => ({ listing_image_id: String(image.etsyImageId), rank: image.position }))
      .sort((left, right) => left.rank - right.rank),
    last_updated_timestamp:
      (raw.updated_timestamp as number | string | null | undefined) ??
      (raw.last_modified_timestamp as number | string | null | undefined) ??
      (raw.last_modified_tsz as number | string | null | undefined) ??
      timestamp?.toISOString() ??
      null,
    baseline_source: listing.lastSyncedAt ? "cache" : "database",
    baseline_captured_at: capturedAt
  });
}

function quantityFromInventory(inventory: EtsyListingInventoryResponse | undefined): number | null {
  if (!inventory?.products?.length) return null;
  return inventory.products.reduce((total, product) => {
    const productQuantity = (product.offerings ?? [])
      .filter((offering) => offering.is_enabled !== false)
      .reduce((sum, offering) => sum + (Number.isFinite(offering.quantity) ? Number(offering.quantity) : 0), 0);
    return total + productQuantity;
  }, 0);
}

function baselineFromApi(listing: EtsyListingSummary, capturedAt: string): ListingBaseline {
  const images = Array.isArray(listing.images) ? listing.images : [];
  const quantity = typeof listing.quantity === "number" ? listing.quantity : quantityFromInventory(listing.inventory);
  if (
    !listing.listing_id ||
    typeof listing.title !== "string" ||
    !Array.isArray(listing.tags) ||
    typeof listing.state !== "string" ||
    typeof quantity !== "number" ||
    typeof listing.taxonomy_id === "undefined" ||
    typeof listing.shipping_profile_id === "undefined" ||
    !Array.isArray(listing.images)
  ) {
    throw new Error(`Etsy baseline response for listing ${listing.listing_id || "UNKNOWN"} is incomplete.`);
  }
  return withBaselineHash({
    listing_id: String(listing.listing_id),
    title: listing.title,
    tags: listing.tags,
    state: listing.state,
    price: listing.price ?? null,
    quantity,
    taxonomy_id: listing.taxonomy_id,
    shipping_profile_id: listing.shipping_profile_id,
    images: images
      .map((image, index) => ({
        listing_image_id: String(image.listing_image_id),
        rank: typeof image.rank === "number" ? image.rank : index + 1
      }))
      .sort((left, right) => left.rank - right.rank),
    last_updated_timestamp:
      listing.updated_timestamp ?? listing.last_modified_timestamp ?? listing.last_modified_tsz ?? null,
    baseline_source: "etsy_api",
    baseline_captured_at: capturedAt
  });
}

function saveReport(report: ListingBaselineReport): string {
  const directory = path.join(process.cwd(), "exports", "low-signal-breakthrough", report.batch_key);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "baseline.json");
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

export async function captureListingBaselines(listingIds: string[], batchKey: string): Promise<{
  report: ListingBaselineReport;
  savedReportPath: string;
}> {
  if (!isReadOnlyMode() || isEtsyWriteApprovalFlagEnabled()) {
    throw new Error("Baseline capture requires ETSY_READ_ONLY_MODE=true and ETSY_WRITE_APPROVED=false.");
  }

  const cached = await prisma.listing.findMany({
    where: { etsyListingId: { in: listingIds } },
    include: { images: { orderBy: { position: "asc" } }, inventory: true }
  });
  const byId = new Map(cached.map((listing) => [listing.etsyListingId, listing]));
  const missing = listingIds.filter((listingId) => !byId.has(listingId));
  if (missing.length) {
    throw new Error(`Requested listing IDs are not present in the connected shop database: ${missing.join(", ")}.`);
  }

  const capturedAt = new Date().toISOString();
  const baselines: ListingBaseline[] = [];
  let apiCallsUsed = 0;
  let stoppedOn429 = false;

  for (const listingId of listingIds) {
    const listing = byId.get(listingId)!;
    if (cacheHasCompleteBaseline(listing) && cacheIsRecent(listing)) {
      baselines.push(baselineFromCache(listing, capturedAt));
      continue;
    }

    try {
      apiCallsUsed += 1;
      const current = await fetchListingBaselineDetails(listingId);
      if (String(current.listing_id) !== listingId) {
        throw new Error(`Etsy returned listing ${current.listing_id} while ${listingId} was requested.`);
      }
      baselines.push(baselineFromApi(current, capturedAt));
    } catch (error) {
      if (error instanceof EtsyApiError && error.status === 429) stoppedOn429 = true;
      throw error;
    }
  }

  const quota = getEtsyRateLimitSnapshot();
  const reportWithoutHash = {
    batch_key: batchKey,
    generated_at: capturedAt,
    mode: "read_only" as const,
    etsy_read_only_mode: true as const,
    etsy_write_approved: false as const,
    requested_listing_ids: listingIds,
    api_calls_used: apiCallsUsed,
    stopped_on_429: stoppedOn429,
    quota: {
      remaining_today: quota?.remainingToday ?? null,
      daily_limit: quota?.limitPerDay ?? null,
      reserve_required: getEtsyDailyReserve(quota)
    },
    listings: baselines
  };
  const report: ListingBaselineReport = { ...reportWithoutHash, report_sha256: hashJson(reportWithoutHash) };
  return { report, savedReportPath: saveReport(report) };
}

export const listingBaselineTestUtils = {
  hashJson,
  cacheIsRecent,
  cacheHasCompleteBaseline,
  baselineFromApi
};
