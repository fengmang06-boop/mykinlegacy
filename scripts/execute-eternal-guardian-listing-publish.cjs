const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const API_BASE = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const EXPECTED_SHOP_ID = "25333110";
const REQUEST_INTERVAL_MS = 1250;
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
if (String(process.env.ETSY_SHOP_ID || EXPECTED_SHOP_ID) !== EXPECTED_SHOP_ID) throw new Error("Unexpected Etsy shop ID");
if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") throw new Error("Initial ETSY_READ_ONLY_MODE must be true");
if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") throw new Error("Initial ETSY_WRITE_APPROVED must be false");

const planPath = path.resolve(arg("--plan"));
const assetDir = path.resolve(arg("--asset-dir"));
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const report = {
  operation: "ETERNAL_GUARDIAN_ETSY_PUBLISH",
  started_at: new Date().toISOString(),
  status: "STARTED",
  listing_id: null,
  listing_url: null,
  token: null,
  official_scopes: [],
  local_sku_collision_count: null,
  source_listing: null,
  readiness_definition: null,
  draft_verification: null,
  active_verification: null,
  uploaded_images: [],
  write_log: [],
  rate_limits: [],
  write_windows: [],
  rollback: { attempted: false, successful: null },
};

let accessToken = "";
let nextRequestAt = 0;
let latestRate = { limit_per_day: null, remaining_today: null, limit_per_second: null };
let writeWindowOpen = false;
let draftCreated = false;
let activated = false;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
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

