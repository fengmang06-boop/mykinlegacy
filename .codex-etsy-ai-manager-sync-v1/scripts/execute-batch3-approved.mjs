import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";
const EXPECTED_SHOP_ID = "25333110";
const MAX_WRITES = 2;
const MIN_REQUEST_INTERVAL_MS = 450;
const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough", "batch-3");
const successMarker = path.join(outDir, "batch-3-execution-success.json");

const approvedChanges = [
  {
    listingId: "1829235400",
    product: "Rabbit Pendant Necklace",
    baselineSha256: "fbf3df22ef3a3edafe997cb60c3536e3affc141c253ba492d3c1bc568626a959",
    title: "Rabbit Pendant Necklace in 925 Sterling Silver with Pearl Accent, Handmade Animal Jewelry Gift",
    tags: [
      "rabbit pendant", "rabbit necklace", "silver rabbit", "bunny necklace", "rabbit jewelry",
      "pearl pendant", "animal necklace", "925 silver pendant", "handmade pendant",
      "bunny lover gift", "woodland jewelry", "pearl rabbit charm", "rabbit charm"
    ]
  },
  {
    listingId: "4471142007",
    product: "Pegasus Brooch",
    baselineSha256: "84a8979431d4bd6de36ebd3f4a4658baba6e8c8ce37023990937f6a219ba363a",
    title: "Pegasus Brooch in 925 Sterling Silver, Mythical Flying Horse Pin, Handmade Fantasy Jewelry",
    tags: [
      "pegasus brooch", "pegasus pin", "flying horse pin", "silver pegasus", "mythical horse pin",
      "fantasy brooch", "horse lover gift", "925 silver brooch", "winged horse pin",
      "handmade brooch", "mythology jewelry", "lapel pin", "fantasy gift"
    ]
  }
];

const weaveListingId = "1893979797";
let nextRequestAt = 0;
let rateLimit = { limitPerDay: null, remainingToday: null, reserve: null };
let writeWindow = false;

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^['"]|['"]$/g, "");
    if (typeof process.env[match[1]] === "undefined") process.env[match[1]] = value;
  }
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
}

function normalizeTags(tags) {
  return tags.map((tag) => String(tag));
}

function validateApprovedChange(change) {
  const normalized = change.tags.map((tag) => tag.toLowerCase());
  const errors = [];
  if (change.title.length > 140) errors.push(`title length ${change.title.length}`);
  if (change.tags.length !== 13) errors.push(`tag count ${change.tags.length}`);
  if (new Set(normalized).size !== change.tags.length) errors.push("duplicate tags");
  const overLength = change.tags.filter((tag) => tag.length > 20);
  if (overLength.length) errors.push(`tags over 20 chars: ${overLength.join(", ")}`);
  if (errors.length) throw new Error(`${change.product} approved values failed validation: ${errors.join("; ")}`);
}

function verifyBaselineFile() {
  const file = path.join(outDir, "baseline.json");
  if (!fs.existsSync(file)) throw new Error("Batch 3 baseline.json is missing.");
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const { report_sha256: reportHash, ...reportPayload } = report;
  if (hashJson(reportPayload) !== reportHash) throw new Error("Batch 3 baseline report SHA-256 mismatch.");
  if (reportHash !== "02ec80933b4a53ba075aa2301d6af0b13958355c56cef142ec81befe473fa880") {
    throw new Error("Batch 3 baseline report is not the reviewed version.");
  }
  const byId = new Map();
  for (const listing of report.listings ?? []) {
    const { baseline_sha256: listingHash, ...payload } = listing;
    if (hashJson(payload) !== listingHash) throw new Error(`Baseline SHA-256 mismatch for ${listing.listing_id}.`);
    byId.set(String(listing.listing_id), listing);
  }
  for (const change of approvedChanges) {
    if (byId.get(change.listingId)?.baseline_sha256 !== change.baselineSha256) {
      throw new Error(`Reviewed rollback baseline mismatch for ${change.product}.`);
    }
  }
  return { file, reportHash, byId };
}

