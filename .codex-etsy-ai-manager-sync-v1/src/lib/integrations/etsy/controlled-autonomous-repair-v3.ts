import type { EtsyListingWriteDiff } from "./write-guard";

export const CONTROLLED_REPAIR_VERSION = "V3" as const;
export const MIN_REPAIR_PRIORITY_SCORE = 85;
export const MIN_AUTO_REVIEW_CONFIDENCE = 90;
export const MAX_AUTONOMOUS_WRITES_PER_DAY = 3;

export type ControlledRepairCandidate = {
  listingId: string;
  product: string;
  sku: string | null;
  currentTitle: string;
  currentTags: string[];
  proposedTitle: string;
  proposedTags: string[];
  searchIntent: string;
  evidence: string[];
  repairPriorityScore: number;
  state: string;
  orders: number;
  views: number;
  favorites: number;
  stableSeller: boolean;
  modifiedWithin30Days: boolean;
  activeExperiment: boolean;
  materialConfirmed: boolean;
  productTypeConfirmed: boolean;
  structureConfirmed: boolean;
  ipRisk: boolean;
  authenticityRisk: boolean;
  requiresOtherFieldChanges: boolean;
  independentSearchAngle: boolean;
  identifierReliable: boolean;
  rollbackReady: boolean;
  baselineSha256: string;
};

export type DeterministicValidation = {
  passed: boolean;
  errors: string[];
  warnings: string[];
  diff: EtsyListingWriteDiff;
};

export type IndependentAutoReview = {
  zone: "green" | "yellow" | "red";
  confidence: number;
  approvedForAutomaticExecution: boolean;
  reasons: string[];
};

const IP_TERMS = [
  "harley",
  "jeep",
  "wrangler",
  "3m",
  "hellboy",
  "amenadiel",
  "lucifer",
  "disney",
  "marvel",
  "dc comics"
];

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function meaningfulTitle(title: string): boolean {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words.length >= 5 && /[a-z]/i.test(title);
}

function containsIpRisk(values: string[]): string[] {
  const text = values.join(" ").toLowerCase();
  return IP_TERMS.filter((term) => text.includes(term));
}

export function validateControlledRepairProposal(candidate: ControlledRepairCandidate): DeterministicValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedTags = candidate.proposedTags.map(normalized);

  if (!/^\d+$/.test(candidate.listingId)) errors.push("Listing ID must contain digits only.");
  if (!candidate.proposedTitle.trim() || candidate.proposedTitle.length > 140) {
    errors.push(`Title length must be between 1 and 140 characters; received ${candidate.proposedTitle.length}.`);
  }
  if (!meaningfulTitle(candidate.proposedTitle)) errors.push("Title is not naturally descriptive.");
  if (candidate.proposedTags.length !== 13) errors.push(`Exactly 13 tags are required; received ${candidate.proposedTags.length}.`);
  if (new Set(normalizedTags).size !== normalizedTags.length) errors.push("Tags must be unique after normalization.");

  const overLength = candidate.proposedTags.filter((tag) => tag.length > 20);
  if (overLength.length) errors.push(`Tags exceed 20 characters: ${overLength.join(", ")}.`);
  if (candidate.proposedTags.some((tag) => !tag.trim())) errors.push("Empty tags are not allowed.");

  const ipTerms = containsIpRisk([candidate.proposedTitle, ...candidate.proposedTags]);
  if (ipTerms.length || candidate.ipRisk) errors.push(`Trademark or copyright risk detected: ${ipTerms.join(", ") || "candidate flag"}.`);
  if (candidate.authenticityRisk) errors.push("Authenticity risk is unresolved.");
  if (!candidate.materialConfirmed) errors.push("Material is not confirmed.");
  if (!candidate.productTypeConfirmed) errors.push("Product type is not confirmed.");
  if (!candidate.structureConfirmed) errors.push("Product structure is not confirmed.");
  if (!candidate.independentSearchAngle) errors.push("A truthful independent search angle is not established.");
  if (candidate.requiresOtherFieldChanges) errors.push("The primary problem requires changes outside title/tags.");
  if (!candidate.identifierReliable) errors.push("Listing identifier or SKU mapping is unreliable.");
  if (!candidate.rollbackReady || !/^[a-f0-9]{64}$/i.test(candidate.baselineSha256)) {
    errors.push("Complete rollback baseline and valid SHA-256 are required.");
  }
  if (candidate.repairPriorityScore < MIN_REPAIR_PRIORITY_SCORE) {
    warnings.push(`Repair Priority Score ${candidate.repairPriorityScore} is below ${MIN_REPAIR_PRIORITY_SCORE}.`);
  }

  const diff: EtsyListingWriteDiff = {
    listingId: candidate.listingId,
    fields: {
      title: { before: candidate.currentTitle, after: candidate.proposedTitle },
      tags: { before: candidate.currentTags, after: candidate.proposedTags }
    }
  };

  return { passed: errors.length === 0, errors, warnings, diff };
}

