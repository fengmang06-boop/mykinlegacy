const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const SHOP_ID = "25333110";
const REQUEST_INTERVAL_MS = 1250;
const MAX_429_RETRIES = 2;
const RESERVE_PERCENT = 20;

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const clientId = process.env.ETSY_CLIENT_ID;
const clientSecret = process.env.ETSY_CLIENT_SECRET;
if (!clientId || !clientSecret || !process.env.ETSY_REFRESH_TOKEN) throw new Error("Missing Etsy OAuth configuration");
if (String(process.env.ETSY_SHOP_ID || SHOP_ID) !== SHOP_ID) throw new Error("Unexpected Etsy shop ID");
if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") throw new Error("Initial ETSY_READ_ONLY_MODE must be true");
if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") throw new Error("Initial ETSY_WRITE_APPROVED must be false");

const planPath = path.resolve(arg("--plan"));
const assetDir = path.resolve(arg("--asset-dir"));
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const report = {
  mission: "ETSY_GROWTH_V2_005",
  listing_id: String(plan.listing_id),
  started_at: new Date().toISOString(),
  status: "STARTED",
  write_log: [],
  rate_limits: [],
  protected_field_diff: [],
  rollback: { attempted: false, successful: null },
  write_window: [],
};
let accessToken = "";
let nextRequestAt = 0;
let latestRate = { limit_per_day: null, remaining_today: null, limit_per_second: null };
let writeWindowOpen = false;
let newImageIds = [];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || null;
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount);
  const divisor = Number(value.divisor);
  return Number.isFinite(amount) && Number.isFinite(divisor) && divisor ? amount / divisor : null;
}

