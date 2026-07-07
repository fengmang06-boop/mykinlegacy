import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/json";

export const GROWTH_PLAN_BATCH_KEY = "phase-1-traffic-2026-07";

type TargetConfig = {
  productName: string;
  match: string[];
  proposedTitle: string;
  proposedTags: string[];
  imageRecommendations: string[];
  priority: "Critical" | "High" | "Medium";
  expectedImpact: string;
};

type ListingWithSignals = Awaited<ReturnType<typeof loadGrowthListings>>[number];

const TARGETS: TargetConfig[] = [
  {
    productName: "Custom Solid Brass Car Emblem",
    match: ["custom solid brass car emblem"],
    proposedTitle: "Custom Solid Brass Car Emblem - Engraved Vintage Vehicle Badge, 3M Auto Badge Gift",
    proposedTags: [
      "brass car emblem",
      "custom car badge",
      "engraved emblem",
      "vehicle badge",
      "vintage auto badge",
      "3m adhesive badge",
      "custom auto decor",
      "brass nameplate",
      "car gift for him",
      "motorcycle badge",
      "garage decor gift",
      "classic car badge",
      "personalized badge"
    ],
    imageRecommendations: [
      "Add an installed-on-car lifestyle image so buyers immediately understand scale and use.",
      "Add a close-up engraving image showing brass texture and edge quality.",
      "Add a scale reference image with hand or ruler.",
      "Add a back-side image showing 3M adhesive and mounting proof."
    ],
    priority: "Critical",
    expectedImpact: "High: existing sales and view signal are held back by weak product-type clarity and missing proof images."
  },
  {
    productName: "Hellboy Skull Ring",
    match: ["hellboy skull ring"],
    proposedTitle: "Hellboy Skull Ring in 925 Sterling Silver - Gothic Demon Biker Ring for Men",
    proposedTags: [
      "hellboy ring",
      "skull ring men",
      "gothic demon ring",
      "925 silver ring",
      "biker skull ring",
      "horror ring men",
      "sterling biker",
      "dark fantasy ring",
      "statement ring",
      "mens gothic ring",
      "comic style ring",
      "silver skull band",
      "gift for biker"
    ],
    imageRecommendations: [
      "Add one worn-on-hand image as the first proof of size and attitude.",
      "Add a macro close-up of the face carving and oxidized details.",
      "Add a packaging or gift-ready image.",
      "If possible, add a short rotation video for sculptural depth."
    ],
    priority: "Critical",
    expectedImpact: "High: strong favorites and sales indicate demand; tag coverage is the main discoverability leak."
  },
  {
    productName: "Bearded Skull Ring",
    match: ["bearded skull ring"],
    proposedTitle: "Bearded Skull Ring in 925 Sterling Silver - Handmade Gothic Biker Jewelry for Men",
    proposedTags: [
      "bearded skull ring",
      "skull ring men",
      "925 silver ring",
      "gothic biker ring",
      "mens skull jewelry",
      "handmade silver",
      "statement ring",
      "dark jewelry gift",
      "silver biker ring",
      "gothic mens ring",
      "skull band ring",
      "artisan ring",
      "gift for him"
    ],
    imageRecommendations: [
      "Keep current strong image set, then add packaging proof.",
      "Add a scale reference frame if not already obvious on mobile.",
      "Add one lifestyle image with leather or biker styling context."
    ],
    priority: "Critical",
    expectedImpact: "High: product has sales and strong image score; replacing weak tags can increase qualified search reach."
  },
  {
    productName: "Spiked Fishbone Wallet Chain",
    match: ["spiked fishbone wallet chain"],
    proposedTitle: "Spiked Fishbone Wallet Chain - Gothic Punk Biker Pants Chain, Stainless Steel Mens Chain",
    proposedTags: [
      "wallet chain",
      "pants chain",
      "biker chain",
      "punk wallet chain",
      "gothic chain",
      "fishbone chain",
      "stainless chain",
      "mens pants chain",
      "streetwear chain",
      "jeans chain",
      "rocker accessory",
      "gift for biker",
      "heavy wallet chain"
    ],
    imageRecommendations: [
      "Add a worn-with-jeans lifestyle image to make use case obvious.",
      "Add a close-up of clasp, spikes, and chain thickness.",
      "Add a full-length scale image.",
      "Add packaging proof for gift confidence."
    ],
    priority: "Critical",
    expectedImpact: "High: very strong favorite signal suggests traffic interest; title and proof images should reduce buyer hesitation."
  },
  {
    productName: "Sterling Silver Skull Ring for Men",
    match: ["sterling silver skull ring for men", "gothic biker custom size ring"],
    proposedTitle: "Sterling Silver Skull Ring for Men - Gothic Biker Ring, Custom Size 925 Silver Jewelry",
    proposedTags: [
      "skull ring men",
      "sterling ring",
      "gothic biker ring",
      "custom size ring",
      "925 silver ring",
      "mens skull ring",
      "biker jewelry",
      "silver skull band",
      "dark mens ring",
      "statement ring",
      "gift for him",
      "rocker ring",
      "handmade ring"
    ],
    imageRecommendations: [
      "Add more Etsy image frames; target 8-10 total.",
      "Add a worn-on-hand image near the top of the gallery.",
      "Add macro detail and scale proof.",
      "Add a sizing or custom-size visual."
    ],
    priority: "High",
    expectedImpact: "High: proven sales, views, and favorites; image proof is the clearest conversion lift."
  },
  {
    productName: "Heavy Skull Ring for Men",
    match: ["heavy skull ring for men", "solid 925 silver gothic biker ring"],
    proposedTitle: "Heavy Skull Ring for Men - Solid 925 Sterling Silver Gothic Biker Statement Ring",
    proposedTags: [
      "heavy skull ring",
      "skull ring men",
      "925 silver ring",
      "gothic biker ring",
      "solid silver ring",
      "mens biker ring",
      "statement ring",
      "silver skull ring",
      "dark jewelry",
      "rocker ring",
      "gift for him",
      "handmade ring",
      "gothic mens ring"
    ],
    imageRecommendations: [
      "Add a stronger scale reference to justify the word heavy.",
      "Add close-up texture and side-profile images.",
      "Add lifestyle image with hand, leather, or motorcycle styling.",
      "Add packaging image to support gift purchases."
    ],
    priority: "High",
    expectedImpact: "High: this is already a sales winner; image proof can improve conversion without changing the core offer."
  },
  {
    productName: "Gothic Key Necklace",
    match: ["gothic key necklace"],
    proposedTitle: "Sterling Silver Gothic Key Necklace - Oxidized 24 Inch Unisex Pendant, Dark Jewelry Gift",
    proposedTags: [
      "gothic necklace",
      "key necklace",
      "silver key pendant",
      "oxidized silver",
      "24 inch necklace",
      "unisex pendant",
      "dark jewelry",
      "gothic gift",
      "sterling pendant",
      "mens necklace",
      "symbol necklace",
      "silver talisman",
      "gift for him"
    ],
    imageRecommendations: [
      "Avoid large title changes; protect the current sales momentum.",
      "Add scale-on-neck image and chain length proof.",
      "Add close-up of oxidation and pendant texture.",
      "Add packaging image for gift shoppers."
    ],
    priority: "High",
    expectedImpact: "Medium-high: very strong historical signal; small image and tag gains are safer than aggressive repositioning."
  },
  {
    productName: "Amenadiel Angel Pendant",
    match: ["amenadiel angel pendant"],
    proposedTitle: "Amenadiel Angel Pendant Necklace - 925 Silver Gothic Archangel Talisman Jewelry",
    proposedTags: [
      "angel pendant",
      "archangel necklace",
      "gothic necklace",
      "925 silver pendant",
      "talisman jewelry",
      "mens necklace",
      "dark angel gift",
      "silver necklace",
      "fantasy pendant",
      "gothic talisman",
      "unisex necklace",
      "gift for him",
      "statement pendant"
    ],
    imageRecommendations: [
      "Preserve current positioning; it already has strong sales.",
      "Add a scale-on-neck or worn image.",
      "Add close-up detail of wings or pendant face.",
      "Add packaging proof."
    ],
    priority: "High",
    expectedImpact: "Medium-high: strong demand exists; visual proof updates should lift conversion with low SEO risk."
  },
  {
    productName: "Gothic Cross Pants Chain",
    match: ["gothic cross pants chain"],
    proposedTitle: "Gothic Cross Pants Chain - Titanium Steel Punk Wallet Chain for Men, Biker Jeans Chain",
    proposedTags: [
      "pants chain",
      "wallet chain",
      "gothic chain",
      "cross chain",
      "punk chain",
      "biker chain",
      "jeans chain men",
      "titanium steel",
      "mens accessory",
      "rocker chain",
      "streetwear chain",
      "gift for biker",
      "gothic accessory"
    ],
    imageRecommendations: [
      "Add a full outfit image showing the chain on pants.",
      "Add clasp and cross-detail close-up.",
      "Add scale/full-length image.",
      "Add packaging or gift proof."
    ],
    priority: "High",
    expectedImpact: "High: SEO score is low but the listing already has a sale; title clarity can unlock more relevant search traffic."
  },
  {
    productName: "Black Mamba Snake Ring",
    match: ["black mamba snake ring"],
    proposedTitle: "Black Mamba Snake Ring - 925 Sterling Silver Reptile Ring for Men, Gothic Serpent Jewelry",
    proposedTags: [
      "snake ring men",
      "black mamba ring",
      "serpent ring",
      "925 silver ring",
      "gothic snake ring",
      "reptile jewelry",
      "mens silver ring",
      "biker ring",
      "statement ring",
      "dark jewelry",
      "gift for him",
      "silver serpent",
      "handmade ring"
    ],
    imageRecommendations: [
      "Add more images; current image score indicates proof gaps.",
      "Add macro head/detail shot and side profile.",
      "Add worn-on-hand scale image.",
      "Add packaging image or short rotation video."
    ],
    priority: "High",
    expectedImpact: "High: sales and favorite signal exist, but image score is low enough to create conversion drag."
  }
];

