const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const API_BASE = 'https://openapi.etsy.com/v3/application';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const STATUS_URL = 'https://tools.mensskull.com/api/etsy/status';
const RESERVE_PERCENT = 20;
const REQUEST_INTERVAL_MS = 1250;

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnv();

const planPath = path.resolve(arg('--plan'));
const reportPath = path.resolve(arg('--report'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const prisma = new PrismaClient();
const report = {
  mission: 'EXACT_SKU_ONLY_REPAIR',
  batch_key: plan.batch_key,
  listing_id: String(plan.listing_id),
  started_at: new Date().toISOString(),
  status: 'STARTED',
  requests: [],
  rollback: { attempted: false, successful: null }
};

let accessToken = '';
let nextRequestAt = 0;
let latestRate = { limit_per_day: null, remaining_today: null };
let writeWindowOpen = false;
let writeCompleted = false;
let beforeState = null;

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.from(String(value))).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
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
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) throw new Error('Production .env.local not found');
  const root = path.join('/root', 'mensskull-etsy-backups', 'exact-sku-only', report.started_at.replace(/[:.]/g, '-'));
  fs.mkdirSync(root, { recursive: true });
  const backup = path.join(root, `${String(report.write_windows?.length + 1 || 1).padStart(2, '0')}-${purpose}.env.local`);
  fs.copyFileSync(envFile, backup);
  fs.chmodSync(backup, 0o600);

  const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const keys = new Set(Object.keys(updates));
  const kept = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  }).filter((line) => line.trim());
  const formatted = Object.entries(updates).map(([key, value]) => `${key}=${/[\s"#\\]/.test(value) ? JSON.stringify(value) : value}`);
  const temp = `${envFile}.sku-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join('\n')}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);
  report.write_windows ||= [];
  report.write_windows.push({ timestamp: new Date().toISOString(), purpose, backup });
}

function assertPlan() {
  const { integrity_sha256, ...payload } = plan;
  if (sha256(stableJson(payload)) !== integrity_sha256) throw new Error('Plan integrity SHA-256 mismatch');
  if (plan.mission !== 'EXACT_SKU_ONLY_REPAIR') throw new Error('Unexpected mission');
  if (!/^\d+$/.test(String(plan.listing_id)) || String(plan.shop_id) !== '25333110') throw new Error('Unexpected target');
  if (plan.authorization?.founder_authorized !== true || plan.authorization?.scope !== 'sku_only') {
    throw new Error('Exact Founder SKU authorization is missing');
  }
  if (!plan.expected_before?.sku || !plan.proposed?.sku || plan.expected_before.sku === plan.proposed.sku) {
    throw new Error('Invalid exact SKU diff');
  }
  if (!plan.proposed.sku.startsWith(`${plan.expected_before.sku}-`)) throw new Error('Target SKU violates suffix policy');
  if (plan.limits.listings_written_today_before + 1 > plan.limits.max_listings_per_day) throw new Error('Daily listing limit exceeded');
  if (plan.validation?.target_sku_unoccupied_in_complete_snapshot !== true || plan.validation?.rollback_required !== true) {
    throw new Error('Plan safety validation is incomplete');
  }
}

async function checkStatus() {
  const response = await fetch(STATUS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Production status unavailable: ${response.status}`);
  const status = await response.json();
  const refreshable = status.env?.refreshTokenPresent === true && status.env?.tokenPresent === true;
  if (status.connected !== true || (status.env?.tokenExpired === true && !refreshable)) throw new Error('Etsy connection/token unavailable');
  if (status.env?.readOnlyMode !== true || status.env?.writeApproved !== false) throw new Error('Production guards are not fail-closed');
  if (status.env?.hasListingsWriteScope !== true) throw new Error('Stored listings_w scope is missing');
  const limit = Number(status.rateLimit?.limitPerDay);
  const remaining = Number(status.rateLimit?.remainingToday);
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || remaining < Math.ceil(limit * RESERVE_PERCENT / 100)) {
    throw new Error('Etsy quota is below reserve');
  }
  latestRate = { limit_per_day: limit, remaining_today: remaining };
  report.production_status = { checked_at: new Date().toISOString(), rate_limit: status.rateLimit };
}

