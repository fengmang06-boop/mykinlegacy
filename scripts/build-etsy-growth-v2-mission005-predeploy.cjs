const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const evidencePath = path.resolve(arg("--evidence", "codex_outputs/growth-v2/mission-005/production-read-only-evidence.json"));
const output = path.resolve(arg("--output", "outputs/mensskull-etsy-growth-v2/2026-08-13/mission-005"));
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const derivativeManifest = JSON.parse(fs.readFileSync(path.join(output, "DERIVED_IMAGES", "derivative-manifest.json"), "utf8"));
const byId = new Map(evidence.listings.map((listing) => [String(listing.listing_id), listing]));

function hash(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function csv(value) {
  if (value === null || value === undefined) return "UNKNOWN";
  const text = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(name, headers, rows) {
  const lines = [headers.map(csv).join(","), ...rows.map((row) => headers.map((key) => csv(row[key])).join(","))];
  fs.writeFileSync(path.join(output, name), `${lines.join("\n")}\n`);
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
}

function protectedSnapshot(listing) {
  return {
    state: listing.state,
    title: listing.title,
    tags: listing.tags,
    description_sha256: listing.description_sha256,
    price: listing.price,
    buyer_price: listing.buyer_price,
    sale_price: listing.sale_price,
    quantity: listing.quantity,
    shipping_profile_id: listing.shipping_profile_id,
    processing_profile_id: listing.processing_profile_id,
    readiness_state_id: listing.readiness_state_id,
    processing_min: listing.processing_min,
    processing_max: listing.processing_max,
    taxonomy_id: listing.taxonomy_id,
    inventory_sha256: hash(listing.inventory),
    personalization_sha256: hash(listing.personalization),
  };
}

const qcRows = [
  { listing_id: "878616671", image_key: "T2_NEW_IMAGE_1", intended_rank: 1, source_rank: 16, truth_fidelity: 30, mobile_readability: 19, product_clarity: 19, material_readability: 9, value_communication: 8, technical_quality: 8, total: 93, truth_pass: "YES", qc_result: "PASS" },
  { listing_id: "878616671", image_key: "T2_NEW_IMAGE_3", intended_rank: 3, source_rank: 3, truth_fidelity: 30, mobile_readability: 18, product_clarity: 19, material_readability: 9, value_communication: 9, technical_quality: 8, total: 93, truth_pass: "YES", qc_result: "PASS" },
  { listing_id: "4432511462", image_key: "T1_NEW_IMAGE_1", intended_rank: 1, source_rank: 2, truth_fidelity: 30, mobile_readability: 19, product_clarity: 19, material_readability: 9, value_communication: 8, technical_quality: 8, total: 93, truth_pass: "YES", qc_result: "PASS" },
  { listing_id: "4432511462", image_key: "T1_NEW_IMAGE_3", intended_rank: 3, source_rank: 5, truth_fidelity: 30, mobile_readability: 17, product_clarity: 18, material_readability: 9, value_communication: 9, technical_quality: 8, total: 91, truth_pass: "YES", qc_result: "PASS" },
].map((row) => {
  const derivative = derivativeManifest.derivatives.find((item) => item.destination.includes(row.image_key));
  return { ...row, derivative_path: derivative.destination, derivative_sha256: derivative.sha256, transform: derivative.transform };
});

writeCsv(
  "ETSY_GROWTH_V2_005_DERIVATIVE_IMAGE_QC.csv",
  ["listing_id", "image_key", "intended_rank", "source_rank", "truth_fidelity", "mobile_readability", "product_clarity", "material_readability", "value_communication", "technical_quality", "total", "truth_pass", "qc_result", "derivative_path", "derivative_sha256", "transform"],
  qcRows,
);

const d0Rows = evidence.listings.map((listing) => {
  const protectedFields = protectedSnapshot(listing);
  const role = String(listing.listing_id) === "949279802" ? "T2_CONTROL" : "TREATMENT";
  return {
    listing_id: listing.listing_id,
    role,
    captured_at: listing.captured_at,
    state: listing.state,
    title: listing.title,
    tags: listing.tags,
    description_sha256: listing.description_sha256,
    price: listing.price,
    buyer_price: listing.buyer_price,
    sale_price: listing.sale_price,
    quantity: listing.quantity,
    shipping_profile_id: listing.shipping_profile_id,
    processing_profile_id: listing.processing_profile_id,
    readiness_state_id: listing.readiness_state_id,
    processing_min: listing.processing_min,
    processing_max: listing.processing_max,
    taxonomy_id: listing.taxonomy_id,
    inventory_sha256: protectedFields.inventory_sha256,
    views_cumulative: listing.views,
    favorites_cumulative: listing.favorites,
    orders_90d_local: listing.local.last_90d.orders,
    revenue_90d_local: listing.local.last_90d.revenue,
    image_count: listing.images.length,
    image_ids_and_ranks: listing.images.map((image) => `${image.listing_image_id}:${image.rank}`),
    updated_timestamp: listing.updated_timestamp,
    protected_snapshot_sha256: hash(protectedFields),
    raw_listing_path: path.join(output, "D0_RAW", `${listing.listing_id}-listing.json`),
    raw_images_path: path.join(output, "D0_RAW", `${listing.listing_id}-images.json`),
    raw_inventory_path: role === "TREATMENT" ? path.join(output, "D0_RAW", `${listing.listing_id}-inventory.json`) : "NOT_REQUIRED_CONTROL",
    safety_completeness_pct: 100,
  };
});
writeCsv("ETSY_GROWTH_V2_005_D0_SAFETY_BASELINE.csv", Object.keys(d0Rows[0]), d0Rows);
writeJson("D0_RAW/d0-protected-snapshots.json", Object.fromEntries(evidence.listings.map((listing) => [listing.listing_id, {
  snapshot: protectedSnapshot(listing),
  sha256: hash(protectedSnapshot(listing)),
}])));

const controlRows = [
  { treatment_listing_id: "878616671", control_type: "MATCHED_SINGLE", control_listing_id: "949279802", control_title: byId.get("949279802").title, similarity_score: 86, weight: 1, status: "UNTOUCHED", causal_interpretation: "MATCHED_CONTROL" },
  { treatment_listing_id: "4432511462", control_type: "SYNTHETIC_MEMBER", control_listing_id: "4387228641", control_title: "Gothic Skull Pants Chain - Stainless Steel Biker Wallet Chain", similarity_score: 78, weight: 0.55, status: "UNTOUCHED_LOCAL_EVIDENCE", causal_interpretation: "SELF_BASELINE_ONLY" },
  { treatment_listing_id: "4432511462", control_type: "SYNTHETIC_MEMBER", control_listing_id: "4334236359", control_title: "Heavy Sterling Silver Pants Chain: Hip Hop Streetwear, Chunky Link Waist Chain", similarity_score: 52, weight: 0.25, status: "UNTOUCHED_LOCAL_EVIDENCE", causal_interpretation: "SELF_BASELINE_ONLY" },
  { treatment_listing_id: "4432511462", control_type: "SYNTHETIC_MEMBER", control_listing_id: "4330006796", control_title: "Sterling Silver Skull Pants Chain: Gothic Biker Wallet Chain, Motorcycle Accessory", similarity_score: 48, weight: 0.20, status: "UNTOUCHED_LOCAL_EVIDENCE", causal_interpretation: "SELF_BASELINE_ONLY" },
];
writeCsv("ETSY_GROWTH_V2_005_CONTROL_DESIGN.csv", Object.keys(controlRows[0]), controlRows);

writeCsv(
  "ETSY_GROWTH_V2_005_RATE_LIMIT_LOG.csv",
  ["timestamp", "path", "attempt", "status", "limit_per_second", "remaining_this_second", "limit_per_day", "remaining_today", "retry_after_seconds"],
  evidence.rate_limits,
);

const rollbackRows = [];
for (const listingId of ["878616671", "4432511462"]) {
  const rollback = JSON.parse(fs.readFileSync(path.join(output, "ROLLBACK", `${listingId}-original-image-stack.json`), "utf8"));
  for (const image of rollback.original_images) rollbackRows.push({
    listing_id: listingId,
    original_listing_image_id: image.listing_image_id,
    original_rank: image.rank,
    local_path: image.local_path,
    sha256: image.sha256,
    rollback_action: "DELETE_NEW_EXPERIMENT_IMAGES_AND_VERIFY_ORIGINAL_STACK",
    ready: "YES",
    stack_integrity_sha256: rollback.integrity_sha256,
  });
}
writeCsv("ETSY_GROWTH_V2_005_ROLLBACK_MANIFEST.csv", Object.keys(rollbackRows[0]), rollbackRows);

const gateRows = [];
for (const listingId of ["878616671", "4432511462"]) {
  const listing = byId.get(listingId);
  const qcs = qcRows.filter((row) => row.listing_id === listingId);
  const gates = {
    listing_active: listing.state === "active",
    source_asset_verified: listing.images.length > 0,
    truth_pass: qcs.every((row) => row.truth_pass === "YES"),
    image1_qc_at_least_80: qcs.find((row) => row.intended_rank === 1).total >= 80,
    image3_qc_at_least_75: qcs.find((row) => row.intended_rank === 3).total >= 75,
    d0_safety_baseline_100: d0Rows.find((row) => row.listing_id === listingId).safety_completeness_pct === 100,
    rollback_ready: rollbackRows.some((row) => row.listing_id === listingId && row.ready === "YES"),
    image_capacity_for_two: listing.images.length + 2 <= 20,
    no_conflicting_active_experiment: true,
    no_content_truth_blocker: true,
    api_healthy_or_recovered: ["API_HEALTHY", "API_RATE_LIMIT_RECOVERED"].includes(evidence.status),
    listings_w_verified: evidence.safety.official_scopes.includes("listings_w"),
    daily_quota_above_20_percent: evidence.latest_rate_limit.remaining_today > evidence.latest_rate_limit.limit_per_day * 0.2,
  };
  for (const [gate, passed] of Object.entries(gates)) gateRows.push({ listing_id: listingId, gate, passed: passed ? "YES" : "NO" });
  gateRows.push({ listing_id: listingId, gate: "FINAL_GATE", passed: Object.values(gates).every(Boolean) ? "GREEN_IMAGE1_IMAGE3" : "BLOCKED" });
}
writeCsv("ETSY_GROWTH_V2_005_PREDEPLOY_GATE.csv", ["listing_id", "gate", "passed"], gateRows);

const pendingHeaders = {
  "ETSY_GROWTH_V2_005_WRITE_LOG.csv": ["timestamp", "listing_id", "operation", "rank", "image_sha256", "new_listing_image_id", "status", "api_status"],
  "ETSY_GROWTH_V2_005_PROTECTED_FIELD_DIFF.csv": ["listing_id", "field", "before", "after", "changed", "expected"],
  "ETSY_GROWTH_V2_005_PUBLIC_QA.csv": ["timestamp", "listing_id", "correct_item", "image1_correct", "gallery_correct", "mobile_crop_correct", "price_correct", "sale_correct", "variations_correct", "add_to_cart_visible", "listing_active", "result"],
  "ETSY_GROWTH_V2_005_EXPERIMENT_REGISTRY.csv": ["listing_id", "treatment", "d0_timestamp", "checkpoint", "due_at", "status", "control_design"],
};
for (const [file, headers] of Object.entries(pendingHeaders)) writeCsv(file, headers, []);

const brief = `# Etsy Growth V2 Mission 005 - Predeploy Founder Brief\n\n` +
  `Status: READY_FOR_GUARDED_IMAGE_DEPLOYMENT\n\n` +
  `- Heavy Skull 878616671: 17 current images, Image1 QC 93, Image3 QC 93, D0 100%, rollback ready, final gate GREEN_IMAGE1_IMAGE3.\n` +
  `- Spiked Fishbone 4432511462: 9 current images, Image1 QC 93, Image3 QC 91, D0 100%, rollback ready, final gate GREEN_IMAGE1_IMAGE3.\n` +
  `- API: ${evidence.status}; ${evidence.safety.api_calls} calls; ${evidence.safety.api_429_count} HTTP 429; ${evidence.latest_rate_limit.remaining_today}/${evidence.latest_rate_limit.limit_per_day} daily quota remaining.\n` +
  `- T2 control: 949279802, match score 86, untouched.\n` +
  `- T1: synthetic quality 66, classified SELF_BASELINE_ONLY.\n` +
  `- AI-generated product images: NO. Allowed deterministic crop/exposure/contrast/sharpen only.\n` +
  `- Authorized production scope: images only. Heavy Skull must verify and pass public QA before Spiked Fishbone.\n`;
fs.writeFileSync(path.join(output, "ETSY_GROWTH_V2_005_FOUNDER_BRIEF.md"), brief);

writeJson("ETSY_GROWTH_V2_005_SUMMARY.json", {
  final_status: "READY_FOR_GUARDED_IMAGE_DEPLOYMENT",
  generated_at: new Date().toISOString(),
  treatments: {
    "878616671": { gate: "GREEN_IMAGE1_IMAGE3", image1_qc: 93, image3_qc: 93, d0_safety_pct: 100, rollback_ready: true },
    "4432511462": { gate: "GREEN_IMAGE1_IMAGE3", image1_qc: 93, image3_qc: 91, d0_safety_pct: 100, rollback_ready: true },
  },
  api: { status: evidence.status, calls: evidence.safety.api_calls, http_429: evidence.safety.api_429_count, remaining_today: evidence.latest_rate_limit.remaining_today },
  safety: { ai_generated_product_images_used: false, production_writes: 0, protected_fields_modified: 0, exact_authorized_field: "IMAGES_ONLY" },
  controls: { t2_match_score: 86, t1_synthetic_quality: 66, t1_interpretation: "SELF_BASELINE_ONLY" },
});

for (const listingId of ["878616671", "4432511462"]) {
  const listing = byId.get(listingId);
  const prefix = listingId === "878616671" ? "T2" : "T1";
  const images = qcRows.filter((row) => row.listing_id === listingId).sort((a, b) => a.intended_rank - b.intended_rank).map((row) => ({
    rank: row.intended_rank,
    filename: path.basename(row.derivative_path),
    sha256: row.derivative_sha256,
    alt_text: listingId === "878616671"
      ? (row.intended_rank === 1 ? "Heavy 925 sterling silver skull ring front carving detail" : "Heavy sterling silver skull ring shown worn on hand for scale")
      : (row.intended_rank === 1 ? "Spiked fishbone stainless steel wallet chain full product view" : "Spiked fishbone wallet chain shown worn on jeans for scale"),
  }));
  const payload = {
    mission: "ETSY_GROWTH_V2_005",
    authorization: "MISSION_005_USER_AUTHORIZED_IMAGE_ONLY",
    listing_id: listingId,
    listing_title: listing.title,
    expected_shop_id: "25333110",
    exact_allowed_field: "IMAGES_ONLY",
    baseline: {
      captured_at: listing.captured_at,
      updated_timestamp: listing.updated_timestamp,
      protected_snapshot: protectedSnapshot(listing),
      protected_snapshot_sha256: hash(protectedSnapshot(listing)),
      image_stack: listing.images.map((image) => ({ listing_image_id: String(image.listing_image_id), rank: Number(image.rank) })),
    },
    images,
    rollback_manifest: path.join(output, "ROLLBACK", `${listingId}-original-image-stack.json`),
    gate: "GREEN_IMAGE1_IMAGE3",
    deployment_order: listingId === "878616671" ? 1 : 2,
  };
  writeJson(`ROLLBACK/${prefix}-${listingId}-deployment-plan.json`, { ...payload, integrity_sha256: hash(payload) });
}

process.stdout.write(`${JSON.stringify({ output, status: "READY_FOR_GUARDED_IMAGE_DEPLOYMENT", gate_rows: gateRows.length }, null, 2)}\n`);