function headerNumber(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function logRate(response, apiPath, attempt, operation) {
  const row = {
    timestamp: new Date().toISOString(),
    operation,
    path: apiPath,
    attempt,
    status: response.status,
    limit_per_second: headerNumber(response.headers, ["x-limit-per-second"]),
    remaining_this_second: headerNumber(response.headers, ["x-remaining-this-second", "x-remaining-this-secon"]),
    limit_per_day: headerNumber(response.headers, ["x-limit-per-day"]),
    remaining_today: headerNumber(response.headers, ["x-remaining-today"]),
    retry_after_seconds: headerNumber(response.headers, ["retry-after"]),
  };
  report.rate_limits.push(row);
  latestRate = {
    limit_per_day: row.limit_per_day ?? latestRate.limit_per_day,
    remaining_today: row.remaining_today ?? latestRate.remaining_today,
    limit_per_second: row.limit_per_second ?? latestRate.limit_per_second,
  };
  return row;
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
  const backupDir = path.join(
    "/root", "mensskull-etsy-backups", "growth-v2-mission005-image-only",
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${purpose}`,
  );
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(envFile, path.join(backupDir, ".env.local"));
  const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const keys = new Set(Object.keys(updates));
  const kept = fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  }).filter((line) => line.trim());
  const formatted = Object.entries(updates).map(([key, value]) => `${key}=${/[\s"#\\]/.test(value) ? JSON.stringify(value) : value}`);
  const temp = `${envFile}.mission005-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);
  const loggedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    /TOKEN|SECRET/i.test(key) ? "[REDACTED]" : value,
  ]));
  report.write_window.push({ timestamp: new Date().toISOString(), purpose, values: loggedValues, backup_dir: backupDir });
  return backupDir;
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: process.env.ETSY_REFRESH_TOKEN }),
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
  }, "token-refresh");
  report.token = { refreshed: true, expires_at: expiresAt, scope: token.scope || process.env.ETSY_TOKEN_SCOPE || null };
}

async function etsyRequest(apiPath, init = {}, operation = "READ") {
  assertReserve();
  for (let attempt = 1; attempt <= MAX_429_RETRIES + 1; attempt += 1) {
    await pace();
    const response = await fetch(`${API_BASE}${apiPath}`, {
      ...init,
      headers: {
        "x-api-key": `${clientId}:${clientSecret}`,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    const rate = logRate(response, apiPath, attempt, operation);
    const text = await response.text();
    if (response.status === 429 && attempt <= MAX_429_RETRIES) {
      await sleep(Math.max(1500, Number(rate.retry_after_seconds || 0) * 1000, 1250 * (2 ** (attempt - 1))));
      continue;
    }
    if (response.status === 429) throw new Error(`Persistent HTTP 429 for ${apiPath}: ${text}`);
    if ([401, 403, 409].includes(response.status)) throw new Error(`Immediate-stop HTTP ${response.status} for ${apiPath}: ${text}`);
    if (!response.ok) throw new Error(`Etsy request failed ${response.status} for ${apiPath}: ${text}`);
    assertReserve();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }
  throw new Error(`Unreachable request state for ${apiPath}`);
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

async function readCurrent() {
  const listing = await etsyRequest(`/listings/${plan.listing_id}?includes=Videos,Personalization,BuyerPrice`, { method: "GET" }, "SAFE_LISTING_READ");
  const images = await etsyRequest(`/listings/${plan.listing_id}/images`, { method: "GET" }, "SAFE_IMAGE_READ");
  const inventory = await etsyRequest(`/listings/${plan.listing_id}/inventory?max_variations_supported=3`, { method: "GET" }, "SAFE_INVENTORY_READ");
  return { listing, images: Array.isArray(images?.results) ? images.results.sort((a, b) => Number(a.rank) - Number(b.rank)) : [], inventory };
}

function protectedSnapshot(current) {
  const listing = current.listing;
  return {
    state: listing.state ?? null,
    title: listing.title ?? null,
    tags: Array.isArray(listing.tags) ? listing.tags : [],
    description_sha256: sha256(String(listing.description ?? "")),
    price: money(listing.price),
    buyer_price: money(listing.buyer_price),
    sale_price: money(listing.buyer_price) !== null && money(listing.price) !== null && money(listing.buyer_price) < money(listing.price) ? money(listing.buyer_price) : null,
    quantity: listing.quantity ?? null,
    shipping_profile_id: listing.shipping_profile_id ?? null,
    processing_profile_id: listing.processing_profile_id ?? null,
    readiness_state_id: listing.readiness_state_id ?? null,
    processing_min: listing.processing_min ?? null,
    processing_max: listing.processing_max ?? null,
    taxonomy_id: listing.taxonomy_id ?? null,
    inventory_sha256: sha256(JSON.stringify(current.inventory)),
    personalization_sha256: sha256(JSON.stringify(listing.personalization ?? listing.personalization_questions ?? null)),
  };
}

function imageStack(current) {
  return current.images.map((image, index) => ({
    listing_image_id: String(image.listing_image_id),
    rank: Number.isFinite(Number(image.rank)) ? Number(image.rank) : index + 1,
  }));
}

function assertPlan() {
  if (plan.mission !== "ETSY_GROWTH_V2_005") throw new Error("Unexpected mission plan");
  if (plan.authorization !== "MISSION_005_USER_AUTHORIZED_IMAGE_ONLY") throw new Error("Mission authorization is missing");
  if (!plan.listing_id || !["878616671", "4432511462"].includes(String(plan.listing_id))) throw new Error("Listing is not allowlisted");
  const { integrity_sha256, ...payload } = plan;
  if (sha256(JSON.stringify(payload)) !== integrity_sha256) throw new Error("Plan integrity SHA-256 mismatch");
  if (!Array.isArray(plan.images) || ![1, 2].includes(plan.images.length)) throw new Error("Plan must contain one or two images");
  for (const image of plan.images) {
    if (![1, 3].includes(Number(image.rank))) throw new Error("Only rank 1 and rank 3 are authorized");
    const file = path.join(assetDir, image.filename);
    if (!fs.existsSync(file)) throw new Error(`Missing deployment asset ${image.filename}`);
    if (sha256(fs.readFileSync(file)) !== image.sha256) throw new Error(`Deployment asset SHA mismatch for ${image.filename}`);
  }
}

function assertBaseline(current) {
  if (String(current.listing.listing_id) !== String(plan.listing_id)) throw new Error("Wrong listing returned by Etsy");
  if (String(current.listing.state) !== "active") throw new Error("Listing is not active");
  const liveProtected = protectedSnapshot(current);
  if (JSON.stringify(liveProtected) !== JSON.stringify(plan.baseline.protected_snapshot)) throw new Error("Protected baseline drift detected before write");
  if (Number(current.listing.updated_timestamp) !== Number(plan.baseline.updated_timestamp)) throw new Error("Listing updated timestamp drift detected before write");
  if (JSON.stringify(imageStack(current)) !== JSON.stringify(plan.baseline.image_stack)) throw new Error("Image stack drift detected before write");
  if (current.images.length + plan.images.length > 20) throw new Error("Image capacity would exceed Etsy maximum");
}

async function uploadImage(image) {
  if (!writeWindowOpen) throw new Error("Write window is closed");
  const file = path.join(assetDir, image.filename);
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(file)], { type: "image/jpeg" }), image.filename);
  form.append("rank", String(image.rank));
  form.append("overwrite", "false");
  form.append("is_watermarked", "false");
  form.append("alt_text", image.alt_text);
  const result = await etsyRequest(`/shops/${SHOP_ID}/listings/${plan.listing_id}/images`, { method: "POST", body: form }, "UPLOAD_IMAGE");
  const newId = String(result.listing_image_id);
  newImageIds.push(newId);
  report.write_log.push({ timestamp: new Date().toISOString(), listing_id: String(plan.listing_id), operation: "NON_DESTRUCTIVE_INSERT", rank: image.rank, image_sha256: image.sha256, new_listing_image_id: newId, status: "WRITTEN", api_status: 201 });
}

function compareProtected(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.map((field) => ({
    listing_id: String(plan.listing_id),
    field,
    before: before[field],
    after: after[field],
    changed: JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    expected: "UNCHANGED",
  }));
}

function assertPostImages(current) {
  const stack = imageStack(current);
  for (const image of plan.images) {
    const newId = newImageIds[plan.images.indexOf(image)];
    const actual = stack.find((item) => item.listing_image_id === newId);
    if (!actual || actual.rank !== Number(image.rank)) throw new Error(`New image ${newId} is not at authorized rank ${image.rank}`);
  }
  const originals = stack.filter((item) => plan.baseline.image_stack.some((original) => original.listing_image_id === item.listing_image_id));
  if (originals.length !== plan.baseline.image_stack.length) throw new Error("One or more original images disappeared after insertion");
  const beforeOrder = plan.baseline.image_stack.map((item) => item.listing_image_id);
  const afterOrder = originals.map((item) => item.listing_image_id);
  if (JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder)) throw new Error("Original image relative order changed unexpectedly");
}

async function rollback() {
  report.rollback.attempted = true;
  if (writeWindowOpen) {
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "emergency-close-before-rollback");
    writeWindowOpen = false;
  }
  saveEnvValues({ ETSY_READ_ONLY_MODE: "false", ETSY_WRITE_APPROVED: "true" }, "rollback-open");
  writeWindowOpen = true;
  try {
    for (const imageId of [...newImageIds].reverse()) {
      await etsyRequest(`/shops/${SHOP_ID}/listings/${plan.listing_id}/images/${imageId}`, { method: "DELETE" }, "ROLLBACK_DELETE_IMAGE");
      report.write_log.push({ timestamp: new Date().toISOString(), listing_id: String(plan.listing_id), operation: "ROLLBACK_DELETE_EXPERIMENT_IMAGE", new_listing_image_id: imageId, status: "DELETED", api_status: 204 });
    }
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "rollback-close");
    writeWindowOpen = false;
  }
  const restored = await readCurrent();
  const restoredProtected = protectedSnapshot(restored);
  const restoredStack = imageStack(restored);
  const exact = JSON.stringify(restoredProtected) === JSON.stringify(plan.baseline.protected_snapshot) && JSON.stringify(restoredStack) === JSON.stringify(plan.baseline.image_stack);
  report.rollback.successful = exact;
  report.rollback.restored_image_stack = restoredStack;
  if (!exact) throw new Error("Rollback verification failed");
}

async function main() {
  assertPlan();
  await refreshAccessToken();
  await verifyScopes();
  const before = await readCurrent();
  assertBaseline(before);
  report.prewrite = {
    captured_at: new Date().toISOString(),
    protected_snapshot: protectedSnapshot(before),
    image_stack: imageStack(before),
    updated_timestamp: before.listing.updated_timestamp,
    daily_quota: latestRate,
  };
  saveEnvValues({ ETSY_READ_ONLY_MODE: "false", ETSY_WRITE_APPROVED: "true" }, "exact-image-write-open");
  writeWindowOpen = true;
  try {
    for (const image of [...plan.images].sort((a, b) => Number(a.rank) - Number(b.rank))) await uploadImage(image);
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "exact-image-write-close");
    writeWindowOpen = false;
  }
  const after = await readCurrent();
  report.protected_field_diff = compareProtected(plan.baseline.protected_snapshot, protectedSnapshot(after));
  const unexpected = report.protected_field_diff.filter((item) => item.changed);
  if (unexpected.length) {
    await rollback();
    throw new Error(`Unexpected protected field changes: ${unexpected.map((item) => item.field).join(", ")}`);
  }
  assertPostImages(after);
  report.postwrite = {
    captured_at: new Date().toISOString(),
    protected_snapshot: protectedSnapshot(after),
    image_stack: imageStack(after),
    raw_listing: after.listing,
    raw_images: after.images,
    raw_inventory: after.inventory,
  };
  report.status = "WRITTEN_AND_API_VERIFIED";
  report.finished_at = new Date().toISOString();
  report.safety = {
    exact_fields_modified: ["IMAGES"],
    protected_unexpected_diffs: 0,
    etsy_read_only_mode: true,
    etsy_write_approved: false,
    production_image_writes: plan.images.length,
    http_429_count: report.rate_limits.filter((row) => row.status === 429).length,
    quota_final: latestRate,
  };
}

main()
  .catch(async (error) => {
    report.status = "DEPLOYMENT_HALTED";
    report.error = error instanceof Error ? error.message : String(error);
    if (newImageIds.length && !report.rollback.attempted) {
      try { await rollback(); } catch (rollbackError) { report.rollback.error = rollbackError instanceof Error ? rollbackError.message : String(rollbackError); }
    }
    report.finished_at = new Date().toISOString();
    report.safety = {
      exact_fields_modified: newImageIds.length ? ["IMAGES"] : [],
      protected_unexpected_diffs: report.protected_field_diff.filter((item) => item.changed).length,
      etsy_read_only_mode: true,
      etsy_write_approved: false,
      production_image_writes: report.write_log.filter((item) => item.operation === "NON_DESTRUCTIVE_INSERT").length,
      http_429_count: report.rate_limits.filter((row) => row.status === 429).length,
      quota_final: latestRate,
    };
    process.exitCode = 1;
  })
  .finally(() => {
    if (writeWindowOpen || String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true" || String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") {
      try { saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "final-safety-restore"); } catch (error) { report.final_restore_error = String(error); }
      writeWindowOpen = false;
    }
    report.integrity_sha256 = sha256(JSON.stringify(report));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  });