function readDailyWriteCount(today) {
  let count = 0;
  const stack = [path.join(process.cwd(), "exports", "low-signal-breakthrough")];
  while (stack.length) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /execution.*\.json$/i.test(entry.name) && full !== successMarker) {
        try {
          const data = JSON.parse(fs.readFileSync(full, "utf8"));
          const timestamp = String(data.executedAt ?? data.trackingStartTime ?? "");
          if (!timestamp.startsWith(today)) continue;
          count += (data.results ?? []).filter((item) => item.status === "written" || item.updateStatus === "attempted").length;
        } catch {
          // Ignore unrelated or partial historical records.
        }
      }
    }
  }
  return count;
}

async function waitForSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

function headerNumber(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function updateRateLimit(headers) {
  rateLimit.limitPerDay = headerNumber(headers, ["x-limit-per-day"]) ?? rateLimit.limitPerDay;
  rateLimit.remainingToday = headerNumber(headers, ["x-remaining-today"]) ?? rateLimit.remainingToday;
  rateLimit.reserve = rateLimit.limitPerDay === null ? null : Math.max(50, Math.ceil(rateLimit.limitPerDay * 0.2));
}

function assertRateReserve() {
  if (rateLimit.remainingToday !== null && rateLimit.reserve !== null && rateLimit.remainingToday <= rateLimit.reserve) {
    throw new Error(`Etsy request blocked at reserve boundary: ${rateLimit.remainingToday}/${rateLimit.limitPerDay}.`);
  }
}

async function etsyRequest(apiPath, init = {}) {
  assertRateReserve();
  await waitForSlot();
  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = process.env.ETSY_CLIENT_SECRET ?? "";
  const accessToken = process.env.ETSY_ACCESS_TOKEN ?? "";
  const response = await fetch(`${ETSY_API_BASE}${apiPath}`, {
    ...init,
    headers: {
      "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.headers ?? {})
    }
  });
  updateRateLimit(response.headers);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (response.status === 429) throw new Error(`Etsy 429 received for ${apiPath}; stopped without retry.`);
  if (!response.ok) throw new Error(`Etsy request failed for ${apiPath}: ${response.status} ${text}`);
  return data;
}

async function verifyOfficialScopes() {
  const token = process.env.ETSY_ACCESS_TOKEN ?? "";
  const data = await etsyRequest("/scopes", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token })
  });
  function readScopes(value) {
    if (Array.isArray(value)) return value.flatMap(readScopes);
    if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
    if (value && typeof value === "object") {
      return readScopes(value.scopes ?? value.scope ?? value.results ?? value.permissions);
    }
    return [];
  }
  const scopes = readScopes(data);
  if (!scopes.includes("listings_w")) throw new Error(`Official Etsy scopes do not include listings_w: ${scopes.join(" ")}`);
  return [...new Set(scopes)].sort();
}

async function readListing(listingId) {
  return etsyRequest(`/listings/${listingId}?includes=Images,Inventory`, { method: "GET" });
}

function imageSnapshot(listing) {
  return (listing.images ?? []).map((image, index) => ({
    listing_image_id: String(image.listing_image_id),
    rank: Number.isFinite(image.rank) ? image.rank : index + 1
  })).sort((left, right) => left.rank - right.rank);
}

function forbiddenSnapshot(listing) {
  return {
    description: String(listing.description ?? ""),
    price: listing.price ?? null,
    quantity: listing.quantity ?? null,
    state: listing.state ?? null,
    taxonomy_id: listing.taxonomy_id ?? null,
    shipping_profile_id: listing.shipping_profile_id ?? null,
    images: imageSnapshot(listing)
  };
}

function assertLiveMatchesReviewedBaseline(change, live, reviewed) {
  if (String(live.listing_id) !== change.listingId) throw new Error(`Unexpected listing returned for ${change.product}.`);
  if (String(live.title ?? "") !== String(reviewed.title ?? "")) {
    throw new Error(`${change.product} live title differs from reviewed baseline.`);
  }
  if (JSON.stringify(normalizeTags(live.tags ?? [])) !== JSON.stringify(normalizeTags(reviewed.tags ?? []))) {
    throw new Error(`${change.product} live tags differ from reviewed baseline.`);
  }
  if (live.state !== "active") throw new Error(`${change.product} is not active; stopped.`);
}