function logRate(response, apiPath, operation) {
  const row = {
    timestamp: new Date().toISOString(),
    operation,
    path: apiPath,
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
  const reserve = Math.ceil((latestRate.limit_per_day * RESERVE_PERCENT) / 100);
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
    "/root",
    "mensskull-etsy-backups",
    "eternal-guardian-publish",
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
  const temp = `${envFile}.eternal-guardian-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);
  report.write_windows.push({
    timestamp: new Date().toISOString(),
    purpose,
    values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, /TOKEN|SECRET/i.test(key) ? "[REDACTED]" : value])),
    backup_dir: backupDir,
  });
  return backupDir;
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: process.env.ETSY_REFRESH_TOKEN,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);
  const token = JSON.parse(text);
  if (!token.access_token) throw new Error("Token refresh did not return an access token");
  const previousRefreshToken = process.env.ETSY_REFRESH_TOKEN;
  accessToken = token.access_token;
  const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  const backupDir = saveEnvValues({
    ETSY_ACCESS_TOKEN: token.access_token,
    ETSY_REFRESH_TOKEN: token.refresh_token || process.env.ETSY_REFRESH_TOKEN,
    ETSY_TOKEN_EXPIRES_AT: expiresAt,
    ETSY_TOKEN_SCOPE: token.scope || process.env.ETSY_TOKEN_SCOPE,
  }, "token-refresh");
  report.token = {
    refreshed: true,
    refresh_token_rotated: Boolean(token.refresh_token && token.refresh_token !== previousRefreshToken),
    expires_at: expiresAt,
    scope: token.scope || process.env.ETSY_TOKEN_SCOPE || null,
    backup_dir: backupDir,
  };
}

async function etsyRequest(apiPath, init = {}, operation = "READ") {
  assertReserve();
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
  logRate(response, apiPath, operation);
  const text = await response.text();
  if (response.status === 429) throw new Error(`HTTP 429 for ${apiPath}; stopped without retry: ${text}`);
  if ([401, 403, 409].includes(response.status)) throw new Error(`Immediate-stop HTTP ${response.status} for ${apiPath}: ${text}`);
  if (!response.ok) throw new Error(`Etsy request failed ${response.status} for ${apiPath}: ${text}`);
  assertReserve();
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

function collectSkus(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectSkus(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase() === "sku" && typeof item === "string") output.push(item.trim());
    else if (key.toLowerCase() === "skus" && Array.isArray(item)) output.push(...item.map(String).map((sku) => sku.trim()));
    else collectSkus(item, output);
  }
  return output;
}

async function assertSkuUnused() {
  const prisma = new PrismaClient();
  try {
    const listings = await prisma.listing.findMany({
      select: {
        etsyListingId: true,
        title: true,
        rawJson: true,
        inventory: { select: { rawJson: true } },
      },
    });
    const collisions = [];
    for (const listing of listings) {
      const values = [];
      for (const raw of [listing.rawJson, listing.inventory?.rawJson]) {
        if (!raw) continue;
        try { values.push(...collectSkus(JSON.parse(raw))); } catch {}
      }
      if (values.includes(plan.inventory.sku)) collisions.push({ listing_id: listing.etsyListingId, title: listing.title });
    }
    report.local_sku_collision_count = collisions.length;
    report.local_sku_collisions = collisions;
    if (collisions.length) throw new Error(`SKU ${plan.inventory.sku} already exists in production cache`);
  } finally {
    await prisma.$disconnect();
  }
}

function assertPlan() {
  if (plan.operation !== "ETERNAL_GUARDIAN_ETSY_PUBLISH") throw new Error("Unexpected operation plan");
  if (plan.authorization !== "USER_AUTHORIZED_NEW_LISTING_AND_SIX_IMAGES_2026_09_03") throw new Error("Exact user authorization is missing");
  if (String(plan.shop_id) !== EXPECTED_SHOP_ID) throw new Error("Plan shop ID mismatch");
  if (plan.inventory.sku !== "246" || plan.create_draft.quantity !== 8 || Number(plan.create_draft.price) !== 236) {
    throw new Error("Plan SKU, quantity, or price mismatch");
  }
  if (plan.create_draft.who_made !== "collective" || plan.create_draft.when_made !== "made_to_order") {
    throw new Error("Plan maker or production status mismatch");
  }
  if (plan.create_draft.title.length > 140 || plan.create_draft.tags.length !== 13 || new Set(plan.create_draft.tags).size !== 13) {
    throw new Error("Title or tags failed deterministic validation");
  }
  if (plan.create_draft.tags.some((tag) => tag.length > 20)) throw new Error("A tag exceeds 20 characters");
  const { integrity_sha256, ...payload } = plan;
  if (sha256(JSON.stringify(payload)) !== integrity_sha256) throw new Error("Plan integrity SHA-256 mismatch");
  if (!Array.isArray(plan.images) || plan.images.length !== 6) throw new Error("Exactly six images are required");
  for (const [index, image] of plan.images.entries()) {
    if (Number(image.rank) !== index + 1) throw new Error("Image ranks must be exactly 1 through 6");
    const file = path.join(assetDir, image.filename);
    if (!fs.existsSync(file)) throw new Error(`Missing deployment asset ${image.filename}`);
    if (sha256(fs.readFileSync(file)) !== image.sha256) throw new Error(`Asset SHA mismatch for ${image.filename}`);
  }
}

function firstReadinessState(inventory, listing) {
  const listingValue = Number(listing?.readiness_state_id);
  if (Number.isSafeInteger(listingValue) && listingValue > 0) return listingValue;
  for (const product of inventory?.products || []) {
    for (const offering of product?.offerings || []) {
      const value = Number(offering?.readiness_state_id);
      if (Number.isSafeInteger(value) && value > 0 && offering?.is_enabled !== false) return value;
    }
  }
  return null;
}

async function readSourceListing() {
  const listing = await etsyRequest(`/listings/${plan.source_listing_id}`, { method: "GET" }, "SOURCE_LISTING_READ");
  const inventory = await etsyRequest(`/listings/${plan.source_listing_id}/inventory?max_variations_supported=3`, { method: "GET" }, "SOURCE_INVENTORY_READ");
  if (String(listing.listing_id) !== String(plan.source_listing_id) || listing.state !== "active") throw new Error("Source listing is not active or mismatched");
  if (Number(listing.taxonomy_id) !== Number(plan.expected_source.taxonomy_id)) throw new Error("Source taxonomy drift detected");
  if (Number(listing.shipping_profile_id) !== Number(plan.expected_source.shipping_profile_id)) throw new Error("Source shipping profile drift detected");
  const readinessStateId = firstReadinessState(inventory, listing);
  if (!readinessStateId) throw new Error("No current readiness state found on source listing");
  const definitionsResponse = await etsyRequest(`/shops/${EXPECTED_SHOP_ID}/readiness-state-definitions`, { method: "GET" }, "READINESS_DEFINITION_READ");
  const definitions = Array.isArray(definitionsResponse?.results) ? definitionsResponse.results : [];
  const definition = definitions.find((item) => Number(item.readiness_state_id) === readinessStateId);
  if (!definition || String(definition.readiness_state) !== "made_to_order") {
    throw new Error("Source readiness state is not currently verified as made_to_order");
  }
  const returnPolicyId = Number(listing.return_policy_id);
  if (!Number.isSafeInteger(returnPolicyId) || returnPolicyId <= 0) throw new Error("Source listing has no valid return policy to inherit");
  report.source_listing = {
    listing_id: String(listing.listing_id),
    taxonomy_id: listing.taxonomy_id,
    shipping_profile_id: listing.shipping_profile_id,
    readiness_state_id: readinessStateId,
    return_policy_id: returnPolicyId,
    state: listing.state,
  };
  report.readiness_definition = {
    readiness_state_id: readinessStateId,
    readiness_state: definition.readiness_state,
    min_processing_time: definition.min_processing_time ?? null,
    max_processing_time: definition.max_processing_time ?? null,
    processing_time_unit: definition.processing_time_unit ?? null,
  };
  return { readinessStateId, returnPolicyId };
}

function openWriteWindow(purpose) {
  if (writeWindowOpen) throw new Error("Write window is already open");
  saveEnvValues({ ETSY_READ_ONLY_MODE: "false", ETSY_WRITE_APPROVED: "true" }, `${purpose}-open`);
  writeWindowOpen = true;
}

function closeWriteWindow(purpose) {
  saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, `${purpose}-close`);
  writeWindowOpen = false;
}

function assertWriteWindow() {
  if (!writeWindowOpen || process.env.ETSY_READ_ONLY_MODE !== "false" || process.env.ETSY_WRITE_APPROVED !== "true") {
    throw new Error("Exact write window is closed");
  }
}

async function createDraft(readinessStateId, returnPolicyId) {
  assertWriteWindow();
  const body = new URLSearchParams();
  const fields = {
    ...plan.create_draft,
    tags: plan.create_draft.tags.join(","),
    materials: plan.create_draft.materials.join(","),
    readiness_state_id: readinessStateId,
    return_policy_id: returnPolicyId,
  };
  for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
  const result = await etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }, "CREATE_DRAFT");
  if (!result?.listing_id) throw new Error("Draft creation did not return a listing ID");
  report.listing_id = String(result.listing_id);
  report.listing_url = result.url || null;
  draftCreated = true;
  report.write_log.push({ timestamp: new Date().toISOString(), operation: "CREATE_DRAFT", listing_id: report.listing_id, status: "WRITTEN" });
}

async function setInventory(readinessStateId) {
  assertWriteWindow();
  const body = {
    products: [{
      sku: plan.inventory.sku,
      offerings: [{
        quantity: plan.inventory.quantity,
        is_enabled: true,
        price: plan.inventory.price,
        readiness_state_id: readinessStateId,
      }],
      property_values: [],
    }],
    price_on_property: [],
    quantity_on_property: [],
    sku_on_property: [],
    readiness_state_on_property: [],
  };
  await etsyRequest(`/listings/${report.listing_id}/inventory?max_variations_supported=3`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "SET_INVENTORY");
  report.write_log.push({ timestamp: new Date().toISOString(), operation: "SET_INVENTORY", listing_id: report.listing_id, sku: plan.inventory.sku, status: "WRITTEN" });
}

async function uploadImages() {
  for (const image of plan.images) {
    assertWriteWindow();
    const file = path.join(assetDir, image.filename);
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(file)], { type: "image/png" }), image.filename);
    form.append("rank", String(image.rank));
    form.append("overwrite", "false");
    form.append("is_watermarked", "false");
    form.append("alt_text", image.alt_text);
    const result = await etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings/${report.listing_id}/images`, {
      method: "POST",
      body: form,
    }, "UPLOAD_IMAGE");
    const row = { rank: image.rank, filename: image.filename, sha256: image.sha256, listing_image_id: String(result.listing_image_id) };
    report.uploaded_images.push(row);
    report.write_log.push({ timestamp: new Date().toISOString(), operation: "UPLOAD_IMAGE", listing_id: report.listing_id, ...row, status: "WRITTEN" });
  }
}