export function independentlyReviewControlledRepair(
  candidate: ControlledRepairCandidate,
  validation: DeterministicValidation
): IndependentAutoReview {
  const redReasons: string[] = [];
  const yellowReasons: string[] = [];

  if (candidate.state !== "active") redReasons.push(`Listing state is ${candidate.state}.`);
  if (candidate.stableSeller) redReasons.push("Listing is a stable seller or protected winner.");
  if (candidate.modifiedWithin30Days) redReasons.push("Title/tags or listing state changed within 30 days.");
  if (candidate.activeExperiment) redReasons.push("Listing is inside an active D1/D3/D7/D14 experiment.");
  if (candidate.ipRisk || candidate.authenticityRisk) redReasons.push("IP or authenticity risk is unresolved.");

  if (candidate.orders >= 1) yellowReasons.push(`Listing has ${candidate.orders} recorded order(s).`);
  if (candidate.views >= 500) yellowReasons.push(`Listing has ${candidate.views} views.`);
  if (candidate.favorites >= 30) yellowReasons.push(`Listing has ${candidate.favorites} favorites.`);
  if (!candidate.materialConfirmed || !candidate.productTypeConfirmed || !candidate.structureConfirmed) {
    yellowReasons.push("Product facts are incomplete or conflicting.");
  }
  if (candidate.requiresOtherFieldChanges) yellowReasons.push("The main problem is not title/tags-only.");
  if (!candidate.identifierReliable) yellowReasons.push("Identifier mapping is not reliable.");
  if (!candidate.independentSearchAngle) yellowReasons.push("Independent search positioning is not proven.");
  if (!validation.passed) yellowReasons.push(...validation.errors);
  if (candidate.repairPriorityScore < MIN_REPAIR_PRIORITY_SCORE) {
    yellowReasons.push(`Repair Priority Score is below ${MIN_REPAIR_PRIORITY_SCORE}.`);
  }

  const completenessChecks = [
    validation.passed,
    candidate.state === "active",
    candidate.orders === 0,
    !candidate.stableSeller,
    !candidate.modifiedWithin30Days,
    !candidate.activeExperiment,
    candidate.materialConfirmed,
    candidate.productTypeConfirmed,
    candidate.structureConfirmed,
    !candidate.ipRisk,
    !candidate.authenticityRisk,
    !candidate.requiresOtherFieldChanges,
    candidate.independentSearchAngle,
    candidate.identifierReliable,
    candidate.rollbackReady,
    candidate.evidence.length >= 2,
    candidate.searchIntent.trim().length >= 10,
    candidate.currentTitle !== candidate.proposedTitle,
    JSON.stringify(candidate.currentTags.map(normalized)) !== JSON.stringify(candidate.proposedTags.map(normalized))
  ];
  const confidence = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  if (redReasons.length) {
    return { zone: "red", confidence, approvedForAutomaticExecution: false, reasons: redReasons };
  }
  if (yellowReasons.length || confidence < MIN_AUTO_REVIEW_CONFIDENCE) {
    return {
      zone: "yellow",
      confidence,
      approvedForAutomaticExecution: false,
      reasons: yellowReasons.length ? yellowReasons : [`Auto Review Confidence ${confidence} is below ${MIN_AUTO_REVIEW_CONFIDENCE}.`]
    };
  }
  return {
    zone: "green",
    confidence,
    approvedForAutomaticExecution: true,
    reasons: [
      "Product facts and identifiers are confirmed.",
      "The defect is limited to title/tags and the search angle remains truthful.",
      "No winner, cooldown, experiment, IP, authenticity, or cross-field risk was found."
    ]
  };
}
