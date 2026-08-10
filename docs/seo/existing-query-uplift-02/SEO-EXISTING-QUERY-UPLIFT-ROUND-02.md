# SEO Existing-Query Uplift — Round 02

Date: 2026-08-11

Branch: `codex/seo-existing-query-uplift-20260810`

Scope: local candidate only; no production or indexing action

## Search baseline used

The round follows the latest analyzed Google Search Console evidence through 2026-08-09:

- `legacy gift ideas` → `/journal/family-legacy-gift-ideas`, average position 12.5.
- `modern family crest ideas` → `/journal/how-to-create-a-modern-family-crest`, average position 20.
- `personalized family reunion gifts` → `/gifts/family-reunion`, 13 impressions and average position 36.8.
- Retirement and anniversary variants appeared against both informational articles and transactional gift pages, generally between positions 23 and 49.

No new URL was needed. The selected pages already have search visibility and sufficient content depth; the work therefore improves query alignment, click clarity, internal paths, and page-role separation.

## Implemented changes

### Legacy gift ideas guide

- Assigned the observed `legacy gift ideas` query to `/journal/family-legacy-gift-ideas`.
- Updated the meta title and description to lead with the observed phrase.
- Added a direct-answer sentence and clarified the ideas section heading.
- Changed the commercial continuation from the broad Collection page to `/family-legacy-gift`.
- Kept the article informational and retained its comparison of multiple gift formats.

### Modern family crest guide

- Assigned `modern family crest ideas` to the existing how-to article instead of creating another page.
- Updated the meta title and description for the observed ideas query while preserving the existing H1 and URL.
- Added a six-direction section organized by leading meaning: continuity, guidance, migration, resilience, protection, and preserved knowledge.
- Kept every direction evidence-led and retained the official-heraldry boundary.
- Continued the commercial path to `/symbolic-family-crest`.

### Family Reunion gift page

- Changed the transactional target to the observed plural phrase `personalized family reunion gifts`.
- Updated the title and description without changing the URL or core H1.
- Added a product-to-guide link to `/journal/family-reunion-gift-ideas`.
- Added explicit digital-delivery and no-physical-shipping language.
- Added questions that distinguish the Complete Collection from a generic reunion favor.

### Retirement and anniversary intent separation

- Gift pages now own transactional phrases:
  - `personalized retirement gift for father`
  - `personalized anniversary gift for parents`
- Journal articles now own informational comparison phrases:
  - `retirement gift ideas for father`
  - `anniversary gift ideas for parents`
- Each gift page links to its guide; each guide links back to its matching gift page.
- URLs, Canonicals, page count, price, and creation flow remain unchanged.

### Product contract correction

- Generic gift pages now list `Complete Collection` as the fifth deliverable.
- `Private Vault` remains the delivery method rather than being presented as a sixth or replacement deliverable.

## Verification

- New round-specific tests: 6/6 PASS.
- Targeted SEO regression set: 20/20 PASS.
- Full suite: 374/374 PASS across 57 test files.
- Typecheck: PASS.
- Lint: PASS.
- Monorepo build: PASS.
- Browser QA: seven affected article/product pages checked at 390 × 844 and 1440 × 900.
- All checked pages: HTTP 200, one H1, correct self-Canonical, required content and links present, no horizontal overflow.
- Structured data scripts present on every checked page.
- Article pages: zero console errors.
- Gift pages: the isolated web-only runner reports one expected 404 for `/api/v1/analytics/events` because the local API service is not started. No page resource, navigation, content, or rendering request failed; this condition predates and is independent of the SEO changes.

Known build warnings about dynamic database orchestration imports and the Next.js ESLint plugin remain unchanged and were not introduced by this round.

## Release state

- Production modified: NO.
- Indexing requests: 0.
- Sitemap submissions: 0.
- New pages: 0.
- Production release approval: NOT REQUESTED.

## Measurement gate and next action

After an approved production release, preserve the same URLs and measure for at least 14 complete days:

1. Query impressions and average position for the three observed query groups.
2. Search-result click-through for the revised titles.
3. Gift-page visits reaching `/create`.
4. Whether retirement and anniversary query-page overlap declines.

Do not create another content batch until the measurement window shows which supporting topic has real demand.
