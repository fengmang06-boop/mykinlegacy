export type EtsyIdentifierResolution = {
  listingId: string;
  canonicalKey: string;
  sourceSku: string;
  sourceSkuUnique: false;
  productAliases: string[];
  orderAttribution: "etsy_listing_id";
  rollbackIdentity: "etsy_listing_id";
  etsySkuWriteAuthorized: false;
  status: "resolved";
  evidence: string[];
};

type IdentifierCandidate = {
  listingId: string;
  product: string;
  sku: string | null;
  identifierReliable: boolean;
  evidence: string[];
};

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function applyEtsyIdentifierResolution<T extends IdentifierCandidate>(
  candidate: T,
  resolutions: EtsyIdentifierResolution[]
): T {
  if (candidate.identifierReliable) return candidate;

  const resolution = resolutions.find((item) => item.listingId === candidate.listingId);
  if (
    !resolution ||
    resolution.status !== "resolved" ||
    resolution.canonicalKey !== `etsy-listing:${candidate.listingId}` ||
    normalized(resolution.sourceSku) !== normalized(candidate.sku ?? "") ||
    resolution.sourceSkuUnique !== false ||
    !resolution.productAliases.some((alias) => normalized(alias) === normalized(candidate.product)) ||
    resolution.orderAttribution !== "etsy_listing_id" ||
    resolution.rollbackIdentity !== "etsy_listing_id" ||
    resolution.etsySkuWriteAuthorized !== false ||
    resolution.evidence.length < 2
  ) {
    return candidate;
  }

  return {
    ...candidate,
    identifierReliable: true,
    evidence: [
      ...candidate.evidence.filter((item) => !/sku mapping conflict remains unresolved/i.test(item)),
      `Duplicate source SKU ${resolution.sourceSku} is isolated by canonical identity ${resolution.canonicalKey}.`,
      "Orders, baselines, writes, verification, and rollback are attributed by exact Etsy listing ID only."
    ]
  };
}
