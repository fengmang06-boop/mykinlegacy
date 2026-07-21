import { scoreListing } from "../src/lib/engines/listing-score-engine";
import { analyzeKeywords } from "../src/lib/engines/keyword-intelligence-engine";
import { generateRecommendations } from "../src/lib/engines/recommendation-engine";
import { scoreBestsellerPotential } from "../src/lib/engines/bestseller-potential-engine";
import { scoreThumbnail } from "../src/lib/engines/thumbnail-score-engine";
import { compareCompetitor } from "../src/lib/engines/competitor-comparison-engine";
import { assertEtsyReadOnlyRequest, validateEtsyReadOnlyEnv } from "../src/lib/integrations/etsy/read-only-guard";
import { checkEtsyEnv } from "../src/lib/integrations/etsy/env-check";
import { etsyScopes } from "../src/lib/integrations/etsy/scopes";
import { assertEtsyListingWriteGuard } from "../src/lib/integrations/etsy/write-guard";
import {
  listingBaselineTestUtils,
  validateBatchKey,
  validateListingIds
} from "../src/lib/integrations/etsy/listing-baseline";
import { calculateOpportunityScore } from "../src/lib/opportunity/opportunity-score";
import { runKeywordRadar } from "../src/lib/opportunity/keyword-radar";
import { runProductRadar } from "../src/lib/opportunity/product-radar";
import { runPromotionRadar } from "../src/lib/opportunity/promotion-radar";
import { createWinningProductReport } from "../src/lib/winning-product-lab/report";
import { prisma } from "../src/lib/prisma";

const testListing = {
  title: "Sterling Silver Skull Ring for Men Gothic Biker Gift",
  description:
    "A 925 sterling silver skull ring for men with dark gothic biker style, size guidance, handmade detail, gift-ready packaging, and care notes.",
  price: 128,
  quantity: 10,
  state: "active",
  tags: [
    "sterling skull",
    "silver skull ring",
    "skull ring men",
    "gothic ring men",
    "biker skull ring",
    "mens silver ring",
    "925 silver ring",
    "handmade ring",
    "gift for him",
    "halloween ring",
    "dark jewelry",
    "skull jewelry",
    "statement ring"
  ],
  materials: ["925 sterling silver"],
  productType: "skull ring",
  targetCustomer: "men, skull jewelry collectors, biker style buyers",
  images: [
    { url: "/mock/main.jpg", alt: "skull ring front", position: 1, role: "thumbnail" },
    { url: "/mock/scale.jpg", alt: "skull ring on hand", position: 2, role: "scale" },
    { url: "/mock/detail.jpg", alt: "skull ring detail", position: 3, role: "detail" }
  ]
};

async function runDatabaseTests() {
  const created = await prisma.syncLog.create({
    data: {
      source: "etsy_api",
      mode: "read_only",
      status: "test",
      message: "Test read-only sync log",
      itemCount: 0,
      listingsPulled: 0,
      startedAt: new Date(),
      finishedAt: new Date()
    }
  });
  const found = await prisma.syncLog.findUnique({ where: { id: created.id } });
  if (found?.source !== "etsy_api" || found.mode !== "read_only") {
    throw new Error("SyncLog did not record etsy_api read_only mode.");
  }
  const history = await prisma.opportunityHistory.upsert({
    where: { date: "test-date" },
    update: { topOpportunities: "{}", topActions: "[]" },
    create: { date: "test-date", topOpportunities: "{}", topActions: "[]" }
  });
  if (history.date !== "test-date") {
    throw new Error("OpportunityHistory did not save daily history.");
  }
  const winningHistory = await prisma.winningProductHistory.create({
    data: {
      date: "test-date",
      product: "Bull Terrier Ring",
      winningScore: 85,
      verdict: "Build",
      reason: "Test winning product history",
      report: "{}"
    }
  });
  if (winningHistory.product !== "Bull Terrier Ring") {
    throw new Error("WinningProductHistory did not save validation history.");
  }
}

