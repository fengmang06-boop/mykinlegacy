# SEO Existing-Query Uplift — Round 03

Date: 2026-08-11

Branch: `codex/seo-existing-query-uplift-20260810`

Scope: local candidate only; no production or indexing action

## Search evidence and decision

This round uses the latest sanitized Search Console evidence through 2026-08-09:

- Sitewide, the last seven complete days recorded 40 impressions, zero clicks, and average position 47.2.
- The 28-day view recorded 214 impressions, one click, 0.47% CTR, and average position 54.58.
- `personalized christmas gifts for family` accumulated 63 impressions across 23 active dates, zero clicks, and average position 81.65. This is the clearest medium-confidence seasonal query now visible.
- `family name gifts for christmas` recorded six impressions at average position 76; it remains low-confidence support evidence rather than a separate page target.
- The grandparents query group remains low-volume, so the existing guide and product page were connected instead of adding another URL.

The evidence supports strengthening the current Christmas page and internal paths. It does not support a new Christmas Journal article, a new landing page, or a change to the approved primary page intent.

## Implemented changes

### Christmas query alignment

- Assigned the observed phrase `personalized Christmas gifts for family` to the existing `/gifts/christmas-family` page.
- Preserved the locked title, H1, URL, Canonical, product contract, price, and primary intent.
- Added two concise on-page answers covering a shared whole-family Christmas gift and responsible use of a family-supplied name.
- Preserved the boundary against surname-based arms, invented ancestry, or unsupported family history.
- Added descriptive internal links to the Christmas product page from the existing family legacy and grandparents gift guides.
- Created no Christmas article and no duplicate page.

### Grandparents path completion

- Added the missing product-to-guide link from `/gifts/grandparents` to `/journal/personalized-gifts-for-grandparents`.
- Retained the existing guide-to-product links, producing a clear bidirectional informational-to-transactional path.
- Added no new URL and made no speculative content expansion from the single low-confidence query impression.

### Organic-path measurement

- Added privacy-safe Journal landing and Journal article view events.
- Added a sanitized `article_slug` dimension for article-level measurement.
- Added distinct CTA source labels on Gift pages, the three core SEO landing pages, Journal articles, and the Journal index.
- Added the internal CTA destination to GA4 only when it matches a strict same-site path pattern.
- Browser evidence confirmed payloads contain page path, page/source identifier, internal destination, step name, and anonymous flow ID only. No customer story, surname, email, phone, address, checkout data, payment data, or other PII is collected by these changes.

These events make the post-release path measurable from search landing page to `/create` without changing the customer journey.

## Locked elements preserved

- Christmas title: `Personalized Christmas Gift for the Whole Family | MyKinLegacy`
- Christmas H1: `A Christmas Gift the Whole Family Can Open and Keep Together`
- Christmas Canonical: `https://mykinlegacy.com/gifts/christmas-family`
- Christmas URL: `/gifts/christmas-family`
- Accurate deliverables: Final Crest, Heritage Certificate, Family Story, Meaning Behind Your Crest, Complete Collection
- New pages: 0
- New Christmas Journal articles: 0
- Checkout, price, Schema, sitemap, robots, and product-generation behavior: unchanged

## Verification

- Round-specific automated tests: 5/5 PASS.
- Targeted regression set: 48/48 PASS across six test files.
- Full suite: 379/379 PASS across 58 test files.
- Typecheck: PASS.
- Lint: PASS.
- Monorepo production build: PASS.
- `git diff --check`: PASS.
- Known build warnings about dynamic database orchestration imports, the Next.js ESLint plugin, and local filesystem speed remain unchanged and were not introduced by this round.

Browser QA used the production build locally:

- Christmas page at 390 × 844: HTTP 200, locked title/H1/Canonical correct, one H1, both new answers visible, no horizontal overflow.
- Christmas page at 1440 × 900: one H1 and no horizontal overflow.
- Grandparents product page: guide link visible and no horizontal overflow.
- Both affected Journal guides: required product/context links visible and no horizontal overflow.
- Journal index: one H1 and no horizontal overflow.
- Christmas and Heritage Gift hero clicks: correct source and `/create` destination observed.
- Journal landing and article view events: observed with the correct step and article identifier.
- Console and hydration errors: 0.
- Orders, Checkout Sessions, PaymentIntents, and customer records created: 0.

## Release state

- Production modified: NO.
- Indexing requests: 0.
- Sitemap submissions: 0.
- Production deployment: NOT PERFORMED.

## Measurement gate and exact next action

Submit the combined Round 01–03 local candidate for controlled production review. If approved, deploy once, then hold further on-page changes for at least 14 complete days while measuring:

1. Christmas-family query impressions, position, and clicks.
2. Journal and Gift landing views by page identifier.
3. CTA clicks by source and destination.
4. The share of organic landing sessions reaching `/create`.
5. Whether the grandparents and Christmas internal paths gain impressions without query cannibalization.

Do not begin a fourth on-page round before this measurement window identifies a real next constraint.
