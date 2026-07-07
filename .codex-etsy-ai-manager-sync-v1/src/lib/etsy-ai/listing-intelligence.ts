import { prisma } from "@/lib/prisma";
import { parseStringList, toJson } from "@/lib/json";

export const LISTING_AI_ANALYSIS_VERSION = "listing-intelligence-v1";

type ListingForAnalysis = Awaited<ReturnType<typeof loadListingForAnalysis>>;

type ActionBlock = {
  summary: string;
  title: {
    strengths: string[];
    weaknesses: string[];
    suggestedTitle: string;
  };
  tags: {
    weakTags: string[];
    duplicateMeaning: string[];
    unusedKeywordOpportunities: string[];
    longTailOpportunities: string[];
    suggestedReplacementTags: string[];
  };
  images: {
    suggestions: string[];
    missingLifestyle: boolean;
    missingCloseUp: boolean;
    missingScaleReference: boolean;
    missingPackaging: boolean;
    missingVideo: boolean;
    imageQualityRisk: "High" | "Medium" | "Low";
  };
  pricing: {
    currentPrice: number;
    verdict: "Too cheap" | "Too expensive" | "High conversion candidate" | "Premium candidate" | "Fair";
    reasons: string[];
  };
  conversion: {
    risk: "High" | "Medium" | "Low";
    suggestions: string[];
  };
  priorityReasons: string[];
};

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function includesAny(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function loadListingForAnalysis(listingId: string) {
  return prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      images: true,
      inventory: true,
      aiReports: { where: { analysisVersion: LISTING_AI_ANALYSIS_VERSION }, orderBy: { updatedAt: "desc" }, take: 1 }
    }
  });
}

function titleAnalysis(listing: NonNullable<ListingForAnalysis>, tags: string[]) {
  const title = listing.title.trim();
  const titleWords = words(title);
  const repeatedWords = unique(titleWords.filter((word, index) => word.length > 3 && titleWords.indexOf(word) !== index));
  const primaryMaterial = includesAny(title, ["sterling", "925", "silver"]);
  const primaryProduct = includesAny(title, ["ring", "necklace", "pendant", "bracelet", "earring", "charm"]);
  const darkStyle = includesAny(title, ["skull", "gothic", "biker", "snake", "raven", "dark", "punk"]);
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (primaryMaterial) strengths.push("Material keyword is visible in the title.");
  else weaknesses.push("Add verified material wording near the front, such as sterling silver or 925 silver.");
  if (primaryProduct) strengths.push("Product type is clear for Etsy search.");
  else weaknesses.push("Move the concrete product type into the first title phrase.");
  if (darkStyle) strengths.push("Style intent matches MENSSKULL positioning.");
  else weaknesses.push("Add a stronger style keyword such as skull, gothic, biker, or dark jewelry.");
  if (title.length < 70) weaknesses.push("Title is short for Etsy SEO coverage.");
  if (title.length > 135) weaknesses.push("Title is long and may be hard to scan on mobile.");
  if (repeatedWords.length) weaknesses.push(`Repeated wording detected: ${repeatedWords.slice(0, 4).join(", ")}.`);

  const tagSignals = tags.filter((tag) => !title.toLowerCase().includes(tag.toLowerCase().split(/\s+/)[0])).slice(0, 3);
  const suggestedParts = unique([
    primaryMaterial ? "" : "Sterling Silver",
    primaryProduct ? "" : listing.productType,
    darkStyle ? "" : "Gothic Skull Jewelry",
    title.replace(/\s+/g, " ").slice(0, 95),
    ...tagSignals
  ]).filter(Boolean);
  const suggestedTitle = suggestedParts.join(" | ").slice(0, 135);

  let score = 100;
  if (!primaryMaterial) score -= 18;
  if (!primaryProduct) score -= 14;
  if (!darkStyle) score -= 10;
  if (title.length < 70) score -= 12;
  if (title.length > 135) score -= 10;
  score -= Math.min(repeatedWords.length * 5, 15);

  return { score: clamp(score), strengths, weaknesses, suggestedTitle };
}