async function refreshToken() {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ETSY_CLIENT_ID,
      refresh_token: process.env.ETSY_REFRESH_TOKEN
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);
  const token = JSON.parse(text);
  if (!token.access_token) throw new Error('Token refresh returned no access token');
  accessToken = token.access_token;
  saveEnvValues({
    ETSY_ACCESS_TOKEN: token.access_token,
    ETSY_REFRESH_TOKEN: token.refresh_token || process.env.ETSY_REFRESH_TOKEN,
    ETSY_TOKEN_EXPIRES_AT: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    ETSY_TOKEN_SCOPE: token.scope || process.env.ETSY_TOKEN_SCOPE
  }, 'safe-token-refresh');
}

async function etsyRequest(apiPath, init = {}, operation = 'READ') {
  assertReserve(1);
  await pace();
  const response = await fetch(`${API_BASE}${apiPath}`, {
    ...init,
    headers: {
      'x-api-key': `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.headers || {})
    }
  });
  const row = {
    timestamp: new Date().toISOString(),
    operation,
    path: apiPath,
    status: response.status,
    limit_per_day: headerNumber(response.headers, ['x-limit-per-day']),
    remaining_today: headerNumber(response.headers, ['x-remaining-today'])
  };
  report.requests.push(row);
  latestRate = {
    limit_per_day: row.limit_per_day ?? latestRate.limit_per_day,
    remaining_today: row.remaining_today ?? latestRate.remaining_today
  };
  const text = await response.text();
  if (response.status === 429) {
    const error = new Error(`HTTP 429 for ${apiPath}; stopped with no retry`);
    error.isRateLimit = true;
    throw error;
  }
  if (!response.ok) throw new Error(`Etsy request failed ${response.status} for ${apiPath}: ${text}`);
  assertReserve(1);
  return text ? JSON.parse(text) : null;
}

function flattenScopes(value) {
  if (Array.isArray(value)) return value.flatMap(flattenScopes);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (value && typeof value === 'object') return flattenScopes(value.scopes ?? value.scope ?? value.results ?? value.permissions);
  return [];
}

async function verifyScopes() {
  const body = await etsyRequest('/scopes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: accessToken })
  }, 'SCOPE_PROBE');
  const scopes = [...new Set(flattenScopes(body))].sort();
  if (!scopes.includes('listings_r') || !scopes.includes('listings_w')) throw new Error(`Required scopes missing: ${scopes.join(' ')}`);
  report.official_scopes = scopes;
}

async function databaseEvidence() {
  const listing = await prisma.listing.findUnique({
    where: { etsyListingId: String(plan.listing_id) },
    select: { id: true, etsyListingId: true, title: true, state: true, lastSyncedAt: true }
  });
  if (!listing) throw new Error('Target listing is missing from production database');
  const orders = await prisma.etsyTransaction.count({ where: { etsyListingId: String(plan.listing_id) } });
  if (orders !== 0) throw new Error(`Target has ${orders} saved transaction(s); this zero-order package is invalid`);
  if (listing.title !== plan.expected_before.title || listing.state !== plan.expected_before.state) throw new Error('Cached listing identity/state mismatch');
  report.database_evidence = { ...listing, orders, lastSyncedAt: listing.lastSyncedAt?.toISOString() ?? null };
}

async function readCurrent() {
  const listing = await etsyRequest(`/listings/${plan.listing_id}`, { method: 'GET' }, 'SAFE_LISTING_READ');
  const inventory = await etsyRequest(`/listings/${plan.listing_id}/inventory?max_variations_supported=3`, { method: 'GET' }, 'SAFE_INVENTORY_READ');
  return { listing, inventory };
}

async function verifyCanonicalListing() {
  const canonicalId = String(plan.canonical_listing.listing_id);
  const listing = await etsyRequest(`/listings/${canonicalId}`, { method: 'GET' }, 'SAFE_CANONICAL_LISTING_READ');
  const inventory = await etsyRequest(`/listings/${canonicalId}/inventory?max_variations_supported=3`, { method: 'GET' }, 'SAFE_CANONICAL_INVENTORY_READ');
  const skus = inventorySkus(inventory);
  if (String(listing.listing_id) !== canonicalId || String(listing.shop_id) !== String(plan.shop_id) || listing.state !== 'active') {
    throw new Error('Canonical listing identity/state mismatch');
  }
  if (stableJson(skus) !== stableJson([plan.expected_before.sku])) {
    throw new Error(`Canonical listing does not retain ${plan.expected_before.sku}: ${skus.join(', ')}`);
  }
  report.canonical_evidence = {
    listing_id: canonicalId,
    title: listing.title,
    state: listing.state,
    skus
  };
}

function moneyNumber(money) {
  const amount = Number(money?.amount);
  const divisor = Number(money?.divisor);
  if (!Number.isFinite(amount) || !Number.isFinite(divisor) || divisor <= 0) throw new Error('Invalid inventory price');
  return amount / divisor;
}

function inventoryPayload(inventory, sku) {
  if (!Array.isArray(inventory?.products) || !inventory.products.length) throw new Error('Inventory has no products');
  return {
    products: inventory.products.filter((product) => product.is_deleted !== true).map((product) => ({
      sku,
      property_values: (product.property_values || []).map((property) => ({
        property_id: property.property_id,
        property_name: property.property_name,
        ...(property.scale_id ? { scale_id: property.scale_id } : {}),
        value_ids: property.value_ids || [],
        values: property.values || []
      })),
      offerings: (product.offerings || []).filter((offering) => offering.is_deleted !== true).map((offering) => ({
        price: moneyNumber(offering.price),
        quantity: offering.quantity,
        is_enabled: offering.is_enabled,
        ...(offering.readiness_state_id ? { readiness_state_id: offering.readiness_state_id } : {})
      }))
    })),
    price_on_property: inventory.price_on_property || [],
    quantity_on_property: inventory.quantity_on_property || [],
    sku_on_property: inventory.sku_on_property || [],
    ...(Array.isArray(inventory.readiness_state_on_property)
      ? { readiness_state_on_property: inventory.readiness_state_on_property }
      : {})
  };
}

function inventoryWithoutSku(inventory) {
  return {
    products: (inventory.products || []).filter((product) => product.is_deleted !== true).map((product) => ({
      property_values: product.property_values || [],
      offerings: (product.offerings || []).filter((offering) => offering.is_deleted !== true).map((offering) => ({
        quantity: offering.quantity,
        is_enabled: offering.is_enabled,
        price: offering.price,
        readiness_state_id: offering.readiness_state_id ?? null
      }))
    })),
    price_on_property: inventory.price_on_property || [],
    quantity_on_property: inventory.quantity_on_property || [],
    sku_on_property: inventory.sku_on_property || [],
    readiness_state_on_property: inventory.readiness_state_on_property || []
  };
}

function inventorySkus(inventory) {
  return [...new Set((inventory.products || []).filter((product) => product.is_deleted !== true).map((product) => String(product.sku || '')))];
}

function assertPrewrite(current) {
  if (String(current.listing.listing_id) !== String(plan.listing_id) || String(current.listing.shop_id) !== String(plan.shop_id)) throw new Error('Wrong listing/shop returned');
  if (current.listing.state !== plan.expected_before.state || current.listing.title !== plan.expected_before.title) throw new Error('Live identity/state drift');
  const skus = inventorySkus(current.inventory);
  if (stableJson(skus) !== stableJson([plan.expected_before.sku])) throw new Error(`Inventory SKU drift or variation-specific SKUs found: ${skus.join(', ')}`);
}

function saveRollback(current) {
  const root = path.join(process.cwd(), 'exports', 'exact-sku-repair', plan.batch_key);
  const rollback = {
    mission: plan.mission,
    authorization: plan.authorization,
    captured_at: new Date().toISOString(),
    listing_id: String(plan.listing_id),
    before: current,
    rollback_payload: inventoryPayload(current.inventory, plan.expected_before.sku),
    exact_write_payload: inventoryPayload(current.inventory, plan.proposed.sku)
  };
  rollback.integrity_sha256 = sha256(stableJson(rollback));
  atomicJson(path.join(root, 'rollback.json'), rollback);
  report.rollback.path = path.join(root, 'rollback.json');
  report.rollback.integrity_sha256 = rollback.integrity_sha256;
}

async function putInventory(payload, operation) {
  if (!writeWindowOpen) throw new Error('Write window is closed');
  return etsyRequest(`/listings/${plan.listing_id}/inventory?max_variations_supported=3`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, operation);
}

async function rollbackInventory() {
  report.rollback.attempted = true;
  saveEnvValues({ ETSY_READ_ONLY_MODE: 'false', ETSY_WRITE_APPROVED: 'true' }, 'exact-rollback-open');
  writeWindowOpen = true;
  try {
    await putInventory(inventoryPayload(beforeState.inventory, plan.expected_before.sku), 'ROLLBACK_INVENTORY');
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: 'true', ETSY_WRITE_APPROVED: 'false' }, 'exact-rollback-close');
    writeWindowOpen = false;
  }
  const restored = await readCurrent();
  report.rollback.successful = stableJson(inventorySkus(restored.inventory)) === stableJson([plan.expected_before.sku]) &&
    stableJson(inventoryWithoutSku(restored.inventory)) === stableJson(inventoryWithoutSku(beforeState.inventory));
  if (!report.rollback.successful) throw new Error('Inventory rollback verification failed');
}

async function main() {
  assertPlan();
  if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== 'true' || String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== 'false') {
    throw new Error('Initial production guards are not fail-closed');
  }
  await checkStatus();
  await databaseEvidence();
  await refreshToken();
  await verifyScopes();
  beforeState = await readCurrent();
  assertPrewrite(beforeState);
  await verifyCanonicalListing();
  saveRollback(beforeState);
  report.prewrite = {
    captured_at: new Date().toISOString(),
    title: beforeState.listing.title,
    state: beforeState.listing.state,
    inventory_sha256: sha256(stableJson(beforeState.inventory)),
    non_sku_inventory_sha256: sha256(stableJson(inventoryWithoutSku(beforeState.inventory))),
    skus: inventorySkus(beforeState.inventory),
    product_count: beforeState.inventory.products.length
  };

  saveEnvValues({ ETSY_READ_ONLY_MODE: 'false', ETSY_WRITE_APPROVED: 'true' }, 'exact-sku-write-open');
  writeWindowOpen = true;
  try {
    await putInventory(inventoryPayload(beforeState.inventory, plan.proposed.sku), 'PUT_EXACT_SKU_ONLY');
    writeCompleted = true;
  } finally {
    saveEnvValues({ ETSY_READ_ONLY_MODE: 'true', ETSY_WRITE_APPROVED: 'false' }, 'exact-sku-write-close');
    writeWindowOpen = false;
  }

  const afterState = await readCurrent();
  const verification = {
    sku_exact: stableJson(inventorySkus(afterState.inventory)) === stableJson([plan.proposed.sku]),
    non_sku_inventory_unchanged: stableJson(inventoryWithoutSku(afterState.inventory)) === stableJson(inventoryWithoutSku(beforeState.inventory)),
    title_unchanged: afterState.listing.title === beforeState.listing.title,
    state_active: afterState.listing.state === 'active'
  };
  report.postwrite = {
    captured_at: new Date().toISOString(),
    inventory_sha256: sha256(stableJson(afterState.inventory)),
    non_sku_inventory_sha256: sha256(stableJson(inventoryWithoutSku(afterState.inventory))),
    skus: inventorySkus(afterState.inventory)
  };
  report.verification = verification;
  if (Object.values(verification).some((value) => value !== true)) {
    await rollbackInventory();
    throw new Error(`Exact verification failed: ${Object.entries(verification).filter(([, value]) => !value).map(([key]) => key).join(', ')}`);
  }

  report.status = 'WRITTEN_AND_EXACTLY_VERIFIED';
  report.finished_at = new Date().toISOString();
  report.safety = {
    exact_fields_modified: ['inventory.products[].sku'],
    other_inventory_fields_modified: false,
    title_modified: false,
    read_only_restored: true,
    write_approved_restored: false,
    http_429_count: report.requests.filter((request) => request.status === 429).length,
    quota_final: latestRate
  };
}

main()
  .catch(async (error) => {
    report.status = 'HALTED';
    report.error = error instanceof Error ? error.message : String(error);
    if (writeCompleted && !report.rollback.attempted && !error?.isRateLimit) {
      try { await rollbackInventory(); } catch (rollbackError) { report.rollback.error = rollbackError instanceof Error ? rollbackError.message : String(rollbackError); }
    }
    report.finished_at = new Date().toISOString();
    report.safety = {
      exact_fields_modified: writeCompleted ? ['inventory.products[].sku'] : [],
      read_only_restored: String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() === 'true',
      write_approved_restored: String(process.env.ETSY_WRITE_APPROVED).toLowerCase() === 'false',
      http_429_count: report.requests.filter((request) => request.status === 429).length,
      quota_final: latestRate
    };
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== 'true' || String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== 'false') {
        saveEnvValues({ ETSY_READ_ONLY_MODE: 'true', ETSY_WRITE_APPROVED: 'false' }, 'final-fail-closed');
      }
      const { integrity_sha256, ...payload } = report;
      report.integrity_sha256 = sha256(stableJson(payload));
      atomicJson(reportPath, report);
    } finally {
      await prisma.$disconnect();
    }
  });