export const GROWTH_PLAN_PRODUCT_ORDER = TARGETS.map((target) => target.productName);

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function parseJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function numberFrom(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function loadGrowthListings() {
  return prisma.listing.findMany({
    include: {
      images: true,
      inventory: true,
      aiReports: {
        where: { analysisVersion: "listing-intelligence-v2" },
        orderBy: { updatedAt: "desc" },
        take: 1
      }
    }
  });
}

function findTargetListing(listings: ListingWithSignals[], target: TargetConfig) {
  return listings.find((listing) => {
    const title = listing.title.toLowerCase();
    return target.match.some((term) => title.includes(term));
  });
}

function listingSignals(listing: ListingWithSignals, transactions: Array<{ etsyListingId: string | null; quantity: number; price: number | null }>) {
  const raw = parseJson(listing.rawJson);
  const views = numberFrom(raw.views ?? raw.views_count);
  const favorites = numberFrom(raw.num_favorers ?? raw.favorers);
  const rows = transactions.filter((transaction) => transaction.etsyListingId === listing.etsyListingId);
  const orders = rows.length;
  const revenue = rows.reduce((sum, transaction) => sum + (transaction.price ?? listing.price) * Math.max(transaction.quantity, 1), 0);
  return {
    views: Math.round(views),
    favorites: Math.round(favorites),
    orders,
    revenue: Math.round(revenue * 100) / 100,
    conversionRate: views > 0 ? Math.round((orders / views) * 10000) / 100 : 0
  };
}

function reportIssues(listing: ListingWithSignals, target: TargetConfig) {
  const report = listing.aiReports[0];
  const actions = parseJson(report?.recommendedActions);
  const priorityReasons = Array.isArray(actions.priorityReasons) ? actions.priorityReasons.map(String) : [];
  const imageSuggestions = Array.isArray((actions.images as { suggestions?: unknown[] } | undefined)?.suggestions)
    ? ((actions.images as { suggestions: unknown[] }).suggestions).map(String)
    : [];
  const titleWeaknesses = Array.isArray((actions.title as { weaknesses?: unknown[] } | undefined)?.weaknesses)
    ? ((actions.title as { weaknesses: unknown[] }).weaknesses).map(String)
    : [];
  const tagOpportunities = Array.isArray((actions.tags as { unusedKeywordOpportunities?: unknown[] } | undefined)?.unusedKeywordOpportunities)
    ? ((actions.tags as { unusedKeywordOpportunities: unknown[] }).unusedKeywordOpportunities).map((term) => `Missing keyword opportunity: ${String(term)}.`)
    : [];
  const scoreIssues = report
    ? [
        report.titleScore < 80 ? `Title score is ${report.titleScore}, so the first searchable phrase needs more buyer clarity.` : "",
        report.tagScore < 80 ? `Tag score is ${report.tagScore}, leaving long-tail search coverage on the table.` : "",
        report.imageScore < 78 ? `Image score is ${report.imageScore}, which can reduce click trust and conversion from mobile shoppers.` : "",
        report.conversionScore < 80 ? `Conversion score is ${report.conversionScore}, so traffic may not turn into orders efficiently.` : ""
      ].filter(Boolean)
    : [];

  return {
    currentProblems: Array.from(new Set([...scoreIssues, ...priorityReasons, ...titleWeaknesses, ...tagOpportunities, ...imageSuggestions])).slice(0, 8),
    trafficImpactReason:
      report && report.seoScore < 80
        ? "Weak title or tag coverage can reduce matched Etsy search impressions and lower click relevance."
        : report && report.imageScore < 78
          ? "Image proof gaps reduce buyer trust after the click, so useful traffic leaks before checkout."
          : `This listing has enough signal to justify careful optimization, but changes should stay draft-only because ${target.expectedImpact.toLowerCase()}`
  };
}

export async function ensureGrowthPlanTracking() {
  const [listings, transactions] = await Promise.all([
    loadGrowthListings(),
    prisma.etsyTransaction.findMany({ select: { etsyListingId: true, quantity: true, price: true } })
  ]);
  const date = todayKey();
  const created: string[] = [];
  const missing: string[] = [];

  for (const target of TARGETS) {
    const listing = findTargetListing(listings, target);
    if (!listing) {
      missing.push(target.productName);
      continue;
    }
    const signals = listingSignals(listing, transactions);
    const issues = reportIssues(listing, target);
    const report = listing.aiReports[0];
    const plan = await prisma.etsyGrowthPlan.upsert({
      where: {
        batchKey_listingId: {
          batchKey: GROWTH_PLAN_BATCH_KEY,
          listingId: listing.id
        }
      },
      update: {
        productName: target.productName,
        currentTitle: listing.title,
        currentIssues: toJson(issues.currentProblems),
        trafficImpactReason: issues.trafficImpactReason,
        proposedTitle: target.proposedTitle,
        proposedTags: toJson(target.proposedTags),
        imageRecommendations: toJson(target.imageRecommendations),
        priority: target.priority,
        expectedImpact: target.expectedImpact
      },
      create: {
        listingId: listing.id,
        batchKey: GROWTH_PLAN_BATCH_KEY,
        productName: target.productName,
        currentTitle: listing.title,
        currentIssues: toJson(issues.currentProblems),
        trafficImpactReason: issues.trafficImpactReason,
        proposedTitle: target.proposedTitle,
        proposedTags: toJson(target.proposedTags),
        imageRecommendations: toJson(target.imageRecommendations),
        priority: target.priority,
        expectedImpact: target.expectedImpact
      }
    });

    await prisma.etsyGrowthBaseline.upsert({
      where: { planId: plan.id },
      update: {},
      create: {
        planId: plan.id,
        listingId: listing.id,
        baselineDate: date,
        ...signals,
        snapshotJson: toJson({
          listing: {
            etsyListingId: listing.etsyListingId,
            title: listing.title,
            price: listing.price,
            quantity: listing.inventory?.quantity ?? listing.quantity,
            imageCount: listing.images.length
          },
          scores: report
            ? {
                seo: report.seoScore,
                title: report.titleScore,
                tags: report.tagScore,
                images: report.imageScore,
                conversion: report.conversionScore,
                pricing: report.pricingScore,
                opportunity: report.opportunityScore
              }
            : null,
          signals,
          readOnly: true
        })
      }
    });

    await prisma.etsyGrowthDailyTracking.upsert({
      where: {
        listingId_trackingDate: {
          listingId: listing.id,
          trackingDate: date
        }
      },
      update: {
        planId: plan.id,
        ...signals
      },
      create: {
        planId: plan.id,
        listingId: listing.id,
        trackingDate: date,
        ...signals
      }
    });
    created.push(target.productName);
  }

  return {
    ok: missing.length === 0,
    batchKey: GROWTH_PLAN_BATCH_KEY,
    generated: created.length,
    missing,
    trackingDate: date
  };
}

export async function getGrowthPlanDashboard() {
  await ensureGrowthPlanTracking();
  return prisma.etsyGrowthPlan.findMany({
    where: { batchKey: GROWTH_PLAN_BATCH_KEY },
    include: {
      listing: {
        include: {
          images: true,
          inventory: true,
          aiReports: {
            where: { analysisVersion: "listing-intelligence-v2" },
            orderBy: { updatedAt: "desc" },
            take: 1
          }
        }
      },
      baseline: true,
      dailyTrackings: { orderBy: { trackingDate: "asc" } }
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "asc" }]
  });
}

export function parsePlanList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
