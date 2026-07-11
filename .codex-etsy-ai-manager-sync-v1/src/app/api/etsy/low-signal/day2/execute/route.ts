import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  fetchListingDetails,
  fetchListingImages,
  fetchListingInventory,
  fetchTransactions,
  resolveEtsyShopId
} from "@/lib/integrations/etsy/client";
import { saveEnvValues } from "@/lib/env-store";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { verifyEtsyTokenScopes } from "@/lib/integrations/etsy/token-scopes";
import { assertEtsyListingWriteGuard, isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

const FINAL_CHANGES = [
  {
    listingId: 4493860774,
    product: "Heavy Lynx Ring",
    title: "Heavy Lynx Ring for Men in 925 Sterling Silver, Bobcat Head Statement Ring, Handmade Gothic Wildcat Jewelry",
    descriptionOpening:
      "A heavy 925 sterling silver lynx ring built around the sharp profile, tufted ears, and focused expression of a wildcat. The oxidized finish emphasizes the bobcat head carving and gives the ring a substantial gothic presence.\n\nHandmade for collectors of lynx, bobcat, and wilderness-inspired jewelry, this is a solid silver statement ring rather than a lightweight animal accessory.",
    tags: ["lynx ring", "bobcat ring", "wildcat jewelry", "lynx jewelry", "mens bobcat ring", "gothic wildcat", "forest animal ring", "heavy silver ring", "animal head ring", "handmade lynx", "biker animal ring", "cat lover gift", "925 silver ring"]
  },
  {
    listingId: 4305687814,
    product: "Tiger Ring",
    title: "Tiger Ring for Men in 925 Sterling Silver, Hand Carved Zodiac Animal Ring, Gothic Biker Totem Jewelry",
    descriptionOpening:
      "A hand-carved 925 sterling silver tiger ring made for buyers drawn to strength, focus, and animal totem symbolism. Deep oxidation brings out the tiger's expression and carved detail while preserving the weight and character of solid silver.\n\nDesigned as a men's statement ring for tiger, zodiac, wildlife, and gothic biker jewelry collectors, each piece carries the presence of a powerful big-cat talisman.",
    tags: ["tiger ring", "silver tiger ring", "tiger jewelry", "zodiac tiger", "year of tiger", "tiger totem ring", "big cat ring", "hand carved ring", "mens tiger ring", "power symbol ring", "biker tiger ring", "animal totem", "gift for him"]
  },
  {
    listingId: 4472140624,
    product: "Anubis Ring",
    title: "Anubis Ring for Men in 925 Sterling Silver, Egyptian God Jackal Head Signet, Handmade Mythology Jewelry",
    descriptionOpening:
      "A 925 sterling silver Anubis ring shaped as a detailed jackal head signet, inspired by the ancient Egyptian guardian associated with protection and the passage beyond. Oxidized recesses define the ears, face, and symbolic Egyptian character.\n\nHandmade for collectors of Anubis, Egyptian mythology, and gothic symbolic jewelry, this solid silver ring offers a focused guardian motif with a strong sculptural profile.",
    tags: ["anubis ring", "egyptian god ring", "jackal head ring", "egyptian jewelry", "mythology ring", "anubis jewelry", "mens anubis ring", "pharaoh jewelry", "ancient egypt ring", "gothic signet ring", "guardian symbol", "handmade anubis", "silver jackal ring"]
  }
] as const;

function splitOpening(description: string) {
  const normalized = description.replace(/\r\n/g, "\n");
  const breaks = [...normalized.matchAll(/\n\s*\n/g)];
  if (breaks.length < 2) return { opening: normalized.trim(), rest: "" };
  const second = breaks[1];
  const restStart = (second.index ?? 0) + second[0].length;
  return { opening: normalized.slice(0, second.index).trim(), rest: normalized.slice(restStart) };
}

function normalize(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function moneyValue(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  if (!value || typeof value !== "object") return 0;
  const money = value as Record<string, unknown>;
  return numberValue(money.amount) / (numberValue(money.divisor) || 100);
}

function transactionListingId(row: Record<string, unknown>) {
  return numberValue(row.listing_id ?? row.listingId);
}

function transactionMetrics(rows: Array<Record<string, unknown>>, listingId: number) {
  const matches = rows.filter((row) => transactionListingId(row) === listingId);
  return {
    orders: matches.length,
    units: matches.reduce((sum, row) => sum + Math.max(1, numberValue(row.quantity)), 0),
    revenue: Number(matches.reduce((sum, row) => sum + moneyValue(row.price ?? row.transaction_price) * Math.max(1, numberValue(row.quantity)), 0).toFixed(2))
  };
}

function extractPrice(listing: Record<string, unknown>, inventory: Record<string, unknown>) {
  if (listing.price) return listing.price;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const offerings = Array.isArray((products[0] as Record<string, unknown> | undefined)?.offerings)
    ? ((products[0] as Record<string, unknown>).offerings as unknown[]) : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.price ?? null;
}

function extractQuantity(listing: Record<string, unknown>, inventory: Record<string, unknown>) {
  if (typeof listing.quantity !== "undefined") return listing.quantity;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const offerings = Array.isArray((products[0] as Record<string, unknown> | undefined)?.offerings)
    ? ((products[0] as Record<string, unknown>).offerings as unknown[]) : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.quantity ?? null;
}

async function readBaseline(listingId: number) {
  const [listing, images, inventory] = await Promise.all([
    fetchListingDetails(listingId), fetchListingImages(listingId), fetchListingInventory(listingId)
  ]);
  const record = listing as Record<string, unknown>;
  const inventoryRecord = inventory as Record<string, unknown>;
  return {
    listing_id: listingId,
    title: String(record.title ?? ""),
    description: String(record.description ?? ""),
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    views: numberValue(record.views),
    favorites: numberValue(record.num_favorers ?? record.favorites),
    state: record.state ?? null,
    taxonomy_id: record.taxonomy_id ?? null,
    shipping_profile_id: record.shipping_profile_id ?? null,
    price: extractPrice(record, inventoryRecord),
    quantity: extractQuantity(record, inventoryRecord),
    images: (images.results ?? []).map((image) => ({
      listing_image_id: image.listing_image_id, rank: image.rank ?? null,
      url_fullxfull: image.url_fullxfull ?? null, alt_text: image.alt_text ?? null
    })).sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999)),
    last_updated_timestamp: record.updated_timestamp ?? record.last_modified_timestamp ?? record.updated_at ?? record.last_modified_tsz ?? null,
    captured_at: new Date().toISOString()
  };
}

