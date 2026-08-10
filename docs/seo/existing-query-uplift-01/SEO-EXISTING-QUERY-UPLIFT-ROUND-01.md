# SEO Existing-Query Uplift — Round 01

Date: 2026-08-10

Branch: `codex/seo-existing-query-uplift-20260810`

Scope: local candidate only; no production or indexing action

## Baseline and decision

- Latest available Google Search Console date reviewed: 2026-08-09.
- Sitemap URLs: 51; SEO-capable public pages: approximately 45.
- Documented unique primary and long-tail targets: 60.
- Cumulative observed query rows: 47, with 214 impressions and 24 visible pages.
- Trailing seven complete days: 40 impressions, zero clicks, and eight visible pages.
- The site has enough initial page and keyword breadth to establish the project, but not enough ranking depth or authority to produce dependable organic growth yet.
- Round 01 therefore strengthens existing core pages before creating additional URLs.

## Query ownership guardrail

- Gift pages retain transactional intent.
- Journal pages retain ideas, education, and how-to intent.
- No URL was merged, redirected, deleted, duplicated, published, or submitted for indexing.
- Potential overlap around retirement and anniversary terms remains a later internal-link and intent-clarification task, not a reason to create more pages now.

## Changes

### `/heritage-gift`

- Reframed metadata around personalized family keepsakes and heritage gifts.
- Added evidence-led explanations that distinguish documented memories from invented ancestry.
- Added occasion, recipient, deliverable, example, and supporting-guide links.
- Local rendered word count: 565 mobile / 578 desktop.

### `/family-legacy-gift`

- Reframed metadata around family legacy gifts for meaningful moments.
- Added evidence-to-symbol process, recipient and occasion guidance, and the five-item product contract.
- Added contextual links to retirement, anniversary, family legacy ideas, and real examples.
- Local rendered word count: 545 mobile / 558 desktop.

### `/symbolic-family-crest`

- Reframed metadata around symbolic family crest meaning and design.
- Added meaning-before-decoration guidance, an evidence-led design process, and a clear heraldry boundary.
- Added contextual links to the educational crest guide, modern crest article, and real examples.
- Local rendered word count: 542 mobile / 555 desktop.

### Shared correctness

- Added a reusable optional content area to the SEO landing-page component without changing existing pages by default.
- Replaced the remaining `Family Legacy Certificate` references in gift-page implementation data with the approved `Heritage Certificate` term.
- Added regression tests for metadata, content depth, single-H1 output, product terminology, delivery language, heraldry boundaries, and internal links.

## Verification

- Targeted SEO regression tests: 4/4 PASS.
- Full test suite: 368/368 PASS across 56 test files.
- Typecheck: PASS.
- Lint: PASS.
- Monorepo build: PASS.
- Clean isolated web build after generated-cache reset: PASS.
- Browser QA at 390 × 844 and 1440 × 900: all three pages returned HTTP 200, used one H1, had no horizontal overflow, and produced zero console errors.
- Approved terms visible: `Heritage Certificate` and `Complete Collection`.
- Deprecated term visible: NO.

Known build warnings about dynamic database orchestration imports, the Next.js ESLint plugin, and a slow filesystem remain unchanged and are not introduced by this round.

## Next controlled round

Prioritize pages already receiving impressions rather than expanding URL count:

1. Improve `/journal/family-legacy-gift-ideas` for `legacy gift ideas` while preserving its informational role.
2. Improve `/journal/how-to-create-a-modern-family-crest` for modern crest idea/how-to variants.
3. Improve `/gifts/family-reunion` for `personalized family reunion gifts` and strengthen the path to `/create`.
4. Clarify internal anchors and page roles for retirement and anniversary query overlap.
5. Re-measure rankings, impressions, click-through, and qualified `/create` entries before authorizing new content clusters.

## Release state

- Production modified: NO.
- Indexing requests: 0.
- Production release approval: NOT REQUESTED.
