import {
  applyReadinessAdjustedRepairScore,
  hasVerifiedWriteRecord,
  independentlyReviewControlledRepair,
  validateControlledRepairProposal,
  type ControlledRepairCandidate
} from "../src/lib/integrations/etsy/controlled-autonomous-repair-v3";
import {
  assertEtsyListingWriteGuard,
  hashEtsyListingWriteDiffs
} from "../src/lib/integrations/etsy/write-guard";

const candidate: ControlledRepairCandidate = {
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
  baselineSha256: "9c20eb4e243b292021b3b01b789a8f46436a99bd4cae3f7941999d3170560e1a",
  baselineFresh: true,
  repairPriorityComponents: {
    technicalDefect: 26,
    titleTagRepairability: 20,
    commercialPotentialAndBrandFit: 16,
    changeSafety: 10,
    dataReliability: 8
  }
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const scoredCandidate = applyReadinessAdjustedRepairScore(candidate);
  assert(scoredCandidate.repairPriorityScore === 92, "Readiness evidence did not recalculate the priority score.");
  const validation = validateControlledRepairProposal(scoredCandidate);
  const review = independentlyReviewControlledRepair(scoredCandidate, validation);
  assert(validation.passed, validation.errors.join("; "));
  assert(review.zone === "green" && review.confidence >= 90, "Valid green candidate did not pass independent review.");

  process.env.ETSY_READ_ONLY_MODE = "false";
  process.env.ETSY_WRITE_APPROVED = "true";
  process.env.ETSY_CONTROLLED_AUTONOMOUS_REPAIR_V3 = "true";
  process.env.ETSY_STANDING_AUTHORIZATION = "true";
  const diffs = [validation.diff];
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
        listingId: scoredCandidate.listingId,
        exactDiffSha256: hashEtsyListingWriteDiffs(diffs),
        repairPriorityScore: scoredCandidate.repairPriorityScore,
        autoReviewConfidence: review.confidence,
        deterministicValidationPassed: validation.passed,
        independentReviewPassed: review.approvedForAutomaticExecution,
        oneTimeWindowId: "unit-test-window"
      }
    },
    dryRunDiffReviewed: true,
    rollbackBaseline: { listingId: candidate.listingId },
    diffs,
    listingsEditedToday: 0
  });

  const redCandidate = applyReadinessAdjustedRepairScore({ ...candidate, modifiedWithin30Days: true });
  const red = independentlyReviewControlledRepair(
    redCandidate,
    validateControlledRepairProposal(redCandidate)
  );
  assert(red.zone === "red" && !red.approvedForAutomaticExecution, "30-day cooldown was not enforced.");

  const yellowCandidate = { ...candidate, repairPriorityScore: 82, identifierReliable: false, repairPriorityComponents: undefined };
  const yellow = independentlyReviewControlledRepair(yellowCandidate, validateControlledRepairProposal(yellowCandidate));
  assert(yellow.zone === "yellow" && !yellow.approvedForAutomaticExecution, "Yellow review routing failed.");

  let hashMismatchBlocked = false;
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
          listingId: candidate.listingId,
          exactDiffSha256: "0".repeat(64),
          repairPriorityScore: scoredCandidate.repairPriorityScore,
          autoReviewConfidence: review.confidence,
          deterministicValidationPassed: true,
          independentReviewPassed: true,
          oneTimeWindowId: "unit-test-window"
        }
      },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: candidate.listingId },
      diffs,
      listingsEditedToday: 0
    });
  } catch {
    hashMismatchBlocked = true;
  }
  assert(hashMismatchBlocked, "Exact-diff hash mismatch was not blocked.");

  let descriptionBlocked = false;
  const descriptionDiff = [{
    listingId: candidate.listingId,
    fields: { descriptionOpening: { before: "Old", after: "New" } }
  }];
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
          listingId: candidate.listingId,
          exactDiffSha256: hashEtsyListingWriteDiffs(descriptionDiff),
          repairPriorityScore: scoredCandidate.repairPriorityScore,
          autoReviewConfidence: review.confidence,
          deterministicValidationPassed: true,
          independentReviewPassed: true,
          oneTimeWindowId: "description-test-window"
        }
      },
      dryRunDiffReviewed: true,
      rollbackBaseline: { listingId: candidate.listingId },
      diffs: descriptionDiff,
      listingsEditedToday: 0
    });
  } catch {
    descriptionBlocked = true;
  }
  assert(descriptionBlocked, "V3 standing authorization did not block description changes.");

  const staleCandidate = applyReadinessAdjustedRepairScore({ ...candidate, baselineFresh: false });
  const staleValidation = validateControlledRepairProposal(staleCandidate);
  assert(!staleValidation.passed, "A stale baseline was not blocked.");

  const mixedExecutionReport = {
    results: [{ listingId: "other-listing", status: "written", verified: true }],
    redCandidates: [{ listingId: candidate.listingId, reasons: ["cooldown"] }],
    yellowCandidates: [{ listingId: "another-listing" }]
  };
  assert(
    !hasVerifiedWriteRecord(mixedExecutionReport, candidate.listingId),
    "A red/yellow review mention was incorrectly treated as a verified write."
  );
  assert(
    hasVerifiedWriteRecord(
      { results: [{ listingId: candidate.listingId, status: "written", verified: true }] },
      candidate.listingId
    ),
    "A real verified write was not detected."
  );
  console.log("Controlled Autonomous Repair V3 safety tests passed.");
}

try {
  main();
} finally {
  process.env.ETSY_READ_ONLY_MODE = "true";
  process.env.ETSY_WRITE_APPROVED = "false";
  delete process.env.ETSY_CONTROLLED_AUTONOMOUS_REPAIR_V3;
  delete process.env.ETSY_STANDING_AUTHORIZATION;
}