function tagAnalysis(tags: string[], title: string, description: string) {
  const weakTags = tags.filter((tag) => tag.length < 4 || /^(gift|men|silver|jewelry)$/i.test(tag));
  const roots = tags.map((tag) => words(tag)[0] ?? tag.toLowerCase());
  const duplicateMeaning = unique(tags.filter((_, index) => roots.indexOf(roots[index]) !== index));
  const combined = `${title} ${description} ${tags.join(" ")}`;
  const opportunities = [
    "sterling silver ring",
    "gothic skull ring",
    "biker silver jewelry",
    "mens skull ring",
    "925 silver pendant",
    "dark jewelry gift",
    "handmade silver gift",
    "statement skull ring"
  ].filter((term) => !includesAny(combined, [term]));
  const longTailOpportunities = opportunities.filter((term) => term.split(" ").length >= 3).slice(0, 6);
  const suggestedReplacementTags = unique([...opportunities, ...weakTags.map((tag) => `${tag} jewelry`)]).slice(0, 13);

  let score = 100;
  score -= Math.abs(13 - tags.length) * 5;
  score -= weakTags.length * 5;
  score -= duplicateMeaning.length * 6;
  if (!longTailOpportunities.length) score += 3;

  return {
    score: clamp(score),
    weakTags,
    duplicateMeaning,
    unusedKeywordOpportunities: opportunities.slice(0, 8),
    longTailOpportunities,
    suggestedReplacementTags
  };
}

function imageAnalysis(listing: NonNullable<ListingForAnalysis>) {
  const images = listing.images;
  const text = images.map((image) => `${image.role} ${image.alt}`).join(" ").toLowerCase();
  const missingLifestyle = !includesAny(text, ["lifestyle", "worn", "model", "hand", "neck", "finger"]);
  const missingCloseUp = !includesAny(text, ["close", "detail", "macro", "texture"]);
  const missingScaleReference = !includesAny(text, ["scale", "size", "hand", "coin", "ruler", "worn"]);
  const missingPackaging = !includesAny(text, ["packaging", "box", "gift", "pouch"]);
  const missingVideo = !includesAny((listing.rawJson ?? "").toLowerCase(), ["video"]);
  const suggestions: string[] = [];

  if (images.length < 8) suggestions.push("Add more Etsy images; target 8-10 frames for trust and mobile scanning.");
  if (missingLifestyle) suggestions.push("Add a lifestyle or worn photo.");
  if (missingCloseUp) suggestions.push("Add a close-up showing silver texture and carving detail.");
  if (missingScaleReference) suggestions.push("Add a scale reference image.");
  if (missingPackaging) suggestions.push("Add packaging or gift-ready proof.");
  if (missingVideo) suggestions.push("Add an Etsy listing video if available.");

  let score = 100;
  if (images.length < 5) score -= 30;
  else if (images.length < 8) score -= 12;
  for (const missing of [missingLifestyle, missingCloseUp, missingScaleReference, missingPackaging, missingVideo]) {
    if (missing) score -= 8;
  }
  const imageQualityRisk: "High" | "Medium" | "Low" = score < 55 ? "High" : score < 78 ? "Medium" : "Low";

  return { score: clamp(score), suggestions, missingLifestyle, missingCloseUp, missingScaleReference, missingPackaging, missingVideo, imageQualityRisk };
}

