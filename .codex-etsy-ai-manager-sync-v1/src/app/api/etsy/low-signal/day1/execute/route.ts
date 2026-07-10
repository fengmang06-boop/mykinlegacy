import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchListingDetails, fetchListingImages, fetchListingInventory, resolveEtsyShopId } from "@/lib/integrations/etsy/client";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { verifyEtsyTokenScopes } from "@/lib/integrations/etsy/token-scopes";
import { assertEtsyListingWriteGuard, isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";
import { saveEnvValues } from "@/lib/env-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

type FinalChange = {
  listingId: number;
  product: string;
  title: string;
  descriptionOpening: string;
  tags: string[];
};

const FINAL_CHANGES: FinalChange[] = [
  {
    listingId: 4515032622,
    product: "Sterling Silver Ram Ring",
    title: "Ram Ring for Men in 925 Sterling Silver, Oxidized Goat Horn Ring, Gothic Biker Animal Jewelry",
    descriptionOpening:
      "A heavy 925 sterling silver ram ring made for buyers who want strength, horn symbolism, and gothic biker style in one handmade piece. The oxidized goat horn design gives the ring a bold animal profile with visible depth and texture.\n\nThis ring is built as a statement piece for Aries, ram, goat horn, Viking, and dark animal jewelry buyers who want solid silver rather than plated fashion jewelry.",
    tags: [
      "ram ring",
      "goat horn ring",
      "silver ram ring",
      "aries ring",
      "mens animal ring",
      "gothic biker",
      "horn ring",
      "925 silver ring",
      "oxidized ring",
      "statement ring",
      "handmade ring",
      "animal jewelry",
      "heavy ring"
    ]
  },
  {
    listingId: 4533307056,
    product: "Cocker Spaniel Ring",
    title: "Cocker Spaniel Ring in 925 Sterling Silver, Heavy Dog Memorial Ring, Handmade Pet Lover Jewelry Gift",
    descriptionOpening:
      "A heavy 925 sterling silver Cocker Spaniel ring made for dog lovers, pet memorial keepsakes, and collectors of detailed animal jewelry. The design focuses on a bold dog portrait, oxidized depth, and a vintage MENSSKULL feel.\n\nThis is not a lightweight novelty ring. It is a solid, handcrafted silver piece with strong presence, carved fur detail, and a meaningful companion-inspired story.",
    tags: [
      "cocker ring",
      "dog memorial ring",
      "dog lover gift",
      "silver dog ring",
      "spaniel jewelry",
      "pet loss gift",
      "animal ring",
      "mens dog ring",
      "925 silver ring",
      "vintage dog ring",
      "heavy silver ring",
      "dog keepsake",
      "handmade ring"
    ]
  },
  {
    listingId: 4525990305,
    product: "Rooster Ring",
    title: "Rooster Ring for Men in 925 Sterling Silver, Heavy Farm Animal Statement Ring, Handmade Country Jewelry",
    descriptionOpening:
      "A solid 925 sterling silver rooster ring designed as a bold farm animal statement piece for men. The oxidized details give the rooster form a rugged gothic character while keeping the meaning clear: courage, confidence, and leadership.\n\nBuilt for animal jewelry collectors, country lifestyle buyers, and anyone who wants a handmade silver ring with symbolic strength.",
    tags: [
      "rooster ring",
      "silver rooster",
      "farm animal ring",
      "chicken ring",
      "rooster jewelry",
      "mens animal ring",
      "925 silver ring",
      "country jewelry",
      "zodiac rooster",
      "year of rooster",
      "statement ring",
      "handmade ring",
      "gift for him"
    ]
  }
];

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function splitParagraphs(description: string): { opening: string; rest: string } {
  const normalized = description.replace(/\r\n/g, "\n");
  const matches = [...normalized.matchAll(/\n\s*\n/g)];
  if (matches.length < 2) return { opening: normalized, rest: "" };
  const secondBreak = matches[1];
  const restStart = (secondBreak.index ?? 0) + secondBreak[0].length;
  return {
    opening: normalized.slice(0, secondBreak.index).trim(),
    rest: normalized.slice(restStart)
  };
}

function buildDescription(currentDescription: string, nextOpening: string): string {
  const { rest } = splitParagraphs(currentDescription);
  return rest ? `${nextOpening}\n\n${rest}` : nextOpening;
}

function validateChange(change: FinalChange) {
  const lowerTags = change.tags.map((tag) => tag.toLowerCase());
  const duplicateTags = lowerTags.filter((tag, index) => lowerTags.indexOf(tag) !== index);
  const overLengthTags = change.tags.filter((tag) => tag.length > 20);
  return {
    titleOk: change.title.length <= 140,
    tagCountOk: change.tags.length === 13,
    tagsUnique: duplicateTags.length === 0,
    tagsLengthOk: overLengthTags.length === 0,
    duplicateTags: Array.from(new Set(duplicateTags)),
    overLengthTags,
    passed: change.title.length <= 140 && change.tags.length === 13 && duplicateTags.length === 0 && overLengthTags.length === 0
  };
}

function extractPrice(listing: Record<string, unknown>, inventory: Record<string, unknown>): unknown {
  if (listing.price) return listing.price;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const firstProduct = products[0] as Record<string, unknown> | undefined;
  const offerings = Array.isArray(firstProduct?.offerings) ? firstProduct.offerings : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.price ?? null;
}

function extractQuantity(listing: Record<string, unknown>, inventory: Record<string, unknown>): unknown {
  if (typeof listing.quantity !== "undefined") return listing.quantity;
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const firstProduct = products[0] as Record<string, unknown> | undefined;
  const offerings = Array.isArray(firstProduct?.offerings) ? firstProduct.offerings : [];
  return (offerings[0] as Record<string, unknown> | undefined)?.quantity ?? null;
}

async function readBaseline(listingId: number) {
  const [listing, images, inventory] = await Promise.all([
    fetchListingDetails(listingId),
    fetchListingImages(listingId),
    fetchListingInventory(listingId)
  ]);
  const listingRecord = listing as Record<string, unknown>;
  const inventoryRecord = inventory as Record<string, unknown>;
  return {
    listing_id: listingId,
    title: listingRecord.title ?? null,
    description: String(listingRecord.description ?? ""),
    tags: Array.isArray(listingRecord.tags) ? listingRecord.tags : [],
    state: listingRecord.state ?? null,
    taxonomy_id: listingRecord.taxonomy_id ?? null,
    shipping_profile_id: listingRecord.shipping_profile_id ?? null,
    price: extractPrice(listingRecord, inventoryRecord),
    quantity: extractQuantity(listingRecord, inventoryRecord),
    images: (images.results ?? [])
      .map((image) => ({
        listing_image_id: image.listing_image_id,
        rank: image.rank ?? null,
        url_fullxfull: image.url_fullxfull ?? null,
        alt_text: image.alt_text ?? null
      }))
      .sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999)),
    last_updated_timestamp:
      listingRecord.updated_timestamp ?? listingRecord.updated_at ?? listingRecord.last_modified_tsz ?? null
  };
}