async function readCreatedListing() {
  const listing = await etsyRequest(`/listings/${report.listing_id}`, { method: "GET" }, "VERIFY_LISTING_READ");
  const images = await etsyRequest(`/listings/${report.listing_id}/images`, { method: "GET" }, "VERIFY_IMAGES_READ");
  const inventory = await etsyRequest(`/listings/${report.listing_id}/inventory?max_variations_supported=3`, { method: "GET" }, "VERIFY_INVENTORY_READ");
  return { listing, images: Array.isArray(images?.results) ? images.results : [], inventory };
}

function verifyCreated(current, expectedState) {
  const listing = current.listing;
  const products = current.inventory?.products || [];
  const allSkus = products.map((product) => String(product.sku || ""));
  const offerings = products.flatMap((product) => product.offerings || []);
  const imageStack = current.images.map((image) => ({ id: String(image.listing_image_id), rank: Number(image.rank) })).sort((a, b) => a.rank - b.rank);
  const expectedStack = report.uploaded_images.map((image) => ({ id: image.listing_image_id, rank: image.rank }));
  const checks = {
    listing_id_exact: String(listing.listing_id) === report.listing_id,
    state_exact: String(listing.state) === expectedState,
    title_exact: String(listing.title) === plan.create_draft.title,
    description_exact: String(listing.description) === plan.create_draft.description,
    tags_exact: JSON.stringify(listing.tags || []) === JSON.stringify(plan.create_draft.tags),
    materials_exact: JSON.stringify(listing.materials || []) === JSON.stringify(plan.create_draft.materials),
    quantity_exact: Number(listing.quantity) === plan.create_draft.quantity,
    price_exact: money(listing.price) === Number(plan.create_draft.price),
    taxonomy_exact: Number(listing.taxonomy_id) === Number(plan.create_draft.taxonomy_id),
    shipping_profile_exact: Number(listing.shipping_profile_id) === Number(plan.create_draft.shipping_profile_id),
    return_policy_exact: Number(listing.return_policy_id) === Number(report.source_listing.return_policy_id),
    who_made_exact: String(listing.who_made) === plan.create_draft.who_made,
    when_made_exact: String(listing.when_made) === plan.create_draft.when_made,
    sku_exact: allSkus.length === 1 && allSkus[0] === plan.inventory.sku,
    inventory_quantity_exact: offerings.length === 1 && Number(offerings[0].quantity) === plan.inventory.quantity,
    inventory_price_exact: offerings.length === 1 && money(offerings[0].price) === plan.inventory.price,
    image_count_exact: imageStack.length === plan.images.length,
    image_ids_and_order_exact: JSON.stringify(imageStack) === JSON.stringify(expectedStack),
  };
  return { passed: Object.values(checks).every(Boolean), checks, image_stack: imageStack, skus: allSkus };
}