function pricingAnalysis(listing: NonNullable<ListingForAnalysis>) {
  const raw = parseJsonObject(listing.rawJson);
  const favorers = numeric(raw.num_favorers) ?? numeric(raw.favorers) ?? 0;
  const views = numeric(raw.views) ?? numeric(raw.views_count) ?? 0;
  const quantity = listing.inventory?.quantity ?? listing.quantity;
  const price = listing.price;
  const reasons: string[] = [];
  let verdict: ActionBlock["pricing"]["verdict"] = "Fair";
  let score = 78;

  if (price < 25 && includesAny(listing.title, ["sterling", "925", "silver"])) {
    verdict = "Too cheap";
    reasons.push("Sterling silver positioning may support a higher price.");
    score -= 10;
  } else if (price > 160 && views > 0 && favorers / Math.max(views, 1) < 0.01) {
    verdict = "Too expensive";
    reasons.push("High price with low favorite signal creates conversion risk.");
    score -= 14;
  } else if (favorers >= 10 && quantity > 0) {
    verdict = "High conversion candidate";
    reasons.push("Favorites and available inventory suggest conversion potential.");
    score += 12;
  } else if (price >= 80 && includesAny(`${listing.title} ${listing.description}`, ["handmade", "sterling", "925"])) {
    verdict = "Premium candidate";
    reasons.push("Premium price is supported by material or handmade signals.");
    score += 8;
  }

  if (quantity <= 0) {
    reasons.push("Inventory is unavailable or missing.");
    score -= 25;
  } else if (quantity <= 2) {
    reasons.push("Low inventory can limit conversion momentum.");
    score -= 8;
  }

  return { score: clamp(score), currentPrice: price, verdict, reasons };
}

function freshnessScore(listing: NonNullable<ListingForAnalysis>): number {
  const raw = parseJsonObject(listing.rawJson);
  const updated = numeric(raw.updated_timestamp) ?? numeric(raw.last_modified_tsz);
  const created = numeric(raw.created_timestamp) ?? numeric(raw.original_creation_timestamp);
  const source = updated ?? created;
  if (!source) return 65;
  const ageDays = (Date.now() - source * 1000) / 86400000;
  if (ageDays <= 30) return 95;
  if (ageDays <= 90) return 82;
  if (ageDays <= 180) return 70;
  if (ageDays <= 365) return 55;
  return 42;
}

function competitionScore(listing: NonNullable<ListingForAnalysis>, tags: string[]): number {
  const crowded = ["skull ring", "silver ring", "mens ring", "gothic ring", "biker ring"];
  const combined = `${listing.title} ${tags.join(" ")}`.toLowerCase();
  const crowdedHits = crowded.filter((term) => combined.includes(term)).length;
  const differentiators = ["handmade", "sterling", "925", "mensskull", "unique", "statement", "gift"].filter((term) => combined.includes(term)).length;
  return clamp(76 - crowdedHits * 7 + differentiators * 5);
}

