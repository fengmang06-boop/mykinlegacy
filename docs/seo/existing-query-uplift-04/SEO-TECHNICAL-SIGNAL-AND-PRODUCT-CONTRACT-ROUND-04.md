# SEO Technical Signal and Product Contract — Round 04

Date: 2026-08-11

Branch: `codex/seo-existing-query-uplift-20260810`

Scope: local candidate only; no production or indexing action

## Decision

No Search Console dataset newer than the 2026-08-09 cutoff is available, and Rounds 01–03 have not yet entered the production measurement window. This round therefore avoids another keyword, title, H1, URL, or article expansion pass.

The technical audit identified two deterministic issues that can be corrected without disturbing query ownership:

1. The sitemap assigned the current runtime date to every public URL. That made all 51 URLs appear newly modified whenever the sitemap was generated, even when their content had not changed.
2. The shared SEO landing-page preview showed Private Vault as if it were a deliverable and omitted Meaning Behind Your Crest from the visual product contract.

## Implemented changes

### Trustworthy sitemap modification signals

- Removed the runtime `new Date()` value from the shared sitemap output.
- Preserved all 51 canonical public URLs, their priorities, and change-frequency values.
- Added `lastModified` only to the nine Journal article URLs, using each article's maintained `updatedAt` field.
- Static pages, Gift pages, and Real Example pages now omit `lastmod` until an evidence-backed source date exists.
- No URL was added, removed, redirected, canonicalized differently, or submitted for indexing.

### Exact product contract on shared SEO pages

The shared preview now visibly presents the five approved deliverables:

1. Final Crest
2. Heritage Certificate
3. Family Story
4. Meaning Behind Your Crest
5. Complete Collection

Private Vault is now described as `Private Vault digital delivery`, keeping it in the correct role as the delivery method rather than a sixth or replacement deliverable.

This correction applies consistently to:

- `/heritage-gift`
- `/family-legacy-gift`
- `/symbolic-family-crest`
- `/family-crest-generator`
- The noindex legacy `/ai-family-crest-generator` rendering, without changing its noindex or Canonical controls

## Verification

- Round-specific tests: 2/2 PASS.
- Targeted SEO regression: 21/21 PASS across five test files.
- Full suite: 381/381 PASS across 59 test files.
- Typecheck: PASS.
- Lint: PASS.
- Monorepo production build: PASS.
- `git diff --check`: PASS.

Generated sitemap QA:

- HTTP: 200
- URL count: 51
- Journal URLs: 9
- Journal URLs with evidence-backed `lastmod`: 9
- Non-Journal URLs with unsupported `lastmod`: 0
- Observed article dates: 2026-07-14, 2026-07-16, and 2026-08-11

Rendered-page QA covered the four indexable shared landing pages at 360 × 800, 390 × 844, 430 × 932, and 1440 × 900:

- Single H1: PASS for every page and viewport
- Five approved deliverables visible: PASS
- Private Vault identified as delivery method: PASS
- Horizontal overflow: 0 failures
- Console and hydration errors: 0

Known build warnings about dynamic database orchestration imports, the Next.js ESLint plugin, and local filesystem speed remain unchanged and were not introduced by this round. Negative-path order rejection messages in the full test output are expected assertions; the full suite passed.

## Release state

- Production modified: NO.
- Indexing requests: 0.
- Sitemap submissions: 0.
- New pages or articles: 0.
- Titles, H1s, Meta descriptions, URLs, Canonicals, price, Checkout, and generation behavior: unchanged.

## Exact next action

Submit the combined Round 01–04 candidate for controlled production review. If approved, deploy the four rounds together, verify the live sitemap and shared landing-page previews, and then hold further on-page edits for at least 14 complete days so ranking and `/create` conversion changes can be measured against a stable production baseline.