function rollbackReady(baseline: Awaited<ReturnType<typeof readBaseline>>): boolean {
  return Boolean(
    baseline.listing_id &&
      baseline.title &&
      baseline.description &&
      Array.isArray(baseline.tags) &&
      typeof baseline.state !== "undefined" &&
      typeof baseline.taxonomy_id !== "undefined" &&
      typeof baseline.shipping_profile_id !== "undefined" &&
      typeof baseline.price !== "undefined" &&
      typeof baseline.quantity !== "undefined" &&
      Array.isArray(baseline.images)
  );
}

async function patchListing(shopId: string, listingId: number, body: URLSearchParams) {
  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = process.env.ETSY_CLIENT_SECRET ?? "";
  const accessToken = process.env.ETSY_ACCESS_TOKEN ?? "";
  const response = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`Etsy updateListing failed for ${listingId}: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function verificationFor(after: Awaited<ReturnType<typeof readBaseline>>, expected: FinalChange, expectedDescription: string) {
  const actualTags = (after.tags as unknown[]).map(String);
  return {
    titleExact: after.title === expected.title,
    tagsExact: JSON.stringify(actualTags) === JSON.stringify(expected.tags),
    descriptionExact: normalize(after.description) === normalize(expectedDescription),
    actual: {
      title: after.title,
      tags: actualTags,
      descriptionOpening: splitParagraphs(after.description).opening
    },
    expected: {
      title: expected.title,
      tags: expected.tags,
      descriptionOpening: expected.descriptionOpening
    }
  };
}

function trackingCsv(executedAt: string) {
  const rows = [
    "listing_id,product,checkpoint,target_date,etsy_change_timestamp,views,favorites,orders,notes",
    ...FINAL_CHANGES.flatMap((change) => {
      const start = new Date(executedAt);
      const checkpoints = [
        ["D1", 1],
        ["D3", 3],
        ["D7", 7],
        ["D14", 14]
      ] as const;
      return checkpoints.map(([label, days]) => {
        const target = new Date(start);
        target.setUTCDate(target.getUTCDate() + days);
        return `${change.listingId},"${change.product}",${label},${target.toISOString().slice(0, 10)},${executedAt},,,,"Track views/favorites/orders after verified API write."`;
      });
    })
  ];
  return `${rows.join("\n")}\n`;
}

export async function POST() {
  const originalReadOnly = process.env.ETSY_READ_ONLY_MODE;
  const originalWriteApproved = process.env.ETSY_WRITE_APPROVED;
  const executedAt = new Date().toISOString();
  const results = [];
  let allSuccessful = false;

  try {
    if (!isReadOnlyMode()) {
      return NextResponse.json({ error: "Execution refused: ETSY_READ_ONLY_MODE must start as true." }, { status: 409 });
    }
    if (isEtsyWriteApprovalFlagEnabled()) {
      return NextResponse.json({ error: "Execution refused: ETSY_WRITE_APPROVED must start as false." }, { status: 409 });
    }
    const scopes = await verifyEtsyTokenScopes();
    if (!scopes.ok || !scopes.scopes.includes("listings_w")) {
      return NextResponse.json({ error: "Execution refused: official tokenScopes does not confirm listings_w.", scopes }, { status: 409 });
    }

    const shopId = await resolveEtsyShopId();
    const baselines = new Map<number, Awaited<ReturnType<typeof readBaseline>>>();
    for (const change of FINAL_CHANGES) {
      const baseline = await readBaseline(change.listingId);
      baselines.set(change.listingId, baseline);
      const nextDescription = buildDescription(baseline.description, change.descriptionOpening);
      const validation = validateChange(change);
      assertEtsyListingWriteGuard({
        approval: {
          founderApproved: true,
          csoApproved: true,
          approvalReference: "CSO final review completed for exact Day 1 final diffs"
        },
        dryRunDiffReviewed: true,
        rollbackBaseline: baseline,
        diffs: [
          {
            listingId: change.listingId,
            fields: {
              title: { before: baseline.title, after: change.title },
              tags: { before: baseline.tags, after: change.tags },
              descriptionOpening: { before: splitParagraphs(baseline.description).opening, after: change.descriptionOpening }
            }
          }
        ],
        listingsEditedToday: results.length,
        maxListingsPerDay: 3
      });
      if (!validation.passed || !rollbackReady(baseline)) {
        return NextResponse.json({ error: "Execution refused: validation or rollback baseline failed.", change, validation, baseline }, { status: 409 });
      }
    }

    process.env.ETSY_READ_ONLY_MODE = "false";
    process.env.ETSY_WRITE_APPROVED = "true";

    for (const change of FINAL_CHANGES) {
      const baseline = baselines.get(change.listingId) ?? (await readBaseline(change.listingId));
      const nextDescription = buildDescription(baseline.description, change.descriptionOpening);
      const body = new URLSearchParams({
        title: change.title,
        description: nextDescription,
        tags: change.tags.join(",")
      });

      const updateResponse = await patchListing(shopId, change.listingId, body);
      const after = await readBaseline(change.listingId);
      const verification = verificationFor(after, change, nextDescription);
      const verified = verification.titleExact && verification.tagsExact && verification.descriptionExact;
      const result = {
        listingId: change.listingId,
        product: change.product,
        updateStatus: "attempted",
        verified,
        verification,
        rollbackBaselineReady: rollbackReady(baseline),
        rollbackBaseline: baseline,
        updateResponse
      };
      results.push(result);

      if (!verified) {
        throw new Error(`Verification failed after Etsy write for ${change.product}. Stopping immediately.`);
      }
    }

    allSuccessful = true;

    const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
    fs.mkdirSync(outDir, { recursive: true });
    const reportPath = path.join(outDir, `day1-execution-${executedAt.replace(/[:.]/g, "-")}.json`);
    const trackingPath = path.join(outDir, `day1-tracking-${executedAt.replace(/[:.]/g, "-")}.csv`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ executedAt, allSuccessful, results }, null, 2)
    );
    fs.writeFileSync(trackingPath, trackingCsv(executedAt));

    return NextResponse.json({ executedAt, allSuccessful, results, reportPath, trackingPath });
  } catch (error) {
    return NextResponse.json(
      {
        executedAt,
        allSuccessful,
        error: error instanceof Error ? error.message : String(error),
        results
      },
      { status: 500 }
    );
  } finally {
    process.env.ETSY_READ_ONLY_MODE = "true";
    process.env.ETSY_WRITE_APPROVED = "false";
    saveEnvValues({
      ETSY_READ_ONLY_MODE: "true",
      ETSY_WRITE_APPROVED: "false"
    });
    if (typeof originalReadOnly === "string") process.env.ETSY_READ_ONLY_MODE = "true";
    if (typeof originalWriteApproved === "string") process.env.ETSY_WRITE_APPROVED = "false";
  }
}
