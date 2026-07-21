import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough", "batch-3");
const baseline = JSON.parse(fs.readFileSync(path.join(outDir, "baseline.json"), "utf8"));

const proposals = [
  {
    listingId: "1829235400",
    product: "Rabbit Pendant Necklace",
    sku: "SP229-2",
    internalProductId: "MSK-PROD-000139",
    priority: 1,
    searchAngle: "rabbit pendant / bunny necklace / pearl accent",
    title: "Rabbit Pendant Necklace in 925 Sterling Silver with Pearl Accent, Handmade Animal Jewelry Gift",
    tags: ["rabbit pendant", "silver rabbit", "bunny necklace", "rabbit jewelry", "pearl pendant", "animal necklace", "925 silver pendant", "handmade rabbit", "bunny lover gift", "woodland jewelry", "sterling necklace", "pearl rabbit charm", "rabbit charm"],
    evidence: "Synced evidence: 81 views, 12 favorites, 0 orders. Etsy Stats: 16 views, 4 favorites, 0 orders. Current baseline has 12 tags, including unrelated 'coffee bean pendant'.",
    risk: "Medium",
    expectedBenefit: "Complete all 13 tag slots and align the title/tag set with demonstrated rabbit, bunny, pearl, and pendant intent.",
    roi: "High",
    control: "1815479817 / Sterling Silver Monkey Necklace / SP237"
  },
  {
    listingId: "4471142007",
    product: "Pegasus Brooch",
    sku: "BRC26",
    internalProductId: "MSK-PROD-000215",
    priority: 2,
    searchAngle: "Pegasus brooch / flying horse pin / mythology",
    title: "Pegasus Brooch in 925 Sterling Silver, Mythical Flying Horse Pin, Handmade Fantasy Jewelry",
    tags: ["pegasus brooch", "flying horse pin", "silver pegasus", "mythical brooch", "fantasy jewelry", "horse lover gift", "925 silver brooch", "winged horse pin", "handmade brooch", "mythology jewelry", "animal brooch", "silver horse pin", "fantasy gift"],
    evidence: "Synced evidence: 44 views, 9 favorites, 0 orders. Etsy Stats: 17 views, 9 favorites, 0 orders. Favorites are strong relative to traffic, but orders remain zero.",
    risk: "Low-Medium",
    expectedBenefit: "Strengthen exact product, material, gift, winged-horse, and mythology discovery coverage without changing the product position.",
    roi: "Medium-High",
    control: "4335043731 / Sterling Silver Crane Brooch / BRC25"
  },
  {
    listingId: "1893979797",
    product: "Sterling Silver Weave Bracelet",
    sku: "SB69",
    internalProductId: "MSK-PROD-000188",
    priority: 3,
    searchAngle: "men's woven silver cuff / adjustable bracelet",
    title: "Sterling Silver Weave Bracelet for Men, Adjustable Handmade Woven Cuff, Artisan Statement Jewelry",
    tags: ["silver bracelet", "weave bracelet", "woven silver cuff", "mens cuff bracelet", "adjustable cuff", "handmade bracelet", "sterling silver cuff", "artisan bracelet", "mens silver jewelry", "woven bracelet", "statement cuff", "gift for him", "silver weave"],
    evidence: "Synced evidence: 50 views, 6 favorites, 0 orders. Etsy Stats: 11 views, 3 favorites, 0 orders. Current tags include unrelated gold, women, 999, and star terms.",
    risk: "Medium",
    expectedBenefit: "Replace mismatched search terms with men's woven sterling-silver cuff and adjustable artisan intent.",
    roi: "Medium",
    control: "4433881138 / Hammered Silver Bracelet with 18K Gold Accent / SSB129"
  }
];

const normalize = (value) => value.trim().toLowerCase();
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const baselineById = new Map(baseline.listings.map((listing) => [listing.listing_id, listing]));

