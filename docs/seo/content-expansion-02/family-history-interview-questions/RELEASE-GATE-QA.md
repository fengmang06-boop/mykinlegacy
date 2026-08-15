# Release Gate QA

## Current decision

`LOCAL_INDEXABLE_IMPLEMENTATION_READY`

The user authorized inclusion in the local indexable site graph on 2026-08-15. This is not approval to deploy production or submit an indexing request to Google.

## Content checks

- [x] Primary intent is family-history interviewing
- [x] 40 numbered questions are present
- [x] 10-question starter set is present
- [x] Consent appears before recording instructions
- [x] Right to skip, pause, stop, restrict, and review is visible
- [x] Sensitive-story handling is visible
- [x] Memory is not presented as verified genealogy
- [x] Recording, metadata, copies, and access are covered
- [x] Commercial transition is brief and last
- [x] No invented customer story, quote, statistic, expert review, or outcome
- [x] No death, illness, age, or regret pressure
- [x] Product terminology and heraldry boundary remain accurate

## Source checks

- [x] Oral History Association Best Practices verified
- [x] Oral History Association Ethics verified
- [x] Oral History Association participant guidance verified
- [x] Library of Congress family-story guide verified
- [x] Smithsonian Institution Archives guide verified
- [x] No commercial listicle used as a factual authority

## SEO checks

- [x] Proposed Title, H1, description, route, and canonical are defined
- [x] Intent is distinct from all nine live Journal articles
- [x] Intent is distinct from the unpublished archive-preservation candidate
- [x] No separate parent/grandparent thin-page recommendation
- [x] Internal link plan is conservative
- [x] FAQPage schema is not pre-authorized

## Implementation and production checks

- [x] Local Journal registry includes the article
- [x] Generated local route exists
- [x] Local Sitemap includes the article and totals 52 URLs
- [x] Canonical resolves to the proposed article URL
- [x] Article and Breadcrumb structured data use the shared truthful renderer
- [x] FAQPage schema remains absent
- [x] Production unchanged
- [x] Indexing requests: 0
- [x] Sitemap submissions: 0

## Release blockers

1. Obtain explicit production deployment approval.
2. Recheck the final production diff contains only the scoped article, registry, tests, and documentation.
3. Deploy through the controlled production workflow and verify HTTP 200, Canonical, Article/Breadcrumb schema, Journal listing, and the 52-URL Sitemap.
4. Do not submit a manual indexing request unless separately authorized.

## Exact next action

Stop for explicit controlled-production approval. If approved, deploy the scoped commit through the controlled workflow, verify the production article and 52-URL Sitemap, and continue passive discovery monitoring without a manual indexing request unless separately authorized.

## Completed local implementation QA — 2026-08-15

- Generated article word count: 2,611
- Sections: 10
- FAQs visible in body: 6
- FAQPage schema: 0
- Authoritative sources: 5
- Related articles: 3
- Article route: HTTP 200
- Journal hub: HTTP 200 and article link present
- Sitemap: HTTP 200, 52 URLs, article present, `lastmod` present
- H1: 1
- Canonical: exact proposed article URL
- Article schema: 1
- BreadcrumbList schema: 1
- `noindex`: absent
- Targeted tests: 19/19 PASS
- Complete tests: 385/385 PASS
- Typecheck: PASS
- Lint: PASS
- Build: PASS
- Build warnings: two pre-existing dynamic-require warnings in database orchestration plus the existing ESLint-plugin notice; no article or indexing build failure
- Production modified: NO
- Google indexing requests: 0
- Sitemap submissions: 0