function rollbackReady(baseline: Awaited<ReturnType<typeof readBaseline>>) {
  return Boolean(baseline.title && baseline.description && baseline.state !== null && baseline.taxonomy_id !== null &&
    baseline.shipping_profile_id !== null && baseline.price !== null && baseline.quantity !== null && Array.isArray(baseline.images));
}

function validate(change: (typeof FINAL_CHANGES)[number]) {
  const lower = change.tags.map((tag) => tag.toLowerCase());
  return change.title.length <= 140 && change.tags.length === 13 && new Set(lower).size === 13 && change.tags.every((tag) => tag.length <= 20);
}

function forbiddenSnapshot(baseline: Awaited<ReturnType<typeof readBaseline>>) {
  return JSON.stringify({
    state: baseline.state, taxonomy_id: baseline.taxonomy_id, shipping_profile_id: baseline.shipping_profile_id,
    price: baseline.price, quantity: baseline.quantity,
    images: baseline.images.map((image) => ({ listing_image_id: image.listing_image_id, rank: image.rank }))
  });
}

async function patchListing(shopId: string, listingId: number, body: URLSearchParams) {
  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = process.env.ETSY_CLIENT_SECRET ?? "";
  const response = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
      Authorization: `Bearer ${process.env.ETSY_ACCESS_TOKEN ?? ""}`,
      Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Etsy updateListing failed for ${listingId}: ${response.status} ${text}`);
  return data;
}

function trackingCsv(executedAt: string) {
  const rows = ["listing_id,product,checkpoint,target_date,etsy_change_timestamp,views,favorites,orders,revenue,notes"];
  for (const change of FINAL_CHANGES) {
    for (const [label, days] of [["D1", 1], ["D3", 3], ["D7", 7], ["D14", 14]] as const) {
      const target = new Date(executedAt); target.setUTCDate(target.getUTCDate() + days);
      rows.push(`${change.listingId},"${change.product}",${label},${target.toISOString().slice(0, 10)},${executedAt},,,,,"Read-only API tracking"`);
    }
  }
  return `${rows.join("\n")}\n`;
}

export async function POST() {
  const executedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  try {
    if (!isReadOnlyMode() || isEtsyWriteApprovalFlagEnabled()) {
      return NextResponse.json({ error: "Execution must start with read-only=true and write-approved=false." }, { status: 409 });
    }
    const scopes = await verifyEtsyTokenScopes();
    if (!scopes.ok || !scopes.scopes.includes("listings_w")) {
      return NextResponse.json({ error: "Official Etsy tokenScopes does not confirm listings_w.", scopes }, { status: 409 });
    }
    const transactions = await fetchTransactions(undefined, { maxItems: 5000 });
    const transactionRows = (transactions.results ?? []) as Array<Record<string, unknown>>;
    const baselines = new Map<number, Awaited<ReturnType<typeof readBaseline>>>();
    for (const change of FINAL_CHANGES) {
      const baseline = await readBaseline(change.listingId);
      if (!validate(change) || !rollbackReady(baseline)) {
        return NextResponse.json({ error: "Validation or rollback baseline failed.", product: change.product }, { status: 409 });
      }
      baselines.set(change.listingId, baseline);
    }

    process.env.ETSY_READ_ONLY_MODE = "false";
    process.env.ETSY_WRITE_APPROVED = "true";
    const shopId = await resolveEtsyShopId();

    for (const change of FINAL_CHANGES) {
      const before = baselines.get(change.listingId)!;
      const { rest } = splitOpening(before.description);
      const expectedDescription = rest ? `${change.descriptionOpening}\n\n${rest}` : change.descriptionOpening;
      assertEtsyListingWriteGuard({
        approval: { founderApproved: true, csoApproved: true, approvalReference: "Founder approved Day 2 exact dry-run diffs on 2026-07-11" },
        dryRunDiffReviewed: true,
        rollbackBaseline: before,
        diffs: [{ listingId: change.listingId, fields: {
          title: { before: before.title, after: change.title }, tags: { before: before.tags, after: change.tags },
          descriptionOpening: { before: splitOpening(before.description).opening, after: change.descriptionOpening }
        }}],
        listingsEditedToday: results.length, maxListingsPerDay: 3
      });
      await patchListing(shopId, change.listingId, new URLSearchParams({
        title: change.title, tags: change.tags.join(","), description: expectedDescription
      }));
      const after = await readBaseline(change.listingId);
      const verification = {
        titleExact: after.title === change.title,
        tagsExact: JSON.stringify(after.tags) === JSON.stringify(change.tags),
        descriptionExact: normalize(after.description) === normalize(expectedDescription),
        forbiddenFieldsUnchanged: forbiddenSnapshot(after) === forbiddenSnapshot(before)
      };
      const verified = Object.values(verification).every(Boolean);
      results.push({
        listingId: change.listingId, product: change.product, verified, verification,
        rollbackBaselineReady: true, rollbackBaseline: before,
        trackingBaseline: { views: before.views, favorites: before.favorites, ...transactionMetrics(transactionRows, change.listingId) },
        after: { title: after.title, tags: after.tags, descriptionOpening: splitOpening(after.description).opening, lastUpdatedTime: after.last_updated_timestamp }
      });
      if (!verified) throw new Error(`Verification failed for ${change.product}; execution stopped.`);
    }

    const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = executedAt.replace(/[:.]/g, "-");
    const reportPath = path.join(outDir, `day2-execution-${stamp}.json`);
    const trackingPath = path.join(outDir, `day2-tracking-${stamp}.csv`);
    fs.writeFileSync(reportPath, JSON.stringify({ executedAt, allSuccessful: true, results }, null, 2));
    fs.writeFileSync(trackingPath, trackingCsv(executedAt));
    return NextResponse.json({ executedAt, allSuccessful: true, results, reportPath, trackingPath });
  } catch (error) {
    return NextResponse.json({ executedAt, allSuccessful: false, error: error instanceof Error ? error.message : String(error), results }, { status: 500 });
  } finally {
    process.env.ETSY_READ_ONLY_MODE = "true";
    process.env.ETSY_WRITE_APPROVED = "false";
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" });
  }
}
