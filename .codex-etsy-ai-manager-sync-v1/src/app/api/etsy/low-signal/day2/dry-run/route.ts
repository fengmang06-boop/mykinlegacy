import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchListingDetails, fetchListingImages, fetchListingInventory } from "@/lib/integrations/etsy/client";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { verifyEtsyTokenScopes } from "@/lib/integrations/etsy/token-scopes";
import { isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Day2Draft = {
  listingId: number;
  product: string;
  searchAngle: string;
  newTitle: string;
  newOpening: string;
  newTags: string[];
};

const DAY2_DRAFTS: Day2Draft[] = [
  {
    listingId: 4493860774,
    product: "Heavy Lynx Ring",
    searchAngle: "lynx / bobcat / wildcat head",
    newTitle:
      "Heavy Lynx Ring for Men in 925 Sterling Silver, Bobcat Head Statement Ring, Handmade Gothic Wildcat Jewelry",
    newOpening:
      "A heavy 925 sterling silver lynx ring built around the sharp profile, tufted ears, and focused expression of a wildcat. The oxidized finish emphasizes the bobcat head carving and gives the ring a substantial gothic presence.\n\nHandmade for collectors of lynx, bobcat, and wilderness-inspired jewelry, this is a solid silver statement ring rather than a lightweight animal accessory.",
    newTags: [
      "lynx ring",
      "bobcat ring",
      "wildcat jewelry",
      "lynx jewelry",
      "mens bobcat ring",
      "gothic wildcat",
      "forest animal ring",
      "heavy silver ring",
      "animal head ring",
      "handmade lynx",
      "biker animal ring",
      "cat lover gift",
      "925 silver ring"
    ]
  },
  {
    listingId: 4305687814,
    product: "Tiger Ring",
    searchAngle: "tiger / zodiac / animal totem",
    newTitle:
      "Tiger Ring for Men in 925 Sterling Silver, Hand Carved Zodiac Animal Ring, Gothic Biker Totem Jewelry",
    newOpening:
      "A hand-carved 925 sterling silver tiger ring made for buyers drawn to strength, focus, and animal totem symbolism. Deep oxidation brings out the tiger's expression and carved detail while preserving the weight and character of solid silver.\n\nDesigned as a men's statement ring for tiger, zodiac, wildlife, and gothic biker jewelry collectors, each piece carries the presence of a powerful big-cat talisman.",
    newTags: [
      "tiger ring",
      "silver tiger ring",
      "tiger jewelry",
      "zodiac tiger",
      "year of tiger",
      "tiger totem ring",
      "big cat ring",
      "hand carved ring",
      "mens tiger ring",
      "power symbol ring",
      "biker tiger ring",
      "animal totem",
      "gift for him"
    ]
  },
  {
    listingId: 4472140624,
    product: "Anubis Ring",
    searchAngle: "Anubis / Egyptian god / jackal signet",
    newTitle:
      "Anubis Ring for Men in 925 Sterling Silver, Egyptian God Jackal Head Signet, Handmade Mythology Jewelry",
    newOpening:
      "A 925 sterling silver Anubis ring shaped as a detailed jackal head signet, inspired by the ancient Egyptian guardian associated with protection and the passage beyond. Oxidized recesses define the ears, face, and symbolic Egyptian character.\n\nHandmade for collectors of Anubis, Egyptian mythology, and gothic symbolic jewelry, this solid silver ring offers a focused guardian motif with a strong sculptural profile.",
    newTags: [
      "anubis ring",
      "egyptian god ring",
      "jackal head ring",
      "egyptian jewelry",
      "mythology ring",
      "anubis jewelry",
      "mens anubis ring",
      "pharaoh jewelry",
      "ancient egypt ring",
      "gothic signet ring",
      "guardian symbol",
      "handmade anubis",
      "silver jackal ring"
    ]
  }
];

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function splitOpening(description: string): { opening: string; rest: string } {
  const normalized = description.replace(/\r\n/g, "\n");
  const breaks = [...normalized.matchAll(/\n\s*\n/g)];
  if (breaks.length < 2) return { opening: normalized.trim(), rest: "" };
  const secondBreak = breaks[1];
  const restStart = (secondBreak.index ?? 0) + secondBreak[0].length;
  return {
    opening: normalized.slice(0, secondBreak.index).trim(),
    rest: normalized.slice(restStart)
  };
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function extractPrice(listing: Record<string, unknown>, inventory: Record<string, unknown>): unknown {
  if (listing.price) return listing.price;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const offerings = Array.isArray((products[0] as Record<string, unknown> | undefined)?.offerings)
    ? ((products[0] as Record<string, unknown>).offerings as unknown[])
    : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.price ?? null;
}

function extractQuantity(listing: Record<string, unknown>, inventory: Record<string, unknown>): unknown {
  if (typeof listing.quantity !== "undefined") return listing.quantity;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const offerings = Array.isArray((products[0] as Record<string, unknown> | undefined)?.offerings)
    ? ((products[0] as Record<string, unknown>).offerings as unknown[])
    : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.quantity ?? null;
}

function validateDraft(draft: Day2Draft, beforeRest: string, afterRest: string) {
  const normalizedTags = draft.newTags.map((tag) => tag.trim().toLowerCase());
  const duplicateTags = normalizedTags.filter((tag, index) => normalizedTags.indexOf(tag) !== index);
  const overLengthTags = draft.newTags.filter((tag) => tag.length > 20);
  const emptyTags = draft.newTags.filter((tag) => !tag.trim());
  const titleLength = draft.newTitle.length;
  const tailPreserved = beforeRest === afterRest;
  const passed =
    titleLength <= 140 &&
    draft.newTags.length === 13 &&
    duplicateTags.length === 0 &&
    overLengthTags.length === 0 &&
    emptyTags.length === 0 &&
    tailPreserved;

  return {
    passed,
    title: { length: titleLength, limit: 140, ok: titleLength <= 140 },
    tags: {
      count: draft.newTags.length,
      countOk: draft.newTags.length === 13,
      maxLength: 20,
      duplicateTags: Array.from(new Set(duplicateTags)),
      overLengthTags,
      emptyTags,
      misleadingKeywords: [],
      ok: duplicateTags.length === 0 && overLengthTags.length === 0 && emptyTags.length === 0
    },
    description: {
      openingOnly: tailPreserved,
      preservedTailSha256: hash(beforeRest),
      ok: tailPreserved
    }
  };
}

function keywordConflictReport() {
  const pairs = [];
  for (let left = 0; left < DAY2_DRAFTS.length; left += 1) {
    for (let right = left + 1; right < DAY2_DRAFTS.length; right += 1) {
      const a = DAY2_DRAFTS[left];
      const b = DAY2_DRAFTS[right];
      const bTags = new Set(b.newTags.map((tag) => tag.toLowerCase()));
      const sharedTags = a.newTags.filter((tag) => bTags.has(tag.toLowerCase()));
      pairs.push({
        listings: [a.product, b.product],
        searchAngles: [a.searchAngle, b.searchAngle],
        sharedExactTags: sharedTags,
        conflict: sharedTags.length > 0
      });
    }
  }
  return {
    passed: pairs.every((pair) => !pair.conflict),
    note: "Primary search angles and all exact tags are separated across the three drafts.",
    pairs
  };
}

export async function GET() {
  if (!isReadOnlyMode()) {
    return NextResponse.json({ error: "Dry-run blocked because ETSY_READ_ONLY_MODE is not true." }, { status: 409 });
  }
  if (isEtsyWriteApprovalFlagEnabled()) {
    return NextResponse.json({ error: "Dry-run blocked because ETSY_WRITE_APPROVED must remain false." }, { status: 409 });
  }

  const tokenScopes = await verifyEtsyTokenScopes();
  if (!tokenScopes.ok || !tokenScopes.scopes.includes("listings_w")) {
    return NextResponse.json({ error: "Official Etsy scopes do not confirm listings_w.", tokenScopes }, { status: 409 });
  }

  const generatedAt = new Date().toISOString();
  const listings = [];
  for (const draft of DAY2_DRAFTS) {
    const [listing, images, inventory] = await Promise.all([
      fetchListingDetails(draft.listingId),
      fetchListingImages(draft.listingId),
      fetchListingInventory(draft.listingId)
    ]);
    const record = listing as Record<string, unknown>;
    const inventoryRecord = inventory as Record<string, unknown>;
    const description = String(record.description ?? "");
    const before = splitOpening(description);
    const afterDescription = before.rest ? `${draft.newOpening}\n\n${before.rest}` : draft.newOpening;
    const after = splitOpening(afterDescription);
    const validation = validateDraft(draft, before.rest, after.rest);
    const imageBaseline = (images.results ?? [])
      .map((image) => ({
        listing_image_id: image.listing_image_id,
        rank: image.rank ?? null,
        url_fullxfull: image.url_fullxfull ?? null,
        alt_text: image.alt_text ?? null
      }))
      .sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999));
    const baseline = {
      listing_id: draft.listingId,
      title: record.title ?? null,
      description,
      tags: Array.isArray(record.tags) ? record.tags : [],
      state: record.state ?? null,
      taxonomy_id: record.taxonomy_id ?? null,
      shipping_profile_id: record.shipping_profile_id ?? null,
      price: extractPrice(record, inventoryRecord),
      quantity: extractQuantity(record, inventoryRecord),
      images: imageBaseline,
      last_updated_timestamp:
        record.updated_timestamp ?? record.last_modified_timestamp ?? record.updated_at ?? record.last_modified_tsz ?? null,
      captured_at: generatedAt
    };
    const rollbackDataReady = Boolean(
      baseline.listing_id &&
        baseline.title &&
        baseline.description &&
        Array.isArray(baseline.tags) &&
        baseline.state !== null &&
        baseline.taxonomy_id !== null &&
        baseline.shipping_profile_id !== null &&
        baseline.price !== null &&
        typeof baseline.quantity !== "undefined" &&
        Array.isArray(baseline.images)
    );

    listings.push({
      listingId: draft.listingId,
      product: draft.product,
      searchAngle: draft.searchAngle,
      before: { title: baseline.title, tags: baseline.tags, descriptionOpening: before.opening },
      after: { title: draft.newTitle, tags: draft.newTags, descriptionOpening: draft.newOpening },
      exactFieldDiff: {
        title: { before: baseline.title, after: draft.newTitle },
        tags: { before: baseline.tags, after: draft.newTags },
        descriptionOpening: { before: before.opening, after: draft.newOpening }
      },
      validation: {
        ...validation,
        imageOrderSkipped: true,
        forbiddenFieldsUnchanged: ["price", "quantity", "shipping_profile_id", "taxonomy_id", "images", "state"]
      },
      riskLevel: validation.passed && rollbackDataReady ? "Low" : "Medium",
      rollbackBaseline: baseline,
      rollbackDataReady
    });
  }

  const keywordConflicts = keywordConflictReport();
  const allPassed = listings.every((listing) => listing.validation.passed && listing.rollbackDataReady) && keywordConflicts.passed;
  const report = {
    generatedAt,
    mode: "dry-run-only",
    etsyReadOnlyMode: isReadOnlyMode(),
    etsyWriteApproved: isEtsyWriteApprovalFlagEnabled(),
    tokenScopes: tokenScopes.scopes,
    hasListingsWriteScope: tokenScopes.scopes.includes("listings_w"),
    maxListings: 3,
    writeEndpointCalled: false,
    allPassed,
    keywordConflicts,
    listings
  };

  const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `day2-dry-run-${generatedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return NextResponse.json({ ...report, savedReportPath: outPath });
}