export function analyzeListingIntelligence(listing: NonNullable<ListingForAnalysis>) {
  const tags = parseStringList(listing.tags);
  const title = titleAnalysis(listing, tags);
  const tag = tagAnalysis(tags, listing.title, listing.description);
  const image = imageAnalysis(listing);
  const pricing = pricingAnalysis(listing);
  const fresh = freshnessScore(listing);
  const competition = competitionScore(listing, tags);
  const conversionSuggestions: string[] = [];

  if (image.imageQualityRisk !== "Low") conversionSuggestions.push("Improve image proof before scaling ads or promotions.");
  if (title.score < 75) conversionSuggestions.push("Rewrite title around material, product type, and strongest buyer keyword.");
  if (tag.score < 75) conversionSuggestions.push("Replace weak or duplicate tags with long-tail buying phrases.");
  if (pricing.score < 70) conversionSuggestions.push("Review price against inventory and favorite/view signal.");
  if (listing.quantity <= 0) conversionSuggestions.push("Inventory is unavailable, which blocks conversion.");

  const seoScore = clamp(title.score * 0.55 + tag.score * 0.45);
  const conversionScore = clamp(title.score * 0.2 + tag.score * 0.15 + image.score * 0.35 + pricing.score * 0.25 + fresh * 0.05);
  const riskPoints = [title.score, tag.score, image.score, pricing.score, fresh].filter((score) => score < 70).length;
  const riskLevel: "High" | "Medium" | "Low" = riskPoints >= 3 || conversionScore < 55 ? "High" : riskPoints >= 1 || conversionScore < 75 ? "Medium" : "Low";
  const opportunity = clamp((100 - conversionScore) * 0.45 + (100 - seoScore) * 0.35 + (100 - competition) * 0.1 + (100 - fresh) * 0.1);
  const overallPriority = opportunity >= 65 || riskLevel === "High" ? "Critical" : opportunity >= 48 ? "High" : opportunity >= 28 ? "Medium" : "Low";
  const priorityReasons = unique([
    ...title.weaknesses.slice(0, 2),
    ...tag.unusedKeywordOpportunities.slice(0, 2).map((term) => `Missing keyword opportunity: ${term}.`),
    ...image.suggestions.slice(0, 2),
    ...pricing.reasons.slice(0, 2),
    ...conversionSuggestions.slice(0, 2)
  ]).slice(0, 8);

  const actions: ActionBlock = {
    summary: `${overallPriority} priority with ${riskLevel.toLowerCase()} conversion risk. Focus on ${priorityReasons[0] ?? "maintaining current listing quality"}`,
    title: {
      strengths: title.strengths,
      weaknesses: title.weaknesses,
      suggestedTitle: title.suggestedTitle
    },
    tags: {
      weakTags: tag.weakTags,
      duplicateMeaning: tag.duplicateMeaning,
      unusedKeywordOpportunities: tag.unusedKeywordOpportunities,
      longTailOpportunities: tag.longTailOpportunities,
      suggestedReplacementTags: tag.suggestedReplacementTags
    },
    images: {
      suggestions: image.suggestions,
      missingLifestyle: image.missingLifestyle,
      missingCloseUp: image.missingCloseUp,
      missingScaleReference: image.missingScaleReference,
      missingPackaging: image.missingPackaging,
      missingVideo: image.missingVideo,
      imageQualityRisk: image.imageQualityRisk
    },
    pricing: {
      currentPrice: listing.price,
      verdict: pricing.verdict,
      reasons: pricing.reasons
    },
    conversion: {
      risk: riskLevel,
      suggestions: conversionSuggestions
    },
    priorityReasons
  };

  return {
    seoScore,
    titleScore: title.score,
    tagScore: tag.score,
    imageScore: image.score,
    conversionScore,
    pricingScore: pricing.score,
    competitionScore: competition,
    freshnessScore: fresh,
    overallPriority,
    riskLevel,
    recommendedActions: toJson(actions),
    analysisVersion: LISTING_AI_ANALYSIS_VERSION
  };
}

export async function analyzeAndSaveListing(listingId: string) {
  const listing = await loadListingForAnalysis(listingId);
  if (!listing) throw new Error(`Listing not found: ${listingId}`);
  const report = analyzeListingIntelligence(listing);
  return prisma.listingAiReport.create({
    data: {
      listingId,
      ...report
    }
  });
}

export async function analyzeAllListings(options: { retry?: boolean; limit?: number } = {}) {
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      updatedAt: true,
      lastSyncedAt: true,
      aiReports: { where: { analysisVersion: LISTING_AI_ANALYSIS_VERSION }, orderBy: { updatedAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit
  });

  let analyzed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    const lastReport = listing.aiReports[0];
    const sourceUpdatedAt = listing.lastSyncedAt ?? listing.updatedAt;
    if (!options.retry && lastReport && lastReport.updatedAt >= sourceUpdatedAt) {
      skipped += 1;
      continue;
    }
    try {
      await analyzeAndSaveListing(listing.id);
      analyzed += 1;
    } catch (error) {
      errors.push(`${listing.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const totalReports = await prisma.listingAiReport.count({ where: { analysisVersion: LISTING_AI_ANALYSIS_VERSION } });
  return {
    ok: errors.length === 0,
    analyzed,
    skipped,
    totalListings: listings.length,
    totalReports,
    remaining: Math.max(0, listings.length - analyzed - skipped),
    errors
  };
}
