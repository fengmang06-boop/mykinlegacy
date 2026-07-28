import crypto from "node:crypto";
import { isReadOnlyMode } from "./read-only-guard";

export const etsyAllowedListingWriteFields = ["title", "tags", "descriptionOpening"] as const;

export const etsyForbiddenListingWriteFields = [
  "description",
  "price",
  "quantity",
  "inventory",
  "sku",
  "shipping",
  "shippingProfileId",
  "processingTime",
  "taxonomy",
  "taxonomyId",
  "category",
  "attributes",
  "images",
  "imageOrder",
  "videos",
  "ads",
  "discounts",
  "messages",
  "reviews",
  "customerInformation",
  "materials",
  "state",
  "whoMade",
  "whenMade",
  "isPersonalizable",
  "processingMin",
  "processingMax"
] as const;

export type EtsyAllowedListingWriteField = (typeof etsyAllowedListingWriteFields)[number];

export type EtsyListingWriteDiff = {
  listingId: string | number;
  fields: Partial<Record<EtsyAllowedListingWriteField, { before: unknown; after: unknown }>>;
  forbiddenFields?: string[];
};

export type EtsyWriteApproval = {
  founderApproved: boolean;
  csoApproved: boolean;
  approvalReference: string;
  standingAuthorization?: EtsyStandingAuthorization;
};

export type EtsyStandingAuthorization = {
  enabled: boolean;
  version: "V3";
  authorizationReference: string;
  candidateZone: "green";
  listingId: string;
  exactDiffSha256: string;
  repairPriorityScore: number;
  autoReviewConfidence: number;
  deterministicValidationPassed: boolean;
  independentReviewPassed: boolean;
  oneTimeWindowId: string;
};

export type EtsyListingWriteGuardInput = {
  approval: EtsyWriteApproval;
  dryRunDiffReviewed: boolean;
  rollbackBaseline: unknown;
  diffs: EtsyListingWriteDiff[];
  listingsEditedToday: number;
  maxListingsPerDay?: number;
};

export function isEtsyWriteApprovalFlagEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.ETSY_WRITE_APPROVED ?? "false").toLowerCase() === "true";
}

export function isControlledAutonomousRepairV3Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    String(env.ETSY_CONTROLLED_AUTONOMOUS_REPAIR_V3 ?? "false").toLowerCase() === "true" &&
    String(env.ETSY_STANDING_AUTHORIZATION ?? "false").toLowerCase() === "true"
  );
}

export function getEtsyWriteMaxListingsPerDay(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number.parseInt(env.ETSY_WRITE_MAX_LISTINGS_PER_DAY ?? "3", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 3;
}

export function hashEtsyListingWriteDiffs(diffs: EtsyListingWriteDiff[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(diffs)).digest("hex");
}

export function assertEtsyListingWriteGuard(
  input: EtsyListingWriteGuardInput,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (isReadOnlyMode()) {
    throw new Error("Blocked Etsy listing write because ETSY_READ_ONLY_MODE=true.");
  }
  if (!isEtsyWriteApprovalFlagEnabled(env)) {
    throw new Error("Blocked Etsy listing write because ETSY_WRITE_APPROVED is not true.");
  }
  const manualApprovalComplete =
    input.approval?.founderApproved &&
    input.approval?.csoApproved &&
    Boolean(input.approval.approvalReference);
  const standing = input.approval?.standingAuthorization;
  const standingApprovalComplete =
    isControlledAutonomousRepairV3Enabled(env) &&
    standing?.enabled === true &&
    standing.version === "V3" &&
    standing.candidateZone === "green" &&
    Boolean(standing.authorizationReference) &&
    Boolean(standing.oneTimeWindowId) &&
    standing.repairPriorityScore >= 85 &&
    standing.autoReviewConfidence >= 90 &&
    standing.deterministicValidationPassed &&
    standing.independentReviewPassed;

  if (!manualApprovalComplete && !standingApprovalComplete) {
    throw new Error("Blocked Etsy listing write because neither exact manual approval nor V3 standing authorization is valid.");
  }
  if (!input.dryRunDiffReviewed) {
    throw new Error("Blocked Etsy listing write because reviewed dry-run diff is required.");
  }
  if (!input.rollbackBaseline) {
    throw new Error("Blocked Etsy listing write because rollback baseline is required.");
  }
  if (!input.diffs.length) {
    throw new Error("Blocked Etsy listing write because no listing diffs were provided.");
  }

  const maxListingsPerDay = input.maxListingsPerDay ?? getEtsyWriteMaxListingsPerDay(env);
  const uniqueListingIds = new Set(input.diffs.map((diff) => String(diff.listingId)));
  if (uniqueListingIds.size > maxListingsPerDay || input.listingsEditedToday + uniqueListingIds.size > maxListingsPerDay) {
    throw new Error(`Blocked Etsy listing write because max ${maxListingsPerDay} listings per day is allowed.`);
  }

  if (standingApprovalComplete && standing) {
    if (input.diffs.length !== 1 || uniqueListingIds.size !== 1) {
      throw new Error("Blocked V3 standing authorization because each write window must contain exactly one listing.");
    }
    if (!uniqueListingIds.has(standing.listingId)) {
      throw new Error("Blocked V3 standing authorization because the listing ID is outside the one-time window.");
    }
    if (hashEtsyListingWriteDiffs(input.diffs) !== standing.exactDiffSha256) {
      throw new Error("Blocked V3 standing authorization because the exact diff hash does not match.");
    }
    const autonomousFields = new Set(["title", "tags"]);
    const unsupportedAutonomousFields = input.diffs.flatMap((diff) =>
      Object.keys(diff.fields).filter((field) => !autonomousFields.has(field))
    );
    if (unsupportedAutonomousFields.length) {
      throw new Error(
        `Blocked V3 standing authorization because automatic writes are limited to title/tags: ${unsupportedAutonomousFields.join(", ")}.`
      );
    }
  }

  const allowedFields = new Set<string>(etsyAllowedListingWriteFields);
  const forbiddenFields = new Set<string>(etsyForbiddenListingWriteFields);
  for (const diff of input.diffs) {
    const changedFields = Object.keys(diff.fields);
    const explicitlyForbiddenFields = diff.forbiddenFields ?? [];
    const invalidFields = changedFields.filter((field) => !allowedFields.has(field));
    const blockedFields = [...changedFields, ...explicitlyForbiddenFields].filter((field) => forbiddenFields.has(field));

    if (invalidFields.length) {
      throw new Error(`Blocked Etsy listing write because unsupported fields were requested: ${invalidFields.join(", ")}.`);
    }
    if (blockedFields.length) {
      throw new Error(`Blocked Etsy listing write because forbidden fields were requested: ${blockedFields.join(", ")}.`);
    }
  }
}