async function main() {
  const validatedBaselineIds = validateListingIds(["1829235400", 4471142007, "1893979797"]);
  if (validatedBaselineIds.length !== 3 || validatedBaselineIds[1] !== "4471142007") {
    throw new Error("Generic listing baseline ID validation failed.");
  }
  for (const invalidIds of [["1", "2", "3", "4"], ["abc"], ["1", "1"]]) {
    let rejected = false;
    try {
      validateListingIds(invalidIds);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Generic listing baseline accepted invalid listing IDs.");
  }
  if (validateBatchKey("batch-3") !== "batch-3") {
    throw new Error("Generic listing baseline batch key validation failed.");
  }
  const apiBaseline = listingBaselineTestUtils.baselineFromApi(
    {
      listing_id: 1829235400,
      title: "Rabbit Pendant",
      tags: ["rabbit pendant"],
      state: "active",
      price: { amount: 12800, divisor: 100, currency_code: "USD" },
      quantity: 2,
      taxonomy_id: 123,
      shipping_profile_id: 456,
      updated_timestamp: 1234567890,
      images: [{ listing_image_id: 99, rank: 1 }],
      inventory: { products: [] }
    },
    "2026-07-21T00:00:00.000Z"
  );
  if (
    apiBaseline.baseline_source !== "etsy_api" ||
    apiBaseline.images[0]?.listing_image_id !== "99" ||
    apiBaseline.baseline_sha256.length !== 64
  ) {
    throw new Error("Generic listing baseline conversion or integrity hash failed.");
  }

  const score = scoreListing(testListing);
  const keywords = analyzeKeywords(testListing);
  const recommendations = generateRecommendations(testListing, score, keywords);
  const bestseller = scoreBestsellerPotential(testListing);
  const thumbnail = scoreThumbnail(testListing);
  const competitorReport = compareCompetitor({
    title: "Cheap Skull Ring Stainless Steel Biker Gift",
    price: 29,
    tags: ["skull ring", "biker ring"],
    description: "Cheap skull ring with cool look.",
    reviewCount: 40,
    imageNotes: "dark image, no scale, front view"
  });

  if (testListing.tags.some((tag) => tag.length > 20)) {
    throw new Error("Test listing has a tag over 20 characters.");
  }
  if (score.overallScore < 70) {
    throw new Error(`Expected healthy score, received ${score.overallScore}.`);
  }
  if (!keywords.primaryKeyword) {
    throw new Error("Keyword engine did not return a primary keyword.");
  }
  if (!recommendations.every((recommendation) => recommendation.requiresApproval)) {
    throw new Error("Every recommendation must require approval.");
  }
  if (bestseller.bestsellerPotentialScore < 70 || !["Build", "Improve", "Pause", "Kill"].includes(bestseller.verdict)) {
    throw new Error("Bestseller potential engine returned an invalid result.");
  }
  if (!thumbnail.thumbnailScore || !thumbnail.recommendedImageOrder.length) {
    throw new Error("Thumbnail score engine returned an invalid result.");
  }
  if (!competitorReport.includes("How MENSSKULL Can Beat It")) {
    throw new Error("Competitor comparison report is missing strategy output.");
  }

  const opportunityScore = calculateOpportunityScore({
    keyword: 88,
    competition: 70,
    giftPotential: 90,
    seasonality: 80,
    brandFit: 95,
    visualPotential: 82,
    aiSearchPotential: 77,
    pinterestPotential: 72,
    googlePotential: 68
  });
  if (opportunityScore.opportunityScore < 70) {
    throw new Error("Opportunity score engine returned a weak score for a strong input.");
  }

  const keywordRadar = runKeywordRadar([
    {
      title: testListing.title,
      description: testListing.description,
      tags: testListing.tags,
      productType: testListing.productType,
      targetCustomer: testListing.targetCustomer
    }
  ]);
  if (!keywordRadar.highOpportunityKeywords.length || !keywordRadar.highOpportunityKeywords[0].suggestedAction) {
    throw new Error("Keyword Radar did not return actionable keyword opportunities.");
  }

  const productRadar = runProductRadar([testListing]);
  if (!productRadar.length || !productRadar[0].recommendedProduct) {
    throw new Error("Product Radar did not return recommended new products.");
  }

  const promotionRadar = runPromotionRadar([
    {
      id: "test-listing",
      title: testListing.title,
      productType: testListing.productType,
      targetCustomer: testListing.targetCustomer,
      bestsellerScores: [{ bestsellerPotentialScore: bestseller.bestsellerPotentialScore }],
      scores: [{ overallScore: score.overallScore, ctrScore: score.ctrScore, conversionScore: score.conversionScore }]
    }
  ]);
  if (!promotionRadar.length || !promotionRadar[0].timeRequired) {
    throw new Error("Promotion Radar did not return daily promotion tasks.");
  }

  const winningReport = createWinningProductReport(
    {
      productName: "Bull Terrier Ring",
      category: "Ring",
      material: "925 sterling silver",
      style: "dog jewelry, gothic, handmade silver",
      targetCustomer: "bull terrier owners, dog lovers, gifts for him",
      estimatedPrice: 128,
      estimatedCost: 42,
      estimatedProductionTime: 14
    },
    {
      designCost: 120,
      prototypeCost: 180,
      castingCost: 260,
      photoCost: 120,
      advertisingCost: 100,
      expectedPrice: 128,
      expectedMargin: 62
    }
  );
  if (
    winningReport.validation.overallWinningScore < 70 ||
    !winningReport.collection.length ||
    !winningReport.marketGaps.length ||
    !winningReport.launchChecklist.some((item) => item.startsWith("Review Plan"))
  ) {
    throw new Error("Winning Product Lab did not generate a complete winning product report.");
  }

  process.env.ETSY_READ_ONLY_MODE = "true";
  let blockedWrite = false;
  try {
    assertEtsyReadOnlyRequest("POST");
  } catch {
    blockedWrite = true;
  }
  if (!blockedWrite) {
    throw new Error("Read-only guard did not block POST.");
  }
  if (!etsyScopes.includes("listings_w")) {
    throw new Error("Etsy OAuth scopes must include listings_w for approved listing writes.");
  }

  process.env.ETSY_READ_ONLY_MODE = "true";
  process.env.ETSY_WRITE_APPROVED = "true";
  let readOnlyWriteBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: { founderApproved: true, csoApproved: true, approvalReference: "test-approval" },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: 1 },
      diffs: [{ listingId: 1, fields: { title: { before: "Old", after: "New" } } }],
      listingsEditedToday: 0
    });
  } catch {
    readOnlyWriteBlocked = true;
  }
  if (!readOnlyWriteBlocked) {
    throw new Error("Write guard did not respect default read-only mode.");
  }

  process.env.ETSY_READ_ONLY_MODE = "false";
  process.env.ETSY_WRITE_APPROVED = "false";
  let approvalFlagBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: { founderApproved: true, csoApproved: true, approvalReference: "test-approval" },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: 1 },
      diffs: [{ listingId: 1, fields: { title: { before: "Old", after: "New" } } }],
      listingsEditedToday: 0
    });
  } catch {
    approvalFlagBlocked = true;
  }
  if (!approvalFlagBlocked) {
    throw new Error("Write guard did not require ETSY_WRITE_APPROVED=true.");
  }

  process.env.ETSY_WRITE_APPROVED = "true";
  let forbiddenFieldBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: { founderApproved: true, csoApproved: true, approvalReference: "test-approval" },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: 1 },
      diffs: [{ listingId: 1, fields: { title: { before: "Old", after: "New" } }, forbiddenFields: ["price"] }],
      listingsEditedToday: 0
    });
  } catch {
    forbiddenFieldBlocked = true;
  }
  if (!forbiddenFieldBlocked) {
    throw new Error("Write guard did not block forbidden fields.");
  }

  let maxDailyBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: { founderApproved: true, csoApproved: true, approvalReference: "test-approval" },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: 1 },
      diffs: [
        { listingId: 1, fields: { title: { before: "Old", after: "New" } } },
        { listingId: 2, fields: { tags: { before: ["old"], after: ["new"] } } },
        { listingId: 3, fields: { descriptionOpening: { before: "Old", after: "New" } } },
        { listingId: 4, fields: { title: { before: "Old", after: "New" } } }
      ],
      listingsEditedToday: 0
    });
  } catch {
    maxDailyBlocked = true;
  }
  if (!maxDailyBlocked) {
    throw new Error("Write guard did not enforce max 3 listings per day.");
  }

  const originalClientId = process.env.ETSY_CLIENT_ID;
  const originalClientSecret = process.env.ETSY_CLIENT_SECRET;
  const originalShopId = process.env.ETSY_SHOP_ID;
  const originalToken = process.env.ETSY_ACCESS_TOKEN;
  const originalRedirectUri = process.env.ETSY_REDIRECT_URI;
  const originalReadOnlyMode = process.env.ETSY_READ_ONLY_MODE;
  delete process.env.ETSY_CLIENT_ID;
  delete process.env.ETSY_SHOP_ID;
  delete process.env.ETSY_ACCESS_TOKEN;
  const envCheck = validateEtsyReadOnlyEnv();
  if (envCheck.ok || !envCheck.errors.some((error) => error.includes("ETSY_CLIENT_ID"))) {
    throw new Error("Missing Etsy env did not produce friendly errors.");
  }
  const connectionCheck = checkEtsyEnv();
  if (connectionCheck.readyForReadOnlySync || !connectionCheck.missingFields.includes("ETSY_CLIENT_ID")) {
    throw new Error("Etsy connection env check did not report missing fields.");
  }
  process.env.ETSY_CLIENT_ID = "test-client-id";
  process.env.ETSY_REDIRECT_URI = "http://localhost:3000/api/etsy/callback";
  const localhostRedirectCheck = checkEtsyEnv();
  if (
    localhostRedirectCheck.readyForOAuth ||
    !localhostRedirectCheck.warnings.some((warning) => warning.includes("Etsy no longer accepts localhost callback URLs"))
  ) {
    throw new Error("Etsy env check did not warn about localhost callback URLs.");
  }
  process.env.ETSY_CLIENT_SECRET = "test-client-secret";
  process.env.ETSY_REDIRECT_URI = "https://tools.mensskull.com/api/etsy/callback";
  process.env.ETSY_ACCESS_TOKEN = "test-access-token";
  process.env.ETSY_READ_ONLY_MODE = "true";
  delete process.env.ETSY_SHOP_ID;
  const autoShopIdCheck = checkEtsyEnv();
  if (!autoShopIdCheck.readyForReadOnlySync || autoShopIdCheck.missingFields.includes("ETSY_SHOP_ID")) {
    throw new Error("Etsy env check should allow read-only sync without manual ETSY_SHOP_ID.");
  }
  const readOnlyEnvWithoutShopId = validateEtsyReadOnlyEnv();
  if (!readOnlyEnvWithoutShopId.ok) {
    throw new Error("Read-only env guard should not require manual ETSY_SHOP_ID.");
  }
  if (originalClientId) process.env.ETSY_CLIENT_ID = originalClientId;
  else delete process.env.ETSY_CLIENT_ID;
  if (originalClientSecret) process.env.ETSY_CLIENT_SECRET = originalClientSecret;
  else delete process.env.ETSY_CLIENT_SECRET;
  if (originalShopId) process.env.ETSY_SHOP_ID = originalShopId;
  else delete process.env.ETSY_SHOP_ID;
  if (originalToken) process.env.ETSY_ACCESS_TOKEN = originalToken;
  else delete process.env.ETSY_ACCESS_TOKEN;
  if (originalRedirectUri) process.env.ETSY_REDIRECT_URI = originalRedirectUri;
  else delete process.env.ETSY_REDIRECT_URI;
  if (originalReadOnlyMode) process.env.ETSY_READ_ONLY_MODE = originalReadOnlyMode;
  else delete process.env.ETSY_READ_ONLY_MODE;
  delete process.env.ETSY_WRITE_APPROVED;

  await runDatabaseTests();
  console.log("Engine and read-only integration tests passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