async function activateListing() {
  assertWriteWindow();
  await etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings/${report.listing_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ state: "active" }),
  }, "ACTIVATE_LISTING");
  activated = true;
  report.write_log.push({ timestamp: new Date().toISOString(), operation: "ACTIVATE_LISTING", listing_id: report.listing_id, status: "WRITTEN" });
}

async function deactivateOnVerificationFailure() {
  report.rollback.attempted = true;
  openWriteWindow("verification-rollback");
  try {
    await etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings/${report.listing_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ state: "inactive" }),
    }, "ROLLBACK_DEACTIVATE");
  } finally {
    closeWriteWindow("verification-rollback");
  }
  const current = await readCreatedListing();
  report.rollback.successful = String(current.listing.state) !== "active";
  if (!report.rollback.successful) throw new Error("Rollback deactivation verification failed");
}

async function main() {
  assertPlan();
  await assertSkuUnused();
  await refreshAccessToken();
  await verifyScopes();
  assertReserve(15);
  const { readinessStateId, returnPolicyId } = await readSourceListing();

  openWriteWindow("draft-construction");
  try {
    await createDraft(readinessStateId, returnPolicyId);
    await setInventory(readinessStateId);
    await uploadImages();
  } finally {
    closeWriteWindow("draft-construction");
  }

  const draft = await readCreatedListing();
  report.draft_verification = verifyCreated(draft, "draft");
  if (!report.draft_verification.passed) {
    report.status = "DRAFT_RETAINED_VERIFICATION_FAILED";
    throw new Error("Draft verification failed; listing was not activated");
  }

  openWriteWindow("activation");
  try {
    await activateListing();
  } finally {
    closeWriteWindow("activation");
  }

  const active = await readCreatedListing();
  report.active_verification = verifyCreated(active, "active");
  report.listing_url = active.listing.url || report.listing_url;
  if (!report.active_verification.passed) {
    await deactivateOnVerificationFailure();
    throw new Error("Active listing verification failed and rollback deactivation was applied");
  }

  report.status = "PUBLISHED_AND_API_VERIFIED";
  report.finished_at = new Date().toISOString();
  report.safety = {
    exact_new_listing_only: true,
    production_listing_creates: 1,
    production_image_uploads: 6,
    production_activations: 1,
    http_429_count: report.rate_limits.filter((row) => row.status === 429).length,
    final_quota: latestRate,
    etsy_read_only_mode: true,
    etsy_write_approved: false,
  };
}

