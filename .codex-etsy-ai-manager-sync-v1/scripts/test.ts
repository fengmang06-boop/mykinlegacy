import { scoreListing } from "../src/lib/engines/listing-score-engine";
import { analyzeKeywords } from "../src/lib/engines/keyword-intelligence-engine";
import { generateRecommendations } from "../src/lib/engines/recommendation-engine";
import { scoreBestsellerPotential } from "../src/lib/engines/bestseller-potential-engine";
import { scoreThumbnail } from "../src/lib/engines/thumbnail-score-engine";
import { compareCompetitor } from "../src/lib/engines/competitor-comparison-engine";
import { assertEtsyReadOnlyRequest, validateEtsyReadOnlyEnv } from "../src/lib/integrations/etsy/read-only-guard";
import { checkEtsyEnv } from "../src/lib/integrations/etsy/env-check";
import { etsyScopes } from "../src/lib/integrations/etsy/scopes";
import {
  assertEtsyListingWriteGuard,
  hashEtsyListingWriteDiffs
} from "../src/lib/integrations/etsy/write-guard";
import {
  independentlyReviewControlledRepair,
  validateControlledRepairProposal,
  type ControlledRepairCandidate
} from "../src/lib/integrations/etsy/controlled-autonomous-repair-v3";
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
  process.env.MENSSKULL_KEYWORD_BANK_PATH = "scripts/fixtures/mensskull-keyword-bank.md";
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

  const v3Candidate: ControlledRepairCandidate = {
    listingId: "4516749377",
    product: "Meteor Hammer Pants Chain",
    sku: "SSG03",
    currentTitle: "Meteor Hammer Pants Chain - Titanium Steel Punk Wallet Chain for Men",
    currentTags: [
      "pants chain", "wallet chain", "punk chain", "biker chain men", "titanium steel",
      "meteor chain", "trouser chain", "streetwear chain", "gothic chain",
      "y2k wallet chain", "punk accessory", "mens chain", "metal chain"
    ],
    proposedTitle: "Meteor Hammer Pants Chain in Titanium Steel, Punk Wallet Chain for Men, Gothic Streetwear Accessory",
    proposedTags: [
      "meteor hammer chain", "meteor pants chain", "titanium steel chain", "punk wallet chain",
      "mens pants chain", "biker wallet chain", "gothic pants chain", "trouser chain",
      "streetwear chain", "y2k wallet chain", "metal waist chain", "punk accessory", "gift for biker"
    ],
    searchIntent: "titanium steel Meteor Hammer pants and wallet chain",
    evidence: ["Unique product phrase is underused.", "Generic chain synonyms consume most live tags."],
    repairPriorityScore: 86,
    state: "active",
    orders: 0,
    views: 165,
    favorites: 16,
    stableSeller: false,
    modifiedWithin30Days: false,
    activeExperiment: false,
    materialConfirmed: true,
    productTypeConfirmed: true,
    structureConfirmed: true,
    ipRisk: false,
    authenticityRisk: false,
    requiresOtherFieldChanges: false,
    independentSearchAngle: true,
    identifierReliable: true,
    rollbackReady: true,
    baselineSha256: "9c20eb4e243b292021b3b01b789a8f46436a99bd4cae3f7941999d3170560e1a"
  };
  const v3Validation = validateControlledRepairProposal(v3Candidate);
  const v3Review = independentlyReviewControlledRepair(v3Candidate, v3Validation);
  if (!v3Validation.passed || v3Review.zone !== "green" || v3Review.confidence < 90) {
    throw new Error("V3 did not approve a complete low-risk green candidate.");
  }

  process.env.ETSY_CONTROLLED_AUTONOMOUS_REPAIR_V3 = "true";
  process.env.ETSY_STANDING_AUTHORIZATION = "true";
  const v3Diffs = [v3Validation.diff];
  assertEtsyListingWriteGuard({
    approval: {
      founderApproved: false,
      csoApproved: false,
      approvalReference: "",
      standingAuthorization: {
        enabled: true,
        version: "V3",
        authorizationReference: "founder-standing-authorization-v3",
        candidateZone: "green",
        listingId: v3Candidate.listingId,
        exactDiffSha256: hashEtsyListingWriteDiffs(v3Diffs),
        repairPriorityScore: v3Candidate.repairPriorityScore,
        autoReviewConfidence: v3Review.confidence,
        deterministicValidationPassed: v3Validation.passed,
        independentReviewPassed: v3Review.approvedForAutomaticExecution,
        oneTimeWindowId: "test-one-time-window"
      }
    },
    dryRunDiffReviewed: true,
    rollbackBaseline: { listingId: v3Candidate.listingId },
    diffs: v3Diffs,
    listingsEditedToday: 0
  });

  let v3HashMismatchBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: {
        founderApproved: false,
        csoApproved: false,
        approvalReference: "",
        standingAuthorization: {
          enabled: true,
          version: "V3",
          authorizationReference: "founder-standing-authorization-v3",
          candidateZone: "green",
          listingId: v3Candidate.listingId,
          exactDiffSha256: "0".repeat(64),
          repairPriorityScore: v3Candidate.repairPriorityScore,
          autoReviewConfidence: v3Review.confidence,
          deterministicValidationPassed: true,
          independentReviewPassed: true,
          oneTimeWindowId: "test-one-time-window"
        }
      },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: v3Candidate.listingId },
      diffs: v3Diffs,
      listingsEditedToday: 0
    });
  } catch {
    v3HashMismatchBlocked = true;
  }
  if (!v3HashMismatchBlocked) throw new Error("V3 standing authorization did not bind the exact diff hash.");

  const redCandidate = { ...v3Candidate, modifiedWithin30Days: true };
  const redReview = independentlyReviewControlledRepair(redCandidate, validateControlledRepairProposal(redCandidate));
  if (redReview.zone !== "red" || redReview.approvedForAutomaticExecution) {
    throw new Error("V3 did not block a listing modified within 30 days.");
  }

  const yellowCandidate = { ...v3Candidate, repairPriorityScore: 82, identifierReliable: false };
  const yellowReview = independentlyReviewControlledRepair(yellowCandidate, validateControlledRepairProposal(yellowCandidate));
  if (yellowReview.zone !== "yellow" || yellowReview.approvedForAutomaticExecution) {
    throw new Error("V3 did not route a low-score identifier conflict to yellow review.");
  }

  const descriptionDiff = [{
    listingId: v3Candidate.listingId,
    fields: { descriptionOpening: { before: "Old", after: "New" } }
  }];
  let v3DescriptionBlocked = false;
  try {
    assertEtsyListingWriteGuard({
      approval: {
        founderApproved: false,
        csoApproved: false,
        approvalReference: "",
        standingAuthorization: {
          enabled: true,
          version: "V3",
          authorizationReference: "founder-standing-authorization-v3",
          candidateZone: "green",
          listingId: v3Candidate.listingId,
          exactDiffSha256: hashEtsyListingWriteDiffs(descriptionDiff),
          repairPriorityScore: v3Candidate.repairPriorityScore,
          autoReviewConfidence: v3Review.confidence,
          deterministicValidationPassed: true,
          independentReviewPassed: true,
          oneTimeWindowId: "test-description-window"
        }
      },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: v3Candidate.listingId },
      diffs: descriptionDiff,
      listingsEditedToday: 0
    });
  } catch {
    v3DescriptionBlocked = true;
  }
  if (!v3DescriptionBlocked) throw new Error("V3 write guard did not forbid description changes.");
  delete process.env.ETSY_CONTROLLED_AUTONOMOUS_REPAIR_V3;
  delete process.env.ETSY_STANDING_AUTHORIZATION;

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
  delete process.env.MENSSKULL_KEYWORD_BANK_PATH;

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
