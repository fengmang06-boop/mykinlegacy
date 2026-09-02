const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const STATUS_URL = "https://tools.mensskull.com/api/etsy/status";
const SHOP_ID = "25333110";
const LISTING_ID = "4330006796";
const RESERVE_PERCENT = 20;
const REQUEST_INTERVAL_MS = 1250;

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnv();

const planPath = path.resolve(arg("--plan"));
const reportPath = path.resolve(arg("--report"));
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const prisma = new PrismaClient();

const report = {
  mission: "SK02_EXACT_MATERIAL_TAG_REPAIR",
  listing_id: LISTING_ID,
  approval_reference: plan.authorization.approval_reference,
  started_at: new Date().toISOString(),
  status: "STARTED",
  requests: [],
  write_windows: [],
  rollback: { attempted: false, successful: null },
};

let accessToken = "";
let nextRequestAt = 0;
let latestRate = { limit_per_day: null, remaining_today: null };
let writeWindowOpen = false;
let writeCompleted = false;
let beforeState = null;

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headerNumber(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function assertReserve(requiredCalls = 1) {
  if (!Number.isFinite(latestRate.limit_per_day) || !Number.isFinite(latestRate.remaining_today)) return;
  const reserve = Math.ceil(latestRate.limit_per_day * RESERVE_PERCENT / 100);
  if (latestRate.remaining_today - requiredCalls < reserve) {
    throw new Error(`Quota reserve reached: ${latestRate.remaining_today}/${latestRate.limit_per_day}`);
  }
}

async function pace() {
  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait) await sleep(wait);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

function saveEnvValues(values, purpose) {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) throw new Error("Production .env.local not found");
  const root = path.join("/root", "mensskull-etsy-backups", "sk02-exact-material-tags", report.started_at.replace(/[:.]/g, "-"));
  fs.mkdirSync(root, { recursive: true });
  const backup = path.join(root, `${String(report.write_windows.length + 1).padStart(2, "0")}-${purpose}.env.local`);
  fs.copyFileSync(envFile, backup);
  fs.chmodSync(backup, 0o600);

  const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const keys = new Set(Object.keys(updates));
  const kept = fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  }).filter((line) => line.trim());
  const formatted = Object.entries(updates).map(([key, value]) => `${key}=${/[\s"#\\]/.test(value) ? JSON.stringify(value) : value}`);
  const temp = `${envFile}.sk02-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);

  report.write_windows.push({
    timestamp: new Date().toISOString(),
    purpose,
    values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, /TOKEN|SECRET/i.test(key) ? "[REDACTED]" : value])),
    backup,
  });
}

function assertInitialGuards() {
  if (String(process.env.ETSY_SHOP_ID || SHOP_ID) !== SHOP_ID) throw new Error("Unexpected Etsy shop ID");
  if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") throw new Error("Initial ETSY_READ_ONLY_MODE must be true");
  if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") throw new Error("Initial ETSY_WRITE_APPROVED must be false");
  if (!process.env.ETSY_CLIENT_ID || !process.env.ETSY_CLIENT_SECRET || !process.env.ETSY_REFRESH_TOKEN) {
    throw new Error("Missing Etsy OAuth configuration");
  }
}

function assertPlan() {
  const { integrity_sha256, ...payload } = plan;
  if (sha256(JSON.stringify(payload)) !== integrity_sha256) throw new Error("Plan integrity SHA-256 mismatch");
  if (plan.mission !== "SK02_EXACT_MATERIAL_TAG_REPAIR") throw new Error("Unexpected mission");
  if (String(plan.listing_id) !== LISTING_ID || String(plan.shop_id) !== SHOP_ID || plan.sku !== "SK02") {
    throw new Error("Plan target is not the exact authorized listing");
  }
  if (plan.authorization.founder_authorized !== true || plan.authorization.scope !== "materials_and_two_tags_only") {
    throw new Error("Exact Founder authorization is missing");
  }
  if (plan.proposed.materials.length !== 1 || plan.proposed.materials[0] !== "925 sterling silver") {
    throw new Error("Unauthorized materials target");
  }
  if (plan.proposed.title !== plan.expected_before.title) throw new Error("Title change is not authorized");
  if (plan.proposed.tags.length !== 13 || new Set(plan.proposed.tags.map((item) => item.toLowerCase())).size !== 13) {
    throw new Error("Proposed tags must contain exactly 13 unique values");
  }
  const removed = plan.expected_before.tags.filter((tag) => !plan.proposed.tags.includes(tag));
  const added = plan.proposed.tags.filter((tag) => !plan.expected_before.tags.includes(tag));
  if (stableJson(removed) !== stableJson(["tactical keychain", "silver keychain"]) ||
      stableJson(added) !== stableJson(["silver waist chain", "motorcycle chain"])) {
    throw new Error("Tag diff exceeds the exact authorization");
  }
  if (plan.validation.repair_priority_score < 85 || plan.review.reviewer_confidence < 90 || plan.review.decision !== "GREEN") {
    throw new Error("Independent validation thresholds are not satisfied");
  }
}

async function checkProductionStatus() {
  const response = await fetch(STATUS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Production status unavailable: ${response.status}`);
  const status = await response.json();
  if (status.connected !== true || status.env?.readyForReadOnlySync !== true || status.env?.tokenExpired === true) {
    throw new Error("Production Etsy connection/token is not ready");
  }
  if (status.env?.readOnlyMode !== true || status.env?.writeApproved !== false) throw new Error("Production guards are not fail-closed");
  if (status.env?.hasListingsWriteScope !== true) throw new Error("Stored listings_w scope is missing");
  const limit = Number(status.rateLimit?.limitPerDay);
  const remaining = Number(status.rateLimit?.remainingToday);
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || remaining < Math.ceil(limit * RESERVE_PERCENT / 100)) {
    throw new Error("Production Etsy quota is below the 20% reserve");
  }
  latestRate = { limit_per_day: limit, remaining_today: remaining };
  report.production_status = {
    checked_at: new Date().toISOString(),
    connected: true,
    token_expired: false,
    read_only: true,
    write_approved: false,
    listings_w_stored: true,
    rate_limit: status.rateLimit,
  };
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_CLIENT_ID,
      refresh_token: process.env.ETSY_REFRESH_TOKEN,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);
  const token = JSON.parse(text);
  if (!token.access_token) throw new Error("Token refresh did not return an access token");
  accessToken = token.access_token;
  const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  saveEnvValues({
    ETSY_ACCESS_TOKEN: token.access_token,
    ETSY_REFRESH_TOKEN: token.refresh_token || process.env.ETSY_REFRESH_TOKEN,
    ETSY_TOKEN_EXPIRES_AT: expiresAt,
    ETSY_TOKEN_SCOPE: token.scope || process.env.ETSY_TOKEN_SCOPE,
  }, "safe-token-refresh");
  report.token = { refreshed: true, expires_at: expiresAt, scope: token.scope || process.env.ETSY_TOKEN_SCOPE || null };
}

