import { prisma } from "@/lib/prisma";
import { parseStringList, toJson } from "@/lib/json";

export const LISTING_AI_ANALYSIS_VERSION = "listing-intelligence-v2";

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

type AnalysisSignals = {
  salesQuantity: number;
  transactionCount: number;
};

type WeightedScore = {
  score: number;
  weight: number;
  basis: string;
};

type ScoreBreakdown = {
  scoringVersion: string;
  weights: Record<string, number>;
  seo: Record<string, WeightedScore>;
  conversion: Record<string, WeightedScore>;
  opportunity: Record<string, WeightedScore>;
  evidence: {
    favorites: number;
    views: number;
    salesQuantity: number;
    transactionCount: number;
    inventoryQuantity: number;
    price: number;
  };
};

const SEO_WEIGHTS = {
  titleScore: 0.55,
  tagScore: 0.45
} as const;

const CONVERSION_WEIGHTS = {
  titleScore: 0.2,
  tagScore: 0.15,
  imageScore: 0.35,
  pricingScore: 0.25,
  freshnessScore: 0.05
} as const;

const OPPORTUNITY_WEIGHTS = {
  seoGap: 0.28,
  conversionGap: 0.28,
  salesSignal: 0.16,
  favoriteSignal: 0.12,
  inventoryReadiness: 0.1,
  freshnessGap: 0.06
} as const;

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

