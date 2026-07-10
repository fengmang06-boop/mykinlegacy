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

type Day1Draft = {
  listingId: number;
  product: string;
  oldTitle: string;
  newTitle: string;
  oldOpening: string;
  newOpening: string;
  newTags: string[];
};

const DAY1_DRAFTS: Day1Draft[] = [
  {
    listingId: 4515032622,
    product: "Sterling Silver Ram Ring",
    oldTitle:
      "Sterling Silver Ram Ring, Oxidized Silver Goat Horn Rings, Mens Biker Statement Ring, Gothic Animal Jewelry",
    newTitle:
      "Ram Ring for Men in 925 Sterling Silver, Oxidized Goat Horn Ring, Gothic Biker Animal Jewelry",
    oldOpening:
      "Embrace the untamed power and majestic aura of the wild with our handcrafted 925 Sterling Silver Ram Head Ring.\n\nThis is not just a piece of jewelry; it is a masterfully sculpted statement of strength, leadership, and bold individuality. Inspired by the rugged beauty of mountain ibexes and mythical protectors, this ring captures every intricate detail, from the powerful sweep of the spiraled horns to the lifelike texture of the fur.",
    newOpening:
      "A heavy 925 sterling silver ram ring made for buyers who want strength, horn symbolism, and gothic biker style in one handmade piece. The oxidized goat horn design gives the ring a bold animal profile with visible depth and texture.\n\nThis ring is built as a statement piece for Aries, ram, goat horn, Viking, and dark animal jewelry buyers who want solid silver rather than plated fashion jewelry.",
    newTags: [
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
    oldTitle:
      "Cocker Spaniel Ring, Heavy Vintage Dog Ring, Detailed Animal Jewelry, Pet Memorial Rings, Dog Lover Gift",
    newTitle:
      "Cocker Spaniel Ring in 925 Sterling Silver, Heavy Dog Memorial Ring, Handmade Pet Lover Jewelry Gift",
    oldOpening:
      "Embrace loyal companionship and bold aesthetics with this exquisitely handcrafted Cocker Spaniel ring. Sculpted with hyper-realistic details, this ring captures the flowing fur and soulful expression of the beloved spaniel breed.\n\nCast in solid 925 sterling silver and finished with a dark vintage oxidation to highlight every intricate carving, this heavy-duty piece is not just an accessory, it is a statement of passion, rebellion, and underground luxury.",
    newOpening:
      "A heavy 925 sterling silver Cocker Spaniel ring made for dog lovers, pet memorial keepsakes, and collectors of detailed animal jewelry. The design focuses on a bold dog portrait, oxidized depth, and a vintage MENSSKULL feel.\n\nThis is not a lightweight novelty ring. It is a solid, handcrafted silver piece with strong presence, carved fur detail, and a meaningful companion-inspired story.",
    newTags: [
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
      "gothic dog ring",
      "handmade ring"
    ]
  },
  {
    listingId: 4525990305,
    product: "Rooster Ring",
    oldTitle: "Rooster Ring for Men - Solid 925 Sterling Silver Farm Animal Statement Jewelry",
    newTitle:
      "Rooster Ring for Men in 925 Sterling Silver, Heavy Farm Animal Statement Ring, Handmade Gothic Jewelry",
    oldOpening:
      "BOLD. PROUD. FEARLESS.\n\nThis handcrafted Rooster Ring is forged from solid 925 sterling silver and inspired by one of the most symbolic animals in history.\n\nKnown for courage, confidence, and leadership, the rooster has long represented determination, vigilance, and the strength to greet every new day.",
    newOpening:
      "A solid 925 sterling silver rooster ring designed as a bold farm animal statement piece for men. The oxidized details give the rooster form a rugged gothic character while keeping the meaning clear: courage, confidence, and leadership.\n\nBuilt for animal jewelry collectors, country lifestyle buyers, and anyone who wants a handmade silver ring with symbolic strength.",
    newTags: [
      "rooster ring",
      "silver rooster",
      "farm animal ring",
      "chicken ring",
      "rooster jewelry",
      "mens animal ring",
      "925 silver ring",
      "gothic ring men",
      "country jewelry",
      "statement ring",
      "oxidized ring",
      "handmade ring",
      "animal jewelry"
    ]
  }
];

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function splitParagraphs(description: string): { opening: string; rest: string } {
  const normalized = description.replace(/\r\n/g, "\n");
  const matches = [...normalized.matchAll(/\n\s*\n/g)];
  if (matches.length < 2) {
    return { opening: normalized, rest: "" };
  }
  const secondBreak = matches[1];
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

function validateDraft(draft: Day1Draft, descriptionRestBefore: string, descriptionRestAfter: string) {
  const lowerTags = draft.newTags.map((tag) => tag.toLowerCase());
  const duplicateTags = lowerTags.filter((tag, index) => lowerTags.indexOf(tag) !== index);
  const overLengthTags = draft.newTags.filter((tag) => tag.length > 20);
  const titleLengthOk = draft.newTitle.length <= 140;
  const tagCountOk = draft.newTags.length === 13;
  const tagsUnique = duplicateTags.length === 0;
  const tagsLengthOk = overLengthTags.length === 0;
  const descriptionTailPreserved = descriptionRestBefore === descriptionRestAfter;
  const misleadingKeywords: string[] = [];

  return {
    passed: titleLengthOk && tagCountOk && tagsUnique && tagsLengthOk && descriptionTailPreserved,
    title: {
      length: draft.newTitle.length,
      limit: 140,
      ok: titleLengthOk
    },
    tags: {
      count: draft.newTags.length,
      countOk: tagCountOk,
      maxLength: 20,
      overLengthTags,
      duplicateTags: Array.from(new Set(duplicateTags)),
      ok: tagCountOk && tagsUnique && tagsLengthOk,
      misleadingKeywords
    },
    description: {
      openingOnly: descriptionTailPreserved,
      preservedTailSha256: hash(descriptionRestBefore),
      ok: descriptionTailPreserved
    }
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
    return NextResponse.json(
      {
        error: "Dry-run blocked because Etsy official tokenScopes does not confirm listings_w.",
        tokenScopes
      },
      { status: 409 }
    );
  }

  const generatedAt = new Date().toISOString();
  const listings = [];

  for (const draft of DAY1_DRAFTS) {
    const [listing, images, inventory] = await Promise.all([
      fetchListingDetails(draft.listingId),
      fetchListingImages(draft.listingId),
      fetchListingInventory(draft.listingId)
    ]);
    const listingRecord = listing as Record<string, unknown>;
    const inventoryRecord = inventory as Record<string, unknown>;
    const description = String(listingRecord.description ?? "");
    const { opening: beforeOpening, rest } = splitParagraphs(description);
    const afterDescription = `${draft.newOpening}\n\n${rest}`;
    const afterSplit = splitParagraphs(afterDescription);
    const oldOpeningMatchesExpected = normalize(beforeOpening) === normalize(draft.oldOpening);
    const validation = validateDraft(draft, rest, afterSplit.rest);
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
      title: listingRecord.title ?? null,
      description,
      tags: Array.isArray(listingRecord.tags) ? listingRecord.tags : [],
      state: listingRecord.state ?? null,
      taxonomy_id: listingRecord.taxonomy_id ?? null,
      shipping_profile_id: listingRecord.shipping_profile_id ?? null,
      price: extractPrice(listingRecord, inventoryRecord),
      quantity: extractQuantity(listingRecord, inventoryRecord),
      images: imageBaseline,
      last_updated_timestamp:
        listingRecord.updated_timestamp ?? listingRecord.updated_at ?? listingRecord.last_modified_tsz ?? null
    };

    listings.push({
      listingId: draft.listingId,
      product: draft.product,
      before: {
        title: baseline.title,
        tags: baseline.tags,
        descriptionOpening: beforeOpening
      },
      after: {
        title: draft.newTitle,
        tags: draft.newTags,
        descriptionOpening: draft.newOpening
      },
      exactFieldDiff: {
        title: { before: baseline.title, after: draft.newTitle },
        tags: { before: baseline.tags, after: draft.newTags },
        descriptionOpening: { before: beforeOpening, after: draft.newOpening }
      },
      validation: {
        ...validation,
        oldOpeningMatchesExpected,
        imageOrderSkipped: true,
        forbiddenFieldsUnchanged: ["price", "quantity", "shipping_profile_id", "taxonomy_id", "images", "state"]
      },
      riskLevel: validation.passed && oldOpeningMatchesExpected ? "Low" : "Medium",
      rollbackBaseline: baseline,
      rollbackDataReady: Boolean(
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
      )
    });
  }

  const allPassed = listings.every((listing) => listing.validation.passed && listing.rollbackDataReady);
  const report = {
    generatedAt,
    mode: "dry-run-only",
    etsyReadOnlyMode: isReadOnlyMode(),
    etsyWriteApproved: isEtsyWriteApprovalFlagEnabled(),
    tokenScopes: tokenScopes.scopes,
    hasListingsWriteScope: tokenScopes.scopes.includes("listings_w"),
    imageOrderSkipped: true,
    allPassed,
    listings
  };

  const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `day1-dry-run-${generatedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  return NextResponse.json({ ...report, savedReportPath: outPath });
}
