import { createContractMetadata } from "./defaults";
import type {
  ChangedHouseDnaField,
  HouseDNA,
  HouseDnaVersionedField,
  IdentityVersion,
  IdentityVersionReason
} from "./types";

export const VERSIONED_HOUSE_DNA_FIELDS: HouseDnaVersionedField[] = [
  "house_name",
  "surname",
  "origin_country",
  "heritage_regions",
  "family_values",
  "guardian_animals",
  "symbols",
  "colors",
  "motto",
  "visual_style",
  "story_theme",
  "cultural_references",
  "forbidden_elements",
  "preferred_elements"
];

export const MEMORY_ONLY_EVENTS = [
  "asset_saved",
  "asset_downloaded",
  "output_failed",
  "recommendation_clicked",
  "style_disliked_after_generation"
] as const;

export interface CreateIdentityVersionOptions {
  source?: string;
  timestamp?: Date;
  generated_from_order_id?: string | null;
  generated_from_interview_id?: string | null;
  generated_from_admin_edit?: boolean;
  version_reason?: IdentityVersionReason;
}

export function createInitialIdentityVersion(
  houseId: string,
  identityId: string,
  houseDna: HouseDNA,
  options: CreateIdentityVersionOptions = {}
): IdentityVersion {
  return {
    ...createContractMetadata(options.source ?? "identity_version_logic", options.timestamp),
    house_id: houseId,
    identity_id: identityId,
    identity_version: 1,
    version_reason: options.version_reason ?? "initial_create",
    previous_version_id: null,
    active_version: true,
    generated_from_order_id: options.generated_from_order_id ?? null,
    generated_from_interview_id: options.generated_from_interview_id ?? null,
    generated_from_admin_edit: options.generated_from_admin_edit ?? false,
    house_dna_snapshot: houseDna,
    changed_fields: VERSIONED_HOUSE_DNA_FIELDS.map((field) => ({
      field,
      before: null,
      after: houseDna[field]
    }))
  };
}

export function createNextIdentityVersion(
  previousVersion: IdentityVersion,
  nextHouseDna: HouseDNA,
  options: CreateIdentityVersionOptions = {}
): IdentityVersion {
  const changedFields = diffHouseDNAFields(previousVersion.house_dna_snapshot, nextHouseDna);

  return {
    ...createContractMetadata(options.source ?? "identity_version_logic", options.timestamp),
    house_id: previousVersion.house_id,
    identity_id: previousVersion.identity_id,
    identity_version: previousVersion.identity_version + 1,
    version_reason: options.version_reason ?? determineVersionReason(changedFields, options),
    previous_version_id: previousVersion.id ?? null,
    active_version: true,
    generated_from_order_id: options.generated_from_order_id ?? null,
    generated_from_interview_id: options.generated_from_interview_id ?? null,
    generated_from_admin_edit: options.generated_from_admin_edit ?? false,
    house_dna_snapshot: nextHouseDna,
    changed_fields: changedFields
  };
}

export function diffHouseDNAFields(before: HouseDNA, after: HouseDNA): ChangedHouseDnaField[] {
  return VERSIONED_HOUSE_DNA_FIELDS.flatMap((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (stableJson(beforeValue) === stableJson(afterValue)) {
      return [];
    }

    return [
      {
        field,
        before: beforeValue,
        after: afterValue
      }
    ];
  });
}

export function determineVersionReason(
  changedFields: ChangedHouseDnaField[],
  options: Pick<CreateIdentityVersionOptions, "generated_from_admin_edit" | "generated_from_order_id"> = {}
): IdentityVersionReason {
  if (options.generated_from_admin_edit) {
    return "admin_edit";
  }
  if (options.generated_from_order_id) {
    return "product_upgrade";
  }
  return changedFields.length > 0 ? "user_edit" : "regeneration";
}

export function shouldCreateNewIdentityVersion(changedFields: ChangedHouseDnaField[]): boolean {
  return changedFields.length > 0;
}

export function isMemoryOnlyEvent(eventCode: string): boolean {
  return MEMORY_ONLY_EVENTS.includes(eventCode as (typeof MEMORY_ONLY_EVENTS)[number]);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortValue(nestedValue)])
    );
  }
  return value;
}