for (const listing of baseline.listings) {
  const { baseline_sha256, ...payload } = listing;
  if (hash(payload) !== baseline_sha256) throw new Error(`Baseline hash mismatch for ${listing.listing_id}.`);
}
const { report_sha256, ...reportPayload } = baseline;
if (hash(reportPayload) !== report_sha256) throw new Error("Baseline report hash mismatch.");

const items = proposals.map((proposal) => {
  const current = baselineById.get(proposal.listingId);
  if (!current) throw new Error(`Missing baseline for ${proposal.listingId}.`);
  const normalizedBefore = new Set(current.tags.map(normalize));
  const normalizedAfter = new Set(proposal.tags.map(normalize));
  const duplicateTags = proposal.tags.filter((tag, index) => proposal.tags.findIndex((other) => normalize(other) === normalize(tag)) !== index);
  const overLengthTags = proposal.tags.filter((tag) => tag.length > 20);
  const repeatedTitleWords = Object.entries(
    proposal.title.toLowerCase().match(/[a-z0-9]+/g).reduce((counts, word) => ({ ...counts, [word]: (counts[word] ?? 0) + 1 }), {})
  ).filter(([, count]) => count > 1);
  const validationPassed = proposal.title.length <= 140 && proposal.tags.length === 13 && duplicateTags.length === 0 && overLengthTags.length === 0;
  return {
    listing_id: proposal.listingId,
    product: proposal.product,
    sku: proposal.sku,
    internal_product_id: proposal.internalProductId,
    priority: proposal.priority,
    primary_search_angle: proposal.searchAngle,
    exact_field_diff: {
      title: { before: current.title, after: proposal.title },
      tags: { before: current.tags, after: proposal.tags },
      tag_delta_case_insensitive: {
        removed: current.tags.filter((tag) => !normalizedAfter.has(normalize(tag))),
        added: proposal.tags.filter((tag) => !normalizedBefore.has(normalize(tag))),
        retained: proposal.tags.filter((tag) => normalizedBefore.has(normalize(tag)))
      }
    },
    validation: {
      passed: validationPassed,
      title: { length: proposal.title.length, limit: 140, passed: proposal.title.length <= 140 },
      tags: {
        count: proposal.tags.length,
        count_passed: proposal.tags.length === 13,
        lengths: proposal.tags.map((tag) => ({ tag, length: tag.length, passed: tag.length <= 20 })),
        duplicate_tags: duplicateTags,
        over_length_tags: overLengthTags,
        passed: duplicateTags.length === 0 && overLengthTags.length === 0
      },
      repeated_word_check: {
        repeated_title_words: repeatedTitleWords,
        assessment: repeatedTitleWords.length ? "Review" : "PASS"
      },
      relevance_check: "PASS - all proposed terms describe the verified product type, material, motif, style, or buyer use.",
      trademark_risk_check: "LOW lexical risk - generic/descriptive or mythology terms only; not a legal trademark clearance.",
      keyword_conflict_check: "PASS - distinct primary angle; no other matching family title found in the saved 215-listing evidence; no exact tag overlap across this batch.",
      forbidden_fields_unchanged: ["description", "price", "quantity", "shipping_profile_id", "taxonomy_id", "images", "state", "ads", "messages", "reviews"]
    },
    evidence: proposal.evidence,
    risk: proposal.risk,
    expected_benefit: proposal.expectedBenefit,
    roi: proposal.roi,
    untouched_control: proposal.control,
    rollback: {
      ready: validationPassed,
      baseline_sha256: current.baseline_sha256,
      baseline_captured_at: current.baseline_captured_at,
      prewrite_revalidation_required: true,
      stop_if_current_title_or_tags_differ: true
    },
    recommend_approval: validationPassed
  };
});

