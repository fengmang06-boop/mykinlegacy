import { isReadOnlyMode } from "./read-only-guard";

export const etsyAllowedListingWriteFields = ["title", "tags", "descriptionOpening"] as const;

export const etsyForbiddenListingWriteFields = [
  "price",
  "quantity",
  "inventory",
  "shipping",
  "shippingProfileId",
  "taxonomy",
  "taxonomyId",
  "category",
  "images",
  "imageOrder",
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

export function getEtsyWriteMaxListingsPerDay(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number.parseInt(env.ETSY_WRITE_MAX_LISTINGS_PER_DAY ?? "3", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 3;
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
  if (!input.approval?.founderApproved || !input.approval?.csoApproved || !input.approval.approvalReference) {
    throw new Error("Blocked Etsy listing write because Founder/CSO approval is incomplete.");
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