function weightedAverage(values: Record<string, WeightedScore>): number {
  const totalWeight = Object.values(values).reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return clamp(Object.values(values).reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
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

function listingDemandEvidence(listing: NonNullable<ListingForAnalysis>, signals: AnalysisSignals) {
  const raw = parseJsonObject(listing.rawJson);
  const favorites = numeric(raw.num_favorers) ?? numeric(raw.favorers) ?? 0;
  const views = numeric(raw.views) ?? numeric(raw.views_count) ?? 0;
  const inventoryQuantity = listing.inventory?.quantity ?? listing.quantity;
  const favoriteRate = views > 0 ? favorites / views : 0;
  return {
    favorites,
    views,
    inventoryQuantity,
    favoriteRate,
    salesQuantity: signals.salesQuantity,
    transactionCount: signals.transactionCount
  };
}

function buildScoreBreakdown(input: {
  listing: NonNullable<ListingForAnalysis>;
  titleScore: number;
  tagScore: number;
  imageScore: number;
  pricingScore: number;
  freshnessScore: number;
  seoScore: number;
  conversionScore: number;
  signals: AnalysisSignals;
}): { opportunityScore: number; scoreBreakdown: ScoreBreakdown } {
  const evidence = listingDemandEvidence(input.listing, input.signals);
  const salesSignal = clamp(Math.min(100, evidence.salesQuantity * 18 + evidence.transactionCount * 10));
  const favoriteSignal = clamp(Math.min(100, evidence.favorites * 4 + evidence.favoriteRate * 1000));
  const inventoryReadiness = evidence.inventoryQuantity <= 0 ? 0 : evidence.inventoryQuantity <= 2 ? 55 : 90;
  const seoGap = 100 - input.seoScore;
  const conversionGap = 100 - input.conversionScore;
  const freshnessGap = 100 - input.freshnessScore;
  const opportunity = {
    seoGap: {
      score: seoGap,
      weight: OPPORTUNITY_WEIGHTS.seoGap,
      basis: "Higher when title and tags leave clear SEO improvement room."
    },
    conversionGap: {
      score: conversionGap,
      weight: OPPORTUNITY_WEIGHTS.conversionGap,
      basis: "Higher when images, pricing, title, tags, or freshness create conversion drag."
    },
    salesSignal: {
      score: salesSignal,
      weight: OPPORTUNITY_WEIGHTS.salesSignal,
      basis: "Uses synced local Etsy transactions for this listing; stronger sales history raises priority."
    },
    favoriteSignal: {
      score: favoriteSignal,
      weight: OPPORTUNITY_WEIGHTS.favoriteSignal,
      basis: "Uses Etsy listing favorite and view metadata when present; interest without conversion raises priority."
    },
    inventoryReadiness: {
      score: inventoryReadiness,
      weight: OPPORTUNITY_WEIGHTS.inventoryReadiness,
      basis: "Only prioritizes work that can be acted on; unavailable inventory reduces priority."
    },
    freshnessGap: {
      score: freshnessGap,
      weight: OPPORTUNITY_WEIGHTS.freshnessGap,
      basis: "Older listings receive a modest refresh opportunity boost."
    }
  };

  const scoreBreakdown: ScoreBreakdown = {
    scoringVersion: LISTING_AI_ANALYSIS_VERSION,
    weights: {
      ...SEO_WEIGHTS,
      ...CONVERSION_WEIGHTS,
      ...OPPORTUNITY_WEIGHTS
    },
    seo: {
      titleScore: {
        score: input.titleScore,
        weight: SEO_WEIGHTS.titleScore,
        basis: "Title quality, keyword placement, length, readability, CTR potential, and duplicate wording."
      },
      tagScore: {
        score: input.tagScore,
        weight: SEO_WEIGHTS.tagScore,
        basis: "Tag count, weak tags, duplicate meaning, and long-tail keyword opportunities."
      }
    },
    conversion: {
      titleScore: {
        score: input.titleScore,
        weight: CONVERSION_WEIGHTS.titleScore,
        basis: "Title clarity affects search clicks and buyer confidence."
      },
      tagScore: {
        score: input.tagScore,
        weight: CONVERSION_WEIGHTS.tagScore,
        basis: "Better query alignment can improve buyer-match quality."
      },
      imageScore: {
        score: input.imageScore,
        weight: CONVERSION_WEIGHTS.imageScore,
        basis: "Image count, lifestyle proof, close-up, scale, packaging, video, and quality risk."
      },
      pricingScore: {
        score: input.pricingScore,
        weight: CONVERSION_WEIGHTS.pricingScore,
        basis: "Current price, inventory, favorites/views, material signal, and premium/discount risk."
      },
      freshnessScore: {
        score: input.freshnessScore,
        weight: CONVERSION_WEIGHTS.freshnessScore,
        basis: "Recent listing update or creation metadata from Etsy."
      }
    },
    opportunity,
    evidence: {
      favorites: evidence.favorites,
      views: evidence.views,
      salesQuantity: evidence.salesQuantity,
      transactionCount: evidence.transactionCount,
      inventoryQuantity: evidence.inventoryQuantity,
      price: input.listing.price
    }
  };

  return {
    opportunityScore: weightedAverage(opportunity),
    scoreBreakdown
  };
}

export function analyzeListingIntelligence(listing: NonNullable<ListingForAnalysis>, signals: AnalysisSignals = { salesQuantity: 0, transactionCount: 0 }) {
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

  const seoScore = weightedAverage({
    titleScore: {
      score: title.score,
      weight: SEO_WEIGHTS.titleScore,
      basis: "Title quality, keyword placement, length, readability, CTR potential, and duplicate wording."
    },
    tagScore: {
      score: tag.score,
      weight: SEO_WEIGHTS.tagScore,
      basis: "Tag count, weak tags, duplicate meaning, and long-tail keyword opportunities."
    }
  });
  const conversionScore = weightedAverage({
    titleScore: {
      score: title.score,
      weight: CONVERSION_WEIGHTS.titleScore,
      basis: "Title clarity affects search clicks and buyer confidence."
    },
    tagScore: {
      score: tag.score,
      weight: CONVERSION_WEIGHTS.tagScore,
      basis: "Better query alignment can improve buyer-match quality."
    },
    imageScore: {
      score: image.score,
      weight: CONVERSION_WEIGHTS.imageScore,
      basis: "Image count and missing proof elements."
    },
    pricingScore: {
      score: pricing.score,
      weight: CONVERSION_WEIGHTS.pricingScore,
      basis: "Price, inventory, and Etsy metadata signals."
    },
    freshnessScore: {
      score: fresh,
      weight: CONVERSION_WEIGHTS.freshnessScore,
      basis: "Listing age/update metadata."
    }
  });
  const riskPoints = [title.score, tag.score, image.score, pricing.score, fresh].filter((score) => score < 70).length;
  const riskLevel: "High" | "Medium" | "Low" = riskPoints >= 3 || conversionScore < 55 ? "High" : riskPoints >= 1 || conversionScore < 75 ? "Medium" : "Low";
  const { opportunityScore, scoreBreakdown } = buildScoreBreakdown({
    listing,
    titleScore: title.score,
    tagScore: tag.score,
    imageScore: image.score,
    pricingScore: pricing.score,
    freshnessScore: fresh,
    seoScore,
    conversionScore,
    signals
  });
  const overallPriority = opportunityScore >= 65 || riskLevel === "High" ? "Critical" : opportunityScore >= 48 ? "High" : opportunityScore >= 28 ? "Medium" : "Low";
  const priorityReasons = unique([
    ...title.weaknesses.slice(0, 2),
    ...tag.unusedKeywordOpportunities.slice(0, 2).map((term) => `Missing keyword opportunity: ${term}.`),
    ...image.suggestions.slice(0, 2),
    ...pricing.reasons.slice(0, 2),
    ...conversionSuggestions.slice(0, 2)
  ]).slice(0, 8);

  const actions: ActionBlock = {
    summary: `${overallPriority} priority with ${riskLevel.toLowerCase()} conversion risk and Opportunity Score ${opportunityScore}. Focus on ${priorityReasons[0] ?? "maintaining current listing quality"}`,
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
    opportunityScore,
    overallPriority,
    riskLevel,
    recommendedActions: toJson(actions),
    scoreBreakdown: toJson(scoreBreakdown),
    analysisVersion: LISTING_AI_ANALYSIS_VERSION
  };
}

export async function analyzeAndSaveListing(listingId: string) {
  const listing = await loadListingForAnalysis(listingId);
  if (!listing) throw new Error(`Listing not found: ${listingId}`);
  const transactions = await prisma.etsyTransaction.findMany({
    where: { etsyListingId: listing.etsyListingId },
    select: { quantity: true }
  });
  const signals = {
    transactionCount: transactions.length,
    salesQuantity: transactions.reduce((sum, transaction) => sum + transaction.quantity, 0)
  };
  const report = analyzeListingIntelligence(listing, signals);
  const created = await prisma.listingAiReport.create({
    data: {
      listingId,
      ...report
    }
  });
  await prisma.listingAiSnapshot.create({
    data: {
      listingId,
      reportId: created.id,
      seoScore: report.seoScore,
      conversionScore: report.conversionScore,
      opportunityScore: report.opportunityScore,
      overallPriority: report.overallPriority,
      riskLevel: report.riskLevel,
      snapshotJson: toJson({
        listing: {
          etsyListingId: listing.etsyListingId,
          title: listing.title,
          price: listing.price,
          quantity: listing.quantity,
          imageCount: listing.images.length,
          lastSyncedAt: listing.lastSyncedAt
        },
        scores: report,
        signals
      }),
      analysisVersion: LISTING_AI_ANALYSIS_VERSION
    }
  });
  return created;
}

function queueTaskFromReport(report: Awaited<ReturnType<typeof prisma.listingAiReport.findMany>>[number]) {
  const actions = parseJsonObject(report.recommendedActions);
  const scores = [
    { type: "title", score: report.titleScore, title: "Review title keyword order", reason: "Title score is the weakest explainable lever." },
    { type: "tags", score: report.tagScore, title: "Review tags and long-tail keywords", reason: "Tag score indicates missing or duplicate keyword coverage." },
    { type: "images", score: report.imageScore, title: "Review listing image proof", reason: "Image score indicates conversion proof gaps." },
    { type: "pricing", score: report.pricingScore, title: "Review price and inventory signal", reason: "Pricing score indicates price or inventory risk." },
    { type: "conversion", score: report.conversionScore, title: "Review conversion blockers", reason: "Conversion score shows combined buyer-confidence risk." }
  ].sort((a, b) => a.score - b.score);
  const weakest = scores[0];
  const priorityReasons = Array.isArray(actions.priorityReasons) ? actions.priorityReasons.slice(0, 5) : [];
  return {
    taskType: weakest.type,
    taskTitle: weakest.title,
    taskReason: `${weakest.reason} ${priorityReasons[0] ?? ""}`.trim(),
    evidenceJson: toJson({
      score: weakest.score,
      opportunityScore: report.opportunityScore,
      priority: report.overallPriority,
      riskLevel: report.riskLevel,
      priorityReasons,
      readOnly: true,
      requiresHumanApproval: true
    })
  };
}

export async function generateDailyOptimizationQueue(limit = 25) {
  const date = todayKey();
  const reports = await prisma.listingAiReport.findMany({
    include: { listing: true },
    orderBy: [{ opportunityScore: "desc" }, { conversionScore: "asc" }, { updatedAt: "desc" }]
  });
  const latestByListing = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    if (!latestByListing.has(report.listingId)) latestByListing.set(report.listingId, report);
  }

  const selected = Array.from(latestByListing.values())
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.conversionScore - b.conversionScore)
    .slice(0, limit);

  let generated = 0;
  for (const [index, report] of selected.entries()) {
    const task = queueTaskFromReport(report);
    await prisma.optimizationQueueItem.upsert({
      where: {
        queueDate_listingId_taskType: {
          queueDate: date,
          listingId: report.listingId,
          taskType: task.taskType
        }
      },
      update: {
        reportId: report.id,
        rank: index + 1,
        opportunityScore: report.opportunityScore,
        priority: report.overallPriority,
        riskLevel: report.riskLevel,
        taskTitle: task.taskTitle,
        taskReason: task.taskReason,
        evidenceJson: task.evidenceJson,
        status: "pending"
      },
      create: {
        queueDate: date,
        listingId: report.listingId,
        reportId: report.id,
        rank: index + 1,
        opportunityScore: report.opportunityScore,
        priority: report.overallPriority,
        riskLevel: report.riskLevel,
        taskType: task.taskType,
        taskTitle: task.taskTitle,
        taskReason: task.taskReason,
        evidenceJson: task.evidenceJson
      }
    });
    generated += 1;
  }

  return { queueDate: date, generated };
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
    ...(options.limit ? { take: options.limit } : {})
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

  const latestReports = await prisma.listingAiReport.findMany({
    where: { analysisVersion: LISTING_AI_ANALYSIS_VERSION },
    select: { listingId: true }
  });
  const totalReports = new Set(latestReports.map((report) => report.listingId)).size;
  const [snapshotCount, queue] = await Promise.all([
    prisma.listingAiSnapshot.count({ where: { analysisVersion: LISTING_AI_ANALYSIS_VERSION } }),
    generateDailyOptimizationQueue()
  ]);
  return {
    ok: errors.length === 0,
    analyzed,
    skipped,
    totalListings: listings.length,
    totalReports,
    snapshotCount,
    optimizationQueue: queue,
    remaining: Math.max(0, listings.length - analyzed - skipped),
    errors
  };
}