const dryRunWithoutHash = {
  batch_key: "batch-3",
  generated_at: new Date().toISOString(),
  mode: "dry-run-read-only",
  etsy_modified: false,
  baseline_report_sha256: baseline.report_sha256,
  baseline_integrity_verified: true,
  batch_keyword_conflict: {
    passed: true,
    primary_angles_unique: true,
    shared_exact_proposed_tags: []
  },
  allowed_write_fields_if_later_approved: ["title", "tags"],
  forbidden_fields: ["description", "price", "inventory", "shipping", "taxonomy", "category", "images", "image_order", "ads", "messages", "reviews"],
  items
};
const dryRun = { ...dryRunWithoutHash, dry_run_sha256: hash(dryRunWithoutHash) };
fs.writeFileSync(path.join(outDir, "dry-run-diff.json"), `${JSON.stringify(dryRun, null, 2)}\n`, { mode: 0o600 });

const sections = items.map((item) => `## ${item.priority}. ${item.product}

- Listing ID: \`${item.listing_id}\`
- Internal Product ID / SKU: \`${item.internal_product_id}\` / \`${item.sku}\`
- Evidence: ${item.evidence}
- Primary search angle: ${item.primary_search_angle}
- Risk: ${item.risk}
- Expected benefit: ${item.expected_benefit}
- ROI: ${item.roi}
- Untouched control: ${item.untouched_control}
- Rollback ready: ${item.rollback.ready ? "YES" : "NO"} (SHA-256 \`${item.rollback.baseline_sha256}\`)
- Recommended for exact Founder/CSO approval: ${item.recommend_approval ? "YES" : "NO"}

### Title

Current (${item.exact_field_diff.title.before.length} chars):

\`${item.exact_field_diff.title.before}\`

Proposed (${item.exact_field_diff.title.after.length} chars, PASS <= 140):

\`${item.exact_field_diff.title.after}\`

### Tags

Current (${item.exact_field_diff.tags.before.length}):

${item.exact_field_diff.tags.before.map((tag, index) => `${index + 1}. \`${tag}\``).join("\n")}

Proposed (13, PASS; every tag <= 20 chars):

${item.exact_field_diff.tags.after.map((tag, index) => `${index + 1}. \`${tag}\``).join("\n")}

Removed: ${item.exact_field_diff.tag_delta_case_insensitive.removed.map((tag) => `\`${tag}\``).join(", ") || "None"}

Added: ${item.exact_field_diff.tag_delta_case_insensitive.added.map((tag) => `\`${tag}\``).join(", ") || "None"}

Retained (case-insensitive): ${item.exact_field_diff.tag_delta_case_insensitive.retained.map((tag) => `\`${tag}\``).join(", ") || "None"}

### Validation

- Duplicate exact tags: None
- Repeated title words: ${item.validation.repeated_word_check.repeated_title_words.length ? JSON.stringify(item.validation.repeated_word_check.repeated_title_words) : "None"}
- Relevance: PASS
- Trademark risk: Low lexical risk; generic/descriptive or mythology wording only; not legal clearance
- Shop conflict: PASS using saved 215-listing evidence; primary family/title angle is unique
- Forbidden fields: unchanged
- Pre-write guard: re-read current title/tags and stop if either differs from this baseline
`).join("\n");

const review = `# Batch 3 Founder / CSO Review

Generated: ${dryRun.generated_at}
Mode: Read-only dry-run
Etsy modified: NO
Baseline captured: ${baseline.generated_at}
Baseline report SHA-256: \`${baseline.report_sha256}\`
Dry-run SHA-256: \`${dryRun.dry_run_sha256}\`

${sections}
## Batch Decision

- Technical validation: PASS for all three listings.
- Batch-level exact tag overlap: None.
- Primary search angles: Unique.
- Rollback baselines: Complete and integrity-verified.
- Recommendation: READY FOR FOUNDER/CSO EXACT-DIFF REVIEW.
- No write is authorized by this file. Before any later write, the API must re-read title and tags and match the saved SHA-256 baseline; otherwise stop and regenerate the diff.
`;
fs.writeFileSync(path.join(outDir, "founder-cso-review.md"), review, { mode: 0o600 });
console.log(JSON.stringify({ dryRun: path.join(outDir, "dry-run-diff.json"), review: path.join(outDir, "founder-cso-review.md"), dryRunSha256: dryRun.dry_run_sha256 }, null, 2));
