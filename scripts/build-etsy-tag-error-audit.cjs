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
  'tag-error-audit'
);

const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

// Verified post-snapshot state. Only exact, completed writes belong here.
const overlays = {
  '4330006796': {
    tags: [
      'chain for men',
      'trouser chain',
      'wallet chain',
      'gifts for her',
      'gothic jewelry',
      'friend gift',
      'silver waist chain',
      'motorcycle chain',
      'Skull Pants Chain',
      'Biker Wallet Chain',
      'Gift for Him',
      "Men's Biker Jewelry",
      'Mens Fashion Chain'
    ],
    evidence: 'verified exact post-write readback 2026-09-02T10:40:57.936Z'
  },
  '1815479817': {
    title: 'Monkey Pendant Necklace in 925 Sterling Silver, Handmade Animal Totem Jewelry',
    tags: [
      'silver necklace',
      'mens necklace',
      'necklace for men',
      'monkey necklace',
      'monkey pendant',
      'silver monkey',
      'monkey gifts',
      'monkey king',
      'custom necklace',
      'pendant necklace',
      'necklace gift',
      'animal totem jewelry',
      'baby monkey'
    ],
    evidence: 'verified exact post-write readback 2026-09-02T11:22:54.238Z'
  }
};

const authoritativeMaterials = {
  '4330006796': ['925 silver'],
  '1792490833': ['999 silver'],
  '1635852221': ['999 silver', '925 silver']
};

const authoritativeMotifs = {
  '4387570273': ['cross', 'skull', 'bull']
};

const typePatterns = [
  ['pants_chain', /\b(?:pants|trouser|wallet|waist|belt)\s+chains?\b/i],
  ['keychain', /\b(?:keychains?|key\s+rings?)\b/i],
  ['bracelet', /\b(?:bracelets?|bangles?)\b/i],
  ['necklace', /\b(?:necklaces?|pendants?|amulets?)\b/i],
  ['earring', /\b(?:earrings?|ear\s+(?:studs?|cuffs?|climbers?)|stud\s+earrings?)\b/i],
  ['ring', /\brings?\b/i],
  ['brooch', /\b(?:brooches?|pins?)\b/i],
  ['lighter_case', /\blighter\s+(?:cases?|covers?)\b/i],
  ['shoe_buckle', /\b(?:shoe|boot)\s+buckles?\b/i],
  ['money_clip', /\bmoney\s+clips?\b/i],
  ['spoon', /\bspoons?\b/i],
  ['tray', /\b(?:trays?|bowls?|dishes?)\b/i]
];

const motifPatterns = [
  ['skull', /\bskulls?\b/i],
  ['wolf', /\bwol(?:f|ves)\b/i],
  ['lion', /\blions?\b/i],
  ['tiger', /\btigers?\b/i],
  ['snake', /\b(?:snakes?|serpents?|mambas?)\b/i],
  ['dragon', /\bdragons?\b/i],
  ['monkey', /\bmonkeys?\b/i],
  ['anubis', /\banubis\b/i],
  ['cross', /\bcross(?:es)?\b/i],
  ['angel', /\b(?:angels?|archangels?)\b/i],
  ['horse', /\bhorses?\b/i],
  ['clown', /\bclowns?\b/i],
  ['ram', /\brams?\b/i],
  ['bird', /\b(?:birds?|cranes?)\b/i],
  ['spider', /\bspiders?\b/i],
  ['rabbit', /\brabbits?\b/i],
  ['mermaid', /\bmermaids?\b/i],
  ['sunflower', /\bsunflowers?\b/i],
  ['nail', /\bnails?\b/i],
  ['fishbone', /\bfish\s*bones?\b/i],
  ['octopus', /\b(?:octopus|kraken)\b/i],
  ['bull', /\bbulls?\b/i],
  ['jaguar', /\bjaguars?\b/i],
  ['hippo', /\bhippos?\b/i],
  ['deer', /\bdeer\b/i],
  ['pumpkin', /\bpumpkins?\b/i],
  ['feather', /\bfeathers?\b/i],
  ['coffee', /\b(?:coffee|espresso|barista|caffeine)\b/i],
  ['dinosaur', /\bdinosaurs?\b/i]
];