function assertWriteGuard(change, reviewed, dailyWrites, officialScopes) {
  if (!writeWindow || process.env.ETSY_READ_ONLY_MODE !== "false" || process.env.ETSY_WRITE_APPROVED !== "true") {
    throw new Error("Batch 3 process-local write guard is closed.");
  }
  if (!officialScopes.includes("listings_w")) throw new Error("listings_w is not verified.");
  if (!approvedChanges.some((approved) => approved.listingId === change.listingId && approved.title === change.title && JSON.stringify(approved.tags) === JSON.stringify(change.tags))) {
    throw new Error(`Unapproved values requested for ${change.product}.`);
  }
  if (reviewed.baseline_sha256 !== change.baselineSha256) throw new Error(`Rollback baseline mismatch for ${change.product}.`);
  if (dailyWrites >= 3) throw new Error(`Daily write limit would be exceeded: ${dailyWrites} already recorded.`);
}

async function patchListing(change) {
  if (process.env.ETSY_SHOP_ID && process.env.ETSY_SHOP_ID !== EXPECTED_SHOP_ID) {
    throw new Error(`Connected shop ID ${process.env.ETSY_SHOP_ID} is not MENSSKULL ${EXPECTED_SHOP_ID}.`);
  }
  return etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings/${change.listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title: change.title, tags: change.tags.join(",") })
  });
}

function evidenceSnippets(text, regex) {
  const normalized = String(text ?? "").replace(/\s+/g, " ");
  const matches = [];
  let match;
  const pattern = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  while ((match = pattern.exec(normalized)) && matches.length < 8) {
    matches.push(normalized.slice(Math.max(0, match.index - 55), Math.min(normalized.length, match.index + match[0].length + 80)).trim());
  }
  return [...new Set(matches)];
}

function verifyWeave(listing, reviewed) {
  const materials = Array.isArray(listing.materials) ? listing.materials.map(String) : [];
  const title = String(listing.title ?? "");
  const tags = normalizeTags(listing.tags ?? []);
  const description = String(listing.description ?? "");
  const authoritativeMaterialText = materials.join(" | ").toLowerCase();
  const allText = [title, materials.join(" "), tags.join(" "), description].join(" ");
  const materialEvidence = evidenceSnippets(allText, /\b(?:925|999|sterling silver|fine silver)\b/gi);
  const constructionEvidence = evidenceSnippets(allText, /\b(?:open cuff|cuff|woven|weave|chain|clasp|adjustable|flexible|bangle|toggle|lobster)\b/gi);
  const materialsSay925 = /\b925\b|sterling silver/.test(authoritativeMaterialText);
  const materialsSay999 = /\b999\b|fine silver/.test(authoritativeMaterialText);
  const allSays925 = /\b925\b|sterling silver/i.test(allText);
  const allSays999 = /\b999\b|fine silver/i.test(allText);
  const purity = materialsSay925 && !materialsSay999 && !allSays999 ? "925 sterling silver" :
    materialsSay999 && !materialsSay925 && !allSays925 ? "999 fine silver" : "UNRESOLVED_CONFLICT";
  const lower = allText.toLowerCase();
  const saysOpenCuff = /open[- ]ended|open cuff|cuff opening/.test(lower);
  const saysChain = /chain bracelet|lobster clasp|toggle clasp/.test(lower);
  const saysFlexibleWoven = /(flexible|adjustable).{0,50}(woven|weave)|(woven|weave).{0,50}(flexible|adjustable)/.test(lower);
  const structure = saysOpenCuff && !saysChain ? "open cuff" : saysChain && !saysOpenCuff ? "chain bracelet" : saysFlexibleWoven && !saysOpenCuff ? "flexible woven bracelet" : "UNRESOLVED";
  const adjustmentMethod = /lobster clasp/.test(lower) ? "lobster clasp" : /toggle clasp/.test(lower) ? "toggle clasp" : saysOpenCuff ? "open cuff adjustment" : /adjustable/.test(lower) ? "described as adjustable; method not explicit" : "UNRESOLVED";
  const wovenAccurate = /woven|weave/i.test([title, materials.join(" "), description].join(" ")) ? "SUPPORTED_BY_LISTING_TEXT" : "UNRESOLVED";
  return {
    listing_id: weaveListingId,
    product: "Sterling Silver Weave Bracelet",
    baseline_sha256: reviewed.baseline_sha256,
    live_title: title,
    live_tags: tags,
    materials,
    purity,
    structure,
    adjustment_method: adjustmentMethod,
    woven_accuracy: wovenAccurate,
    material_evidence: materialEvidence,
    construction_evidence: constructionEvidence,
    hold_status: purity === "UNRESOLVED_CONFLICT" || structure === "UNRESOLVED" ? "HOLD" : "VERIFIED_PENDING_NEW_DRY_RUN",
    etsy_modified: false,
    captured_at: new Date().toISOString()
  };
}

