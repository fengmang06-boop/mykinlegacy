const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(repoRoot, '..', '..');
const sourcePath = path.join(
  repoRoot,
  'codex_outputs',
  'growth-v2',
  'mission-001',
  'production-read-only-export.json'
);
const outputDir = path.join(
  workspaceRoot,
  'outputs',
  'mensskull-etsy-growth-v2',
  '2026-09-02',
  'sku-repair'
);

const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const listings = snapshot.listings.filter((listing) => String(listing.sku || '').trim());
const orderCounts = new Map();

for (const transaction of snapshot.transactions) {
  const listingId = String(transaction.listing_id);
  orderCounts.set(listingId, (orderCounts.get(listingId) || 0) + 1);
}

const groups = new Map();
for (const listing of listings) {
  const sku = String(listing.sku).trim();
  if (!groups.has(sku)) groups.set(sku, []);
  groups.get(sku).push(listing);
}

const duplicateGroups = [...groups.entries()]
  .filter(([, group]) => group.length > 1)
  .sort(([left], [right]) => left.localeCompare(right, 'en'));

const canonicalOverrides = new Map([
  ['SJ321', '1756185464'],
  ['SJ345', '4497064699'],
  ['SSB129', '4365584443'],
  ['SSB86', '944567983']
]);

const prioritySkus = new Set(['SJ321', 'SJ345', 'SSB129', 'SSB86']);
const occupied = new Set(listings.map((listing) => String(listing.sku).trim()));
const assigned = new Set();
const rows = [];

function ordersFor(listing) {
  return orderCounts.get(String(listing.listing_id)) || 0;
}

function canonicalFor(sku, group) {
  const override = canonicalOverrides.get(sku);
  if (override) {
    const selected = group.find((listing) => String(listing.listing_id) === override);
    if (!selected) throw new Error(`Missing canonical override ${sku}/${override}`);
    return selected;
  }

  return [...group].sort((left, right) => {
    const orderDelta = ordersFor(right) - ordersFor(left);
    if (orderDelta) return orderDelta;
    return Number(left.listing_id) - Number(right.listing_id);
  })[0];
}

function nextSku(base) {
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!occupied.has(candidate) && !assigned.has(candidate)) {
      assigned.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Unable to allocate suffix for ${base}`);
}

for (const [sku, group] of duplicateGroups) {
  const canonical = canonicalFor(sku, group);
  const ordered = [
    canonical,
    ...group
      .filter((listing) => listing !== canonical)
      .sort((left, right) => Number(left.listing_id) - Number(right.listing_id))
  ];

  for (const listing of ordered) {
    const keep = listing === canonical;
    rows.push({
      priority: prioritySkus.has(sku) ? 'P0' : 'BACKLOG',
      duplicate_sku: sku,
      listing_id: String(listing.listing_id),
      title: listing.title,
      state: listing.state,
      historical_transactions: ordersFor(listing),
      action: keep ? 'KEEP' : 'RENAME',
      proposed_sku: keep ? sku : nextSku(sku),
      canonical_reason: canonicalOverrides.has(sku)
        ? 'FOUNDER_PRODUCT_IDENTITY'
        : ordersFor(canonical) > 0
          ? 'HIGHEST_HISTORICAL_TRANSACTIONS'
          : 'EARLIEST_LISTING_ID_TIEBREAK',
      production_status: keep ? 'NO_WRITE_REQUIRED' : 'FRESH_INVENTORY_BASELINE_REQUIRED'
    });
  }
}

const proposed = rows.filter((row) => row.action === 'RENAME').map((row) => row.proposed_sku);
if (new Set(proposed).size !== proposed.length) throw new Error('Proposed SKU collision inside repair plan');
for (const sku of proposed) {
  if (occupied.has(sku)) throw new Error(`Proposed SKU already exists: ${sku}`);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filename, data) {
  const headers = Object.keys(data[0]);
  const body = [headers.join(','), ...data.map((row) => headers.map((header) => csvCell(row[header])).join(','))];
  fs.writeFileSync(path.join(outputDir, filename), `${body.join('\n')}\n`, 'utf8');
}

fs.mkdirSync(outputDir, { recursive: true });
writeCsv('DUPLICATE_SKU_ALL_GROUPS.csv', rows);
writeCsv('DUPLICATE_SKU_EXACT_RENAMES.csv', rows.filter((row) => row.action === 'RENAME'));

const renameRows = rows.filter((row) => row.action === 'RENAME');
const p0Rows = rows.filter((row) => row.priority === 'P0');
const p0RenameRows = p0Rows.filter((row) => row.action === 'RENAME');
const report = [
  '# MENSSKULL Duplicate SKU Repair Plan',
  '',
  `Generated from saved complete snapshot: ${snapshot.exported_at}`,
  '',
  '## Summary',
  '',
  `- Duplicate SKU groups: ${duplicateGroups.length}`,
  `- Listings in duplicate groups: ${rows.length}`,
  `- Listings retaining the original SKU: ${duplicateGroups.length}`,
  `- Listings requiring a unique SKU: ${renameRows.length}`,
  `- Proposed-SKU collisions: 0`,
  `- Production writes performed: 0`,
  '',
  '## Assignment Rule',
  '',
  '- Keep one canonical listing per exact duplicate SKU.',
  '- Founder identity overrides apply to SJ321, SJ345, SSB129 and SSB86.',
  '- Otherwise, the listing with the most saved historical transactions keeps the original SKU; ties use the lower listing ID.',
  '- Every other listing receives `-1`, `-2`, and so on, skipping every SKU already occupied anywhere in the 215-listing snapshot.',
  '- A production write still requires a fresh full inventory baseline, exact product-level SKU diff, complete inventory rollback and post-write verification.',
  '',
  '## P0 Exact Mapping',
  '',
  '| Current SKU | Listing ID | Product | Orders | Action | Target SKU |',
  '|---|---:|---|---:|---|---|',
  ...p0Rows.map((row) => `| ${row.duplicate_sku} | ${row.listing_id} | ${row.title.replace(/\|/g, '/')} | ${row.historical_transactions} | ${row.action} | ${row.proposed_sku} |`),
  '',
  '## Release Status',
  '',
  `The ${p0RenameRows.length} P0 renames are mapping-ready but not production-ready. Inventory must be read immediately before each write because Etsy inventory SKUs are product-level values and may vary by size. No title, description, material, price, quantity, variation, processing profile or image field is authorized to drift.`
];

fs.writeFileSync(path.join(outputDir, 'DUPLICATE_SKU_REPAIR_PLAN.md'), `${report.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  duplicateGroups: duplicateGroups.length,
  listingsInGroups: rows.length,
  renameCount: renameRows.length,
  p0RenameCount: p0RenameRows.length,
  collisions: 0,
  outputDir
}, null, 2));