const gemstonePatterns = [
  ['lapis lazuli', /\b(?:lapis|lapis lazuli)\b/i],
  ['red agate', /\bred\s+agate\b/i],
  ['blue topaz', /\bblue\s+topaz\b/i],
  ['ruby', /\brub(?:y|ies)\b/i],
  ['sapphire', /\bsapphires?\b/i],
  ['pearl', /\bpearls?\b/i]
];

const broadTags = new Set([
  'gift',
  'gift for him',
  'gift for her',
  'gifts for him',
  'gifts for her',
  'friend gift',
  'birthday gift',
  'unique gift',
  'fashion jewelry',
  'mens jewelry',
  "men's jewelry",
  'womens jewelry',
  "women's jewelry",
  'handmade jewelry',
  'silver jewelry'
]);

function normalize(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matches(text, patterns) {
  return patterns.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

function titleTypes(title) {
  return matches(title, typePatterns);
}

function tagTypes(tag) {
  return matches(tag, typePatterns);
}

function equivalentType(titleType, tagType) {
  if (titleType === tagType) return true;
  return false;
}

function materialsFromText(value) {
  const text = normalize(value);
  const found = new Set();
  const has999 = /\b(?:999|9999|fine|pure)\s+(?:sterling\s+)?silver\b|\bsilver\s+9999?\b/.test(text);
  const has925 = /\b925\s+(?:sterling\s+)?silver\b|\bsterling\s+silver\s+925\b|\bsilver\s+925\b/.test(text);
  if (has999) found.add('999 silver');
  if (has925 || (!has999 && /\bsterling\s+silver\b/.test(text))) found.add('925 silver');
  if (/\bstainless\s+steel\b/.test(text)) found.add('stainless steel');
  if (/\bbrass\b/.test(text)) found.add('brass');
  if (/\bcopper\b/.test(text)) found.add('copper');
  if (/\btitanium\b/.test(text)) found.add('titanium');
  return found;
}

function materialFromTag(tag) {
  const found = [...materialsFromText(tag)];
  if (/\b9999?\b/.test(normalize(tag)) && !found.includes('999 silver')) found.push('999 silver');
  if (/\b925\b/.test(normalize(tag)) && !found.includes('925 silver')) found.push('925 silver');
  return found.length === 1 ? found[0] : '';
}

function goldKarat(value) {
  const match = normalize(value).match(/\b(18|24)\s*k\b/);
  return match ? `${match[1]}K gold` : '';
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(fileName, rows) {
  const headers = [
    'severity',
    'listing_id',
    'sku',
    'title',
    'issues',
    'affected_tags',
    'tag_count',
    'all_tags',
    'evidence'
  ];
  const body = [headers.join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))];
  fs.writeFileSync(path.join(outputDir, fileName), `${body.join('\n')}\n`, 'utf8');
}

const rows = [];

for (const original of snapshot.listings) {
  const overlay = overlays[String(original.listing_id)];
  const listing = overlay ? { ...original, ...overlay } : original;
  const tags = Array.isArray(listing.tags) ? listing.tags.map(String) : [];
  const title = String(listing.title || '');
  const titleTypeSet = titleTypes(title);
  const titleMotifSet = new Set([
    ...matches(title, motifPatterns),
    ...(authoritativeMotifs[String(listing.listing_id)] || [])
  ]);
  const titleGemstones = new Set(matches(title, gemstonePatterns));
  const titleGoldKarat = goldKarat(title);
  const titleMaterials = materialsFromText(title);
  const sourceMaterials = materialsFromText((listing.materials || []).join(' | '));
  const knownMaterials = new Set(authoritativeMaterials[String(listing.listing_id)] || []);
  const confirmed = [];
  const confirmedTags = new Set();
  const review = [];
  const reviewTags = new Set();
  const opportunities = [];

  if (tags.length > 13) confirmed.push(`more than 13 tags (${tags.length})`);
  if (tags.length === 0) confirmed.push('no tags');
  if (tags.length > 0 && tags.length < 13) opportunities.push(`unused tag capacity (${tags.length}/13)`);

  const normalized = tags.map(normalize);
  const duplicateNames = [...new Set(normalized.filter((tag, index) => tag && normalized.indexOf(tag) !== index))];
  if (duplicateNames.length) {
    confirmed.push(`duplicate tags: ${duplicateNames.join(' | ')}`);
    duplicateNames.forEach((tag) => confirmedTags.add(tag));
  }

  for (const tag of tags) {
    const clean = normalize(tag);
    if (!clean) {
      confirmed.push('empty tag');
      continue;
    }
    if ([...tag].length > 20) {
      confirmed.push(`tag exceeds 20 characters: ${tag}`);
      confirmedTags.add(tag);
    }
    if (/&(?:amp|apos|quot|#0*39);/i.test(tag)) {
      confirmed.push(`HTML entity stored in tag: ${tag}`);
      confirmedTags.add(tag);
    }

    const detectedTagTypes = tagTypes(tag);
    if (titleTypeSet.length && detectedTagTypes.length) {
      const conflicting = detectedTagTypes.filter(
        (tagType) => !titleTypeSet.some((titleType) => equivalentType(titleType, tagType))
      );
      if (conflicting.length) {
        confirmed.push(`product-type conflict (${titleTypeSet.join('/')} vs ${conflicting.join('/')}): ${tag}`);
        confirmedTags.add(tag);
      }
    }

    const tagMaterial = materialFromTag(tag);
    if (tagMaterial) {
      const baseMaterials = knownMaterials.size ? knownMaterials : titleMaterials;
      const isSilverPurityConflict =
        (baseMaterials.has('999 silver') && tagMaterial === '925 silver') ||
        (baseMaterials.has('925 silver') && tagMaterial === '999 silver');
      const isAuthoritativeConflict = knownMaterials.size && !knownMaterials.has(tagMaterial);
      const sourceSupportsTag = sourceMaterials.has(tagMaterial);
      if (isAuthoritativeConflict || (isSilverPurityConflict && !sourceSupportsTag)) {
        confirmed.push(`material conflict (${[...baseMaterials].join('/')} vs ${tagMaterial}): ${tag}`);
        confirmedTags.add(tag);
      } else if (isSilverPurityConflict && sourceSupportsTag) {
        review.push(`silver purity conflicts across title/source/tag (${[...baseMaterials].join('/')} vs ${tagMaterial}): ${tag}`);
        reviewTags.add(tag);
      } else if (titleMaterials.size && !titleMaterials.has(tagMaterial) && !sourceMaterials.has(tagMaterial)) {
        review.push(`material not supported by title/source materials (${tagMaterial}): ${tag}`);
        reviewTags.add(tag);
      }
    }

    const tagGemstones = matches(tag, gemstonePatterns);
    for (const gemstone of tagGemstones) {
      if (titleGemstones.size && !titleGemstones.has(gemstone)) {
        confirmed.push(`gemstone conflict (${[...titleGemstones].join('/')} vs ${gemstone}): ${tag}`);
        confirmedTags.add(tag);
      }
    }

    const tagGoldKarat = goldKarat(tag);
    if (titleGoldKarat && tagGoldKarat && titleGoldKarat !== tagGoldKarat) {
      confirmed.push(`gold purity conflict (${titleGoldKarat} vs ${tagGoldKarat}): ${tag}`);
      confirmedTags.add(tag);
    }

    if (titleMotifSet.has('feather')) titleMotifSet.add('bird');
    const tagMotifs = matches(tag, motifPatterns).filter((motif) => !titleMotifSet.has(motif));
    for (const motif of tagMotifs) {
      if (motif === 'dog' && /\bdog\s+tags?\b/i.test(tag)) continue;
      review.push(`motif not stated in title (${motif}): ${tag}`);
      reviewTags.add(tag);
    }

    if (broadTags.has(clean)) opportunities.push(`broad tag: ${tag}`);
  }

  const uniqueConfirmed = [...new Set(confirmed)];
  const uniqueReview = [...new Set(review)];
  const uniqueOpportunities = [...new Set(opportunities)];
  const evidence = overlay?.evidence || `saved production snapshot ${snapshot.exported_at}`;

  let severity = 'PASS';
  if (uniqueConfirmed.length) severity = 'CONFIRMED_ERROR';
  else if (uniqueReview.length) severity = 'REVIEW_REQUIRED';
  else if (uniqueOpportunities.length) severity = 'OPTIMIZATION_ONLY';

  rows.push({
    severity,
    listing_id: listing.listing_id,
    sku: listing.sku || '',
    title,
    issues: [...uniqueConfirmed, ...uniqueReview, ...uniqueOpportunities],
    affected_tags: [...confirmedTags, ...reviewTags],
    tag_count: tags.length,
    all_tags: tags,
    evidence
  });
}

const confirmedRows = rows.filter((row) => row.severity === 'CONFIRMED_ERROR');
const reviewRows = rows.filter((row) => row.severity === 'REVIEW_REQUIRED');
const opportunityRows = rows.filter((row) => row.severity === 'OPTIMIZATION_ONLY');
const passRows = rows.filter((row) => row.severity === 'PASS');

fs.mkdirSync(outputDir, { recursive: true });
writeCsv('ETSY_TAG_AUDIT_ALL_215.csv', rows);
writeCsv('ETSY_TAG_ERROR_CONFIRMED.csv', confirmedRows);
writeCsv('ETSY_TAG_REVIEW_REQUIRED.csv', reviewRows);
writeCsv('ETSY_TAG_OPTIMIZATION_ONLY.csv', opportunityRows);

const report = [
  '# MENSSKULL Etsy Full-Shop Tag Error Audit',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Listings checked: ${rows.length}`,
  `- Confirmed tag errors: ${confirmedRows.length}`,
  `- Product-photo/content review required: ${reviewRows.length}`,
  `- Optimization only (not errors): ${opportunityRows.length}`,
  `- No issue found: ${passRows.length}`,
  `- Source: saved production export ${snapshot.exported_at}`,
  '- Current-state overlays: SK02 listing 4330006796 and SP237 listing 1815479817 exact verified readbacks from 2026-09-02.',
  '- No Etsy API call or write was made for this audit.',
  '',
  '## Confirmed Errors',
  '',
  ...(confirmedRows.length
    ? confirmedRows.map((row) => `- ${row.listing_id} / ${row.sku}: ${row.title}\n  - ${row.issues.join('; ')}`)
    : ['- None']),
  '',
  '## Review Required',
  '',
  ...(reviewRows.length
    ? reviewRows.map((row) => `- ${row.listing_id} / ${row.sku}: ${row.title}\n  - ${row.issues.join('; ')}`)
    : ['- None']),
  '',
  '## Interpretation',
  '',
  '- Confirmed errors can be repaired after a fresh listing baseline and exact-diff validation.',
  '- Review-required rows are not approved for editing until the product image or authoritative source confirms the motif.',
  '- Optimization-only rows are not product mismatches and should not displace higher-priority repairs.',
  ''
];

fs.writeFileSync(path.join(outputDir, 'ETSY_TAG_AUDIT_REPORT.md'), report.join('\n'), 'utf8');

console.log(JSON.stringify({
  checked: rows.length,
  confirmedErrors: confirmedRows.length,
  reviewRequired: reviewRows.length,
  optimizationOnly: opportunityRows.length,
  pass: passRows.length,
  outputDir
}, null, 2));