main()
  .catch(async (error) => {
    if (activated && !report.rollback.attempted) {
      try { await deactivateOnVerificationFailure(); } catch (rollbackError) { report.rollback.error = String(rollbackError); }
    }
    if (report.status === "STARTED") report.status = draftCreated ? "HALTED_DRAFT_RETAINED" : "HALTED_NO_LISTING_CREATED";
    report.error = error instanceof Error ? error.message : String(error);
    report.finished_at = new Date().toISOString();
    report.safety = {
      exact_new_listing_only: true,
      production_listing_creates: draftCreated ? 1 : 0,
      production_image_uploads: report.uploaded_images.length,
      production_activations: activated ? 1 : 0,
      http_429_count: report.rate_limits.filter((row) => row.status === 429).length,
      final_quota: latestRate,
      etsy_read_only_mode: true,
      etsy_write_approved: false,
    };
    process.exitCode = 1;
  })
  .finally(() => {
    if (writeWindowOpen || process.env.ETSY_READ_ONLY_MODE !== "true" || process.env.ETSY_WRITE_APPROVED !== "false") {
      try { saveEnvValues({ ETSY_READ_ONLY_MODE: "true", ETSY_WRITE_APPROVED: "false" }, "final-safety-restore"); } catch (error) { report.final_restore_error = String(error); }
      writeWindowOpen = false;
    }
    report.integrity_sha256 = sha256(JSON.stringify(report));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  });