async function etsyRequest(apiPath, init = {}, operation = "READ") {
  assertReserve(1);
  await pace();
  const response = await fetch(`${API_BASE}${apiPath}`, {
    ...init,
    headers: {
      "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const row = {
    timestamp: new Date().toISOString(),
    operation,
    path: apiPath,
    status: response.status,
    limit_per_day: headerNumber(response.headers, ["x-limit-per-day"]),
    remaining_today: headerNumber(response.headers, ["x-remaining-today"]),
    retry_after_seconds: headerNumber(response.headers, ["retry-after"]),
  };
  report.requests.push(row);
  latestRate = {
    limit_per_day: row.limit_per_day ?? latestRate.limit_per_day,
    remaining_today: row.remaining_today ?? latestRate.remaining_today,
  };
  const text = await response.text();
  if (response.status === 429) {
    const error = new Error(`HTTP 429 for ${apiPath}; stopped with no retry`);
    error.isRateLimit = true;
    throw error;
  }
  if (!response.ok) throw new Error(`Etsy request failed ${response.status} for ${apiPath}: ${text}`);
  assertReserve(1);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function flattenScopes(value) {
  if (Array.isArray(value)) return value.flatMap(flattenScopes);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  if (value && typeof value === "object") return flattenScopes(value.scopes ?? value.scope ?? value.results ?? value.permissions);
  return [];
}

async function verifyScopes() {
  const body = await etsyRequest("/scopes", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  }, "SCOPE_PROBE");
  const scopes = [...new Set(flattenScopes(body))].sort();
  if (!scopes.includes("listings_r") || !scopes.includes("listings_w")) throw new Error(`Required scopes missing: ${scopes.join(" ")}`);
  report.official_scopes = scopes;
}

async function databaseEvidence() {
  const listing = await prisma.listing.findUnique({
    where: { etsyListingId: LISTING_ID },
    select: { id: true, etsyListingId: true, title: true, state: true, tags: true, materials: true, lastSyncedAt: true },
  });
  if (!listing) throw new Error("SK02 listing is missing from the production database");
  const orders = await prisma.etsyTransaction.count({ where: { etsyListingId: LISTING_ID } });
  if (orders !== 0) throw new Error(`Listing has ${orders} saved Etsy transaction(s); protected`);
  if (listing.title !== plan.expected_before.title || listing.state !== "active") throw new Error("Saved listing identity/state does not match the authorized target");
  report.database_evidence = {
    canonical_listing_id: listing.id,
    etsy_listing_id: listing.etsyListingId,
    sku: "SK02",
    orders,
    state: listing.state,
    last_synced_at: listing.lastSyncedAt?.toISOString() ?? null,
    cached_tags_sha256: sha256(listing.tags),
    cached_materials_sha256: sha256(listing.materials),
  };
}

async function readCurrent() {
  const listing = await etsyRequest(`/listings/${LISTING_ID}?includes=Videos,Personalization,BuyerPrice`, { method: "GET" }, "SAFE_LISTING_READ");
  const images = await etsyRequest(`/listings/${LISTING_ID}/images`, { method: "GET" }, "SAFE_IMAGE_READ");
  const inventory = await etsyRequest(`/listings/${LISTING_ID}/inventory?max_variations_supported=3`, { method: "GET" }, "SAFE_INVENTORY_READ");
  return {
    listing,
    images: Array.isArray(images?.results) ? images.results.sort((a, b) => Number(a.rank) - Number(b.rank)) : [],
    inventory,
  };
}

function protectedListing(listing) {
  const dynamicOrAuthorized = new Set([
    "tags", "materials", "views", "num_favorers", "updated_timestamp", "last_modified_timestamp", "state_timestamp",
  ]);
  return Object.fromEntries(Object.entries(listing).filter(([key]) => !dynamicOrAuthorized.has(key)));
}

function imageStack(images) {
  return images.map((image, index) => ({
    listing_image_id: String(image.listing_image_id),
    rank: Number.isFinite(Number(image.rank)) ? Number(image.rank) : index + 1,
  }));
}

function snapshot(current) {
  return {
    protected_listing_sha256: sha256(stableJson(protectedListing(current.listing))),
    image_stack: imageStack(current.images),
    inventory_sha256: sha256(stableJson(current.inventory)),
    title: current.listing.title,
    tags: current.listing.tags,
    materials: current.listing.materials,
    state: current.listing.state,
    views: current.listing.views ?? null,
    favorites: current.listing.num_favorers ?? null,
    updated_timestamp: current.listing.updated_timestamp ?? current.listing.last_modified_timestamp ?? null,
  };
}

function assertPrewrite(current) {
  const listing = current.listing;
  if (String(listing.listing_id) !== LISTING_ID || String(listing.shop_id) !== SHOP_ID) throw new Error("Etsy returned the wrong listing/shop");
  if (listing.state !== "active") throw new Error("SK02 is not active");
  if (listing.title !== plan.expected_before.title) throw new Error("Title drift detected before write");
  if (stableJson(listing.tags) !== stableJson(plan.expected_before.tags)) throw new Error("Tag drift detected before write");
  if (Number(listing.updated_timestamp) !== Number(plan.expected_before.updated_timestamp)) throw new Error("Updated timestamp drift detected before write");
  if (!Array.isArray(listing.materials) || !listing.materials.includes("999 Pure Silver") ||
      !listing.materials.some((item) => /925|sterling/i.test(item))) {
    throw new Error("The exact confirmed 925/999 materials conflict is not present; stopped");
  }
  if (current.images.length !== 10 || current.images.some((image, index) => String(image.listing_image_id) !== plan.expected_before.image_ids[index])) {
    throw new Error("Image order drift detected before write");
  }
}

function saveRollback(current) {
  const root = path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3", plan.batch_key);
  const rollback = {
    mission: plan.mission,
    authorization: plan.authorization,
    captured_at: new Date().toISOString(),
    listing_id: LISTING_ID,
    before: current,
    exact_patch: { tags: plan.proposed.tags, materials: plan.proposed.materials },
  };
  rollback.integrity_sha256 = sha256(stableJson(rollback));
  atomicJson(path.join(root, "rollback.json"), rollback);
  report.rollback.path = path.join(root, "rollback.json");
  report.rollback.integrity_sha256 = rollback.integrity_sha256;
}

async function patchExact(tags, materials, operation) {
  if (!writeWindowOpen) throw new Error("Write window is closed");
  return etsyRequest(`/shops/${SHOP_ID}/listings/${LISTING_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tags: tags.join(","), materials: materials.join(",") }),
  }, operation);
}

async function rollbackAuthorizedFields() {
  report.rollback.attempted = true;
  if (!beforeState) throw new Error("Rollback baseline is unavailable");
  saveEnvValues({ ETSY_READ_ONLY_MODE: "false", ETSY_WRITE_APPROVED: "true" }, "exact-rollback-open");
  writeWindowOpen = true;
  try {
    await patchExact(beforeState.listing.tags, beforeState.listing.materials, "ROLLBACK_EXACT_FIELDS");
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "exact-rollback-close");
    writeWindowOpen = false;
  }
  const restored = await readCurrent();
  const restoredSnapshot = snapshot(restored);
  const originalSnapshot = snapshot(beforeState);
  const exact = stableJson(restoredSnapshot.tags) === stableJson(originalSnapshot.tags) &&
    stableJson(restoredSnapshot.materials) === stableJson(originalSnapshot.materials) &&
    restoredSnapshot.protected_listing_sha256 === originalSnapshot.protected_listing_sha256 &&
    stableJson(restoredSnapshot.image_stack) === stableJson(originalSnapshot.image_stack) &&
    restoredSnapshot.inventory_sha256 === originalSnapshot.inventory_sha256;
  report.rollback.successful = exact;
  if (!exact) throw new Error("Rollback verification failed");
}

function writeTracking(after) {
  const started = new Date().toISOString();
  const checkpoints = [["D1", 1], ["D3", 3], ["D7", 7], ["D14", 14]];
  const tracking = {
    tracking_start_time: started,
    mode: "read_only_checkpoints",
    listings: [{
      listing_id: LISTING_ID,
      product: "Sterling Silver Skull Pants Chain (SK02)",
      baseline: {
        views: Number.isFinite(Number(after.listing.views)) ? Number(after.listing.views) : null,
        favorites: Number.isFinite(Number(after.listing.num_favorers)) ? Number(after.listing.num_favorers) : null,
        orders: 0,
        revenue: 0,
      },
      checkpoints: checkpoints.map(([checkpoint, days]) => ({
        checkpoint,
        due_at: new Date(new Date(started).getTime() + days * 86_400_000).toISOString(),
        status: "pending",
      })),
    }],
  };
  const file = path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3", plan.batch_key, "tracking.json");
  atomicJson(file, tracking);
  report.tracking = { file, ...tracking };
}

async function main() {
  assertInitialGuards();
  assertPlan();
  await checkProductionStatus();
  await databaseEvidence();
  await refreshAccessToken();
  await verifyScopes();

  beforeState = await readCurrent();
  assertPrewrite(beforeState);
  const before = snapshot(beforeState);
  report.prewrite = { captured_at: new Date().toISOString(), ...before };
  saveRollback(beforeState);

  saveEnvValues({ ETSY_READ_ONLY_MODE: "false", ETSY_WRITE_APPROVED: "true" }, "exact-material-tags-write-open");
  writeWindowOpen = true;
  try {
    await patchExact(plan.proposed.tags, plan.proposed.materials, "PATCH_EXACT_MATERIALS_AND_TAGS");
    writeCompleted = true;
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "exact-material-tags-write-close");
    writeWindowOpen = false;
  }

  const afterState = await readCurrent();
  const after = snapshot(afterState);
  report.postwrite = { captured_at: new Date().toISOString(), ...after };
  const verification = {
    title_unchanged: after.title === before.title,
    tags_exact: stableJson(after.tags) === stableJson(plan.proposed.tags),
    materials_exact: stableJson(after.materials) === stableJson(plan.proposed.materials),
    state_active: after.state === "active",
    protected_listing_unchanged: after.protected_listing_sha256 === before.protected_listing_sha256,
    image_order_unchanged: stableJson(after.image_stack) === stableJson(before.image_stack),
    inventory_unchanged: after.inventory_sha256 === before.inventory_sha256,
  };
  report.verification = verification;
  if (Object.values(verification).some((value) => value !== true)) {
    await rollbackAuthorizedFields();
    throw new Error(`Exact verification failed: ${Object.entries(verification).filter(([, value]) => !value).map(([key]) => key).join(", ")}`);
  }

  writeTracking(afterState);
  report.status = "WRITTEN_AND_EXACTLY_VERIFIED";
  report.finished_at = new Date().toISOString();
  report.safety = {
    exact_fields_modified: ["materials", "tags"],
    title_modified: false,
    other_fields_modified: false,
    read_only_restored: true,
    write_approved_restored: false,
    http_429_count: report.requests.filter((item) => item.status === 429).length,
    quota_final: latestRate,
  };
}

main()
  .catch(async (error) => {
    report.status = "HALTED";
    report.error = error instanceof Error ? error.message : String(error);
    if (writeCompleted && !report.rollback.attempted && !error?.isRateLimit) {
      try { await rollbackAuthorizedFields(); } catch (rollbackError) { report.rollback.error = rollbackError instanceof Error ? rollbackError.message : String(rollbackError); }
    }
    report.finished_at = new Date().toISOString();
    report.safety = {
      exact_fields_modified: writeCompleted ? ["materials", "tags"] : [],
      read_only_restored: true,
      write_approved_restored: false,
      http_429_count: report.requests.filter((item) => item.status === 429).length,
      quota_final: latestRate,
    };
    process.exitCode = 1;
  })
  .finally(async () => {
    if (writeWindowOpen || String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true" || String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") {
      try { saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "final-safety-restore"); } catch (error) { report.final_restore_error = String(error); }
      writeWindowOpen = false;
    }
    await prisma.$disconnect().catch(() => undefined);
    report.integrity_sha256 = sha256(stableJson(report));
    atomicJson(reportPath, report);
    process.stdout.write(`SK02_RESULT_JSON=${JSON.stringify({
      status: report.status,
      listing_id: report.listing_id,
      verification: report.verification ?? null,
      rollback: report.rollback,
      safety: report.safety,
      tracking: report.tracking ? { tracking_start_time: report.tracking.tracking_start_time, checkpoints: report.tracking.listings[0].checkpoints } : null,
      integrity_sha256: report.integrity_sha256,
    })}\n`);
  });