function trackingPlan(trackingStartTime, results) {
  const checkpoints = [["D1", 1], ["D3", 3], ["D7", 7], ["D14", 14]];
  return results.map((result) => ({
    listing_id: result.listingId,
    product: result.product,
    baseline: result.trackingBaseline,
    checkpoints: checkpoints.map(([checkpoint, days]) => ({
      checkpoint,
      due_at: new Date(new Date(trackingStartTime).getTime() + days * 86400000).toISOString(),
      status: "pending"
    }))
  }));
}

async function main() {
  if (fs.existsSync(successMarker)) {
    const existing = JSON.parse(fs.readFileSync(successMarker, "utf8"));
    console.log(`BATCH3_RESULT_JSON=${JSON.stringify({ ...existing, idempotentReplay: true })}`);
    return;
  }
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  if (process.env.ETSY_READ_ONLY_MODE !== "true" || process.env.ETSY_WRITE_APPROVED !== "false") {
    throw new Error("Execution must start with ETSY_READ_ONLY_MODE=true and ETSY_WRITE_APPROVED=false.");
  }
  if (!String(process.env.DATABASE_URL ?? "file:./dev.db").startsWith("file:")) {
    throw new Error("Etsy DATABASE_URL is not isolated SQLite.");
  }
  for (const change of approvedChanges) validateApprovedChange(change);
  const reviewedBaseline = verifyBaselineFile();
  const dailyWrites = readDailyWriteCount(new Date().toISOString().slice(0, 10));
  if (dailyWrites + approvedChanges.length > 3) throw new Error(`Daily write limit blocked Batch 3: ${dailyWrites} writes already recorded today.`);
  const officialScopes = await verifyOfficialScopes();
  if (rateLimit.remainingToday !== null && rateLimit.reserve !== null && rateLimit.remainingToday - 7 <= rateLimit.reserve) {
    throw new Error("Insufficient Etsy quota above the 20% reserve for the approved execution.");
  }

  const weaveLive = await readListing(weaveListingId);
  const weaveReviewed = reviewedBaseline.byId.get(weaveListingId);
  if (!weaveReviewed) throw new Error("Weave Bracelet reviewed baseline is missing.");
  const weaveVerification = verifyWeave(weaveLive, weaveReviewed);
  atomicJson(path.join(outDir, "weave-verification.json"), weaveVerification);

  const executionTime = new Date().toISOString();
  const executionDir = path.join(outDir, `execution-${executionTime.replace(/[:.]/g, "-")}`);
  fs.mkdirSync(executionDir, { recursive: true });
  const results = [];

  try {
    for (const change of approvedChanges) {
      const reviewed = reviewedBaseline.byId.get(change.listingId);
      const before = await readListing(change.listingId);
      assertLiveMatchesReviewedBaseline(change, before, reviewed);
      const rollback = {
        reviewed_baseline: reviewed,
        live_prewrite: before,
        reviewed_baseline_sha256: change.baselineSha256,
        live_prewrite_sha256: hashJson(before),
        captured_at: new Date().toISOString()
      };
      atomicJson(path.join(executionDir, `${change.listingId}-rollback.json`), rollback);
      const beforeForbidden = forbiddenSnapshot(before);

      process.env.ETSY_READ_ONLY_MODE = "false";
      process.env.ETSY_WRITE_APPROVED = "true";
      writeWindow = true;
      assertWriteGuard(change, reviewed, dailyWrites + results.length, officialScopes);
      await patchListing(change);
      writeWindow = false;
      process.env.ETSY_READ_ONLY_MODE = "true";
      process.env.ETSY_WRITE_APPROVED = "false";

      const after = await readListing(change.listingId);
      const verification = {
        title_exact: String(after.title ?? "") === change.title,
        tags_exact: JSON.stringify(normalizeTags(after.tags ?? [])) === JSON.stringify(change.tags),
        forbidden_fields_unchanged: JSON.stringify(forbiddenSnapshot(after)) === JSON.stringify(beforeForbidden),
        state_active: after.state === "active"
      };
      const verified = Object.values(verification).every(Boolean);
      const result = {
        listingId: change.listingId,
        product: change.product,
        status: "written",
        verified,
        verification,
        approved_title: change.title,
        approved_tags: change.tags,
        rollback_file: path.join(executionDir, `${change.listingId}-rollback.json`),
        rollback_sha256: change.baselineSha256,
        live_last_updated_timestamp: after.updated_timestamp ?? after.last_modified_timestamp ?? after.last_modified_tsz ?? null,
        trackingBaseline: {
          views: Number.isFinite(after.views) ? after.views : null,
          favorites: Number.isFinite(after.num_favorers) ? after.num_favorers : null,
          orders: "UNKNOWN_PENDING_CHECKPOINT_SYNC",
          revenue: "UNKNOWN_PENDING_CHECKPOINT_SYNC"
        }
      };
      results.push(result);
      atomicJson(path.join(executionDir, `${change.listingId}-verification.json`), result);
      if (!verified) throw new Error(`Exact verification failed for ${change.product}; stopped before next listing.`);
    }
  } finally {
    writeWindow = false;
    process.env.ETSY_READ_ONLY_MODE = "true";
    process.env.ETSY_WRITE_APPROVED = "false";
  }

  const trackingStartTime = new Date().toISOString();
  const tracking = {
    tracking_start_time: trackingStartTime,
    mode: "read_only_checkpoints",
    listings: trackingPlan(trackingStartTime, results)
  };
  atomicJson(path.join(outDir, "tracking.json"), tracking);
  const report = {
    executedAt: executionTime,
    allSuccessful: results.length === approvedChanges.length && results.every((result) => result.verified),
    officialScopes,
    baselineReportSha256: reviewedBaseline.reportHash,
    results,
    weaveVerification,
    rollbackStatus: results.every((result) => Boolean(result.rollback_file)) ? "COMPLETE" : "INCOMPLETE",
    readOnlyRestored: process.env.ETSY_READ_ONLY_MODE === "true" && process.env.ETSY_WRITE_APPROVED === "false",
    trackingStartTime,
    rateLimit,
    otherListingsModified: false,
    otherFieldsModified: false
  };
  if (!report.allSuccessful || !report.readOnlyRestored) throw new Error("Batch 3 did not finish in a verified read-only-restored state.");
  atomicJson(path.join(executionDir, "execution-report.json"), report);
  atomicJson(successMarker, report);
  console.log(`BATCH3_RESULT_JSON=${JSON.stringify(report)}`);
}

main().catch((error) => {
  writeWindow = false;
  process.env.ETSY_READ_ONLY_MODE = "true";
  process.env.ETSY_WRITE_APPROVED = "false";
  const failure = {
    executedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    readOnlyRestored: true,
    rateLimit
  };
  atomicJson(path.join(outDir, `batch-3-execution-failed-${failure.executedAt.replace(/[:.]/g, "-")}.json`), failure);
  console.error(`BATCH3_ERROR_JSON=${JSON.stringify(failure)}`);
  process.exitCode = 1;
});
