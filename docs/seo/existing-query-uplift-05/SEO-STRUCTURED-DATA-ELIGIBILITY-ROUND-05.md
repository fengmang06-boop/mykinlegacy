# SEO Structured Data Eligibility — Round 05

Date: 2026-08-11

Branch: `codex/seo-existing-query-uplift-20260810`

Scope: local candidate only; no production or indexing action

## Decision

No Search Console dataset newer than the 2026-08-09 cutoff is available, and Rounds 01–04 have not yet entered a production measurement window. This round makes no keyword, Title, Meta, H1, URL, Canonical, or visible-content changes.

Google currently limits FAQ rich results to well-known authoritative government and health websites. Google also states that FAQ structured data on other sites has no visible effect in Search. MyKinLegacy is a commercial family-keepsake site, so FAQPage is not an eligible search feature for its pages.

Project implementation was inconsistent before this round:

- Christmas Gift and all Journal articles already emitted zero FAQPage objects.
- Homepage, seven non-Christmas Gift pages, and all shared SEO landing pages still emitted FAQPage.
- Visible FAQ content existed on every affected page and remains useful to visitors.

## Implemented changes

- Removed FAQPage JSON-LD from the Homepage.
- Removed FAQPage JSON-LD from all Gift landing pages.
- Removed FAQPage JSON-LD from the shared SEO landing-page component.
- Kept all visible FAQ headings, questions, answers, and layouts unchanged.
- Kept eligible page-purpose structured data unchanged:
  - Organization
  - WebSite
  - WebPage
  - Product and Offer
  - Article
  - BreadcrumbList
  - ItemList where already implemented
- Added regression coverage preventing FAQPage markup from returning while confirming visible FAQ rendering remains in source.

## Official basis

- Google Search Central, FAQ and HowTo rich-result change: https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Google Search Central, General Structured Data Guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies

The change is a signal-consistency cleanup. It does not claim a direct ranking increase, and it does not remove useful FAQ content from customers.

## Verification

- Round-specific tests: 2/2 PASS.
- Targeted Schema regression: 36/36 PASS across five test files.
- Full suite: 383/383 PASS across 60 test files.
- Typecheck: PASS.
- Lint: PASS.
- Monorepo production build: PASS.
- `git diff --check`: PASS.

Rendered production-build QA covered:

- `/`
- `/gifts/fathers-day`
- `/gifts/christmas-family`
- `/heritage-gift`
- `/family-legacy-collection`
- `/journal/family-legacy-gift-ideas`
- `/real-examples`

Results:

- HTTP 200: 7/7
- Single H1: 7/7
- Horizontal overflow at 390 × 844: 0
- Console or hydration errors: 0
- FAQPage objects: 0 across every checked page
- Visible Homepage FAQ items: 4
- Visible FAQ sections on affected Gift and SEO landing pages: preserved
- Required page-purpose Schema types: present on every checked page
- Product Schema retained on Collection
- Article Schema retained on Journal article
- BreadcrumbList retained on Gift, Collection, Journal article, and Examples pages

Known build warnings about dynamic database orchestration imports, the Next.js ESLint plugin, and local filesystem speed remain unchanged. Negative-path order rejection logs in the test output are expected test assertions; all tests passed.

## Release state

- Production modified: NO.
- Indexing requests: 0.
- Sitemap submissions: 0.
- New pages or articles: 0.
- Visible FAQ content removed: NO.
- Checkout, price, analytics, generation, customer data, and private storage: unchanged.

## Exact next action

Submit the combined Round 01–05 candidate for controlled production review. If approved, deploy once, validate the live JSON-LD and sitemap, and then freeze further on-page changes for at least 14 complete days while measuring organic impressions, clicks, landing-page CTA activity, and progression to `/create`.
