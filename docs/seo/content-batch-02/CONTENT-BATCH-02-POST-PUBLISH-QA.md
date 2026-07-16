# Content Batch 02 Post-Publish QA

Status: LIVE_VALIDATED

Validation date: 2026-07-16

Deployment: `5ad5a1e9ab4c83cf64161caf5ea8452f78de8a2a`

## Article results

| Article | HTTP | H1 | Metadata / canonical / OG | Article | BreadcrumbList | FAQPage | Product / Review / Rating | Images | Desktop / mobile overflow |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| Family Reunion Gift Ideas | 200 | 1 | PASS | 1 | 1 | 0 | 0 | PASS | NONE |
| Anniversary Gifts for Parents | 200 | 1 | PASS | 1 | 1 | 0 | 0 | PASS | NONE |
| Modern Family Crest | 200 | 1 | PASS | 1 | 1 | 0 | 0 | PASS | NONE |
| Wedding Gifts for Couples | 200 | 1 | PASS | 1 | 1 | 0 | 0 | PASS | NONE |

Additional article checks:

- Hero and inline images: 8/8 loaded after full-page scrolling; alt text present
- Internal links: 67 checked, 0 failures
- Placeholder, internal path, Markdown artifact, token, secret, or customer data matches: 0
- Article 3 opening heraldry boundary: PRESENT
- Article 4 digital-delivery disclosure before product introduction: PRESENT
- Article 4 inclusion checks for surname, gender, remarriage, blended families, religion, culture, and family structure: PRESERVED

## Source checks

- National Archives digitizing: HTTP 200
- Library of Congress personal digital archiving: HTTP 200
- National Archives displaying: HTTP 200
- College of Arms FAQ: HTTP 200
- TIME anniversary tradition article: HTTP 406 to automated validation; retained as an approved editorial source and recorded as an automated-access restriction
- Timeanddate anniversary tradition page: HTTP 403 to automated validation; retained as an approved editorial source and recorded as an automated-access restriction
- Competitor commercial pages used as factual authority: NONE
- Citation numbering and source-register counts: PASS for all four articles

## Site checks

- Production health: HTTP 200
- Homepage: HTTP 200
- Sitemap: HTTP 200, 51 URLs, all four new URLs present
- Robots.txt: HTTP 200
- `/create`: HTTP 200
- Product API: HTTP 200
- Product: active, USD 49
- Checkout: operational kill switch is not returning HTTP 503. An invalid empty request returned HTTP 400 and created no order or Checkout Session.
- Existing Batch 01 articles: 5/5 HTTP 200
- Production incident: NONE
- Manual indexing requests: 0
- Manual sitemap submissions: 0

## Evidence

- Machine-readable browser audit: `docs/seo/content-batch-02/evidence/production-publication/production-browser-qa.json`
- Desktop and 390 px mobile full-page screenshots are stored in the same evidence directory.

## Decision

`LIVE_VALIDATED`
