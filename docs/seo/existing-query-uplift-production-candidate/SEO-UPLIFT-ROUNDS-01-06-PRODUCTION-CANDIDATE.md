# SEO Existing-Query Uplift Rounds 01–06 — Controlled Production Candidate

Date: 2026-08-11

Branch: `codex/seo-existing-query-uplift-20260810`

Production base: `4d054fd5f15f915344ce7d2c1afff18dd0ffee5c`

Application change head: `532bf17cb0f2283fed671e45a537a82563223806`

Decision: `READY_FOR_CONTROLLED_PRODUCTION_APPROVAL`

## Executive summary

Rounds 01–06 form one coherent, local-only release candidate. They strengthen pages already receiving search impressions, clarify informational and transactional page ownership, improve internal reachability, correct the public product contract, remove ineligible FAQPage markup, make sitemap modification dates evidence-based, and add privacy-safe organic-path measurement.

The candidate does not create pages, change prices, alter Checkout or payment behavior, modify generation or fulfillment, request indexing, or submit a sitemap. The six application commits are a direct descendant of the current remote `main` with no intervening divergence.

## Candidate composition

1. `f33169f` — strengthen core SEO landing pages
2. `4292961` — align pages with existing search demand
3. `43f8a70` — strengthen seasonal SEO attribution
4. `06e46c0` — make SEO crawl signals trustworthy
5. `9fa6f3f` — align schema with search eligibility
6. `532bf17` — connect orphaned SEO landing pages

Combined application diff:

- Commits above production base: 6
- Changed files: 26
- Insertions: 1,395
- Deletions: 121
- New public URLs: 0
- Removed public URLs: 0
- Sitemap URL count: 51

## Included outcomes

### Search-demand alignment

- Strengthens existing Heritage Gift, Family Legacy Gift, Symbolic Family Crest, Christmas Family Gift, Family Reunion, Grandparents, Retirement, Anniversary, and Journal targets.
- Preserves distinct transactional and informational intent ownership.
- Creates no duplicate Christmas page or article.

### Product and trust accuracy

- Uses the approved five-part contract: Final Crest, Heritage Certificate, Family Story, Meaning Behind Your Crest, and Complete Collection.
- Keeps Private Vault in its correct role as digital delivery rather than a sixth deliverable.
- Preserves digital-delivery, no-physical-shipping, and heraldry boundaries.

### Technical search signals

- Keeps all 51 canonical sitemap URLs.
- Uses maintained article dates for the nine Journal `lastmod` values and omits unsupported dates elsewhere.
- Removes ineligible FAQPage JSON-LD while preserving visible FAQ content.
- Retains Organization, WebSite, WebPage, Product/Offer, Article, BreadcrumbList, and applicable ItemList markup.

### Crawl and authority flow

- All 51 sitemap URLs are reachable from the homepage.
- `/family-crest-generator` and `/heritage-gift` move from unreachable to depth 2 through the Journal hub.
- `/family-legacy-gift` gains a second contextual source.
- Maximum click depth remains 3.

### Measurement

- Adds privacy-safe Journal landing, Journal article, and CTA source measurement.
- Allows only sanitized page/source identifiers, same-site destinations, step names, and anonymous flow IDs.
- Collects no customer story, surname, email, phone, address, Checkout data, payment data, or other PII.

## Excluded scope

The candidate contains no changes under:

- API, Worker, or Admin applications
- Database schema or migrations
- Checkout, payment, Stripe, pricing, order creation, generation, fulfillment, email, or private storage
- Deployment scripts, GitHub workflows, environment configuration, or infrastructure
- Package manifests or dependency lockfiles

No live-key, webhook-secret, private-key, API-key, or refresh-token pattern was found in the candidate diff.

## Final local gate

- Worktree before approval record: clean
- Remote `main` after fetch: `4d054fd5f15f915344ce7d2c1afff18dd0ffee5c`
- Merge base equals remote `main`: PASS
- Diff formatting check: PASS
- Full test suite: 385/385 PASS across 61 files
- Security regression suite: 30/30 PASS across 5 files
- Typecheck: PASS
- Lint: PASS
- Production build: PASS
- Build routes generated: PASS
- Horizontal-overflow failures in the 390 px rendered crawl: 0
- HTTP failures across 51 sitemap URLs: 0
- H1 failures across 51 sitemap URLs: 0
- Canonical failures across 51 sitemap URLs: 0
- Broken non-sitemap internal links: 0

Known unchanged warnings are limited to the existing dynamic-require notices in `packages/database/src/orchestration/pipeline.ts`, the Next.js ESLint plugin notice, and the local-filesystem speed notice. They were present before this candidate and do not originate from its changed scope.

## Controlled release procedure after explicit approval

1. Push the exact reviewed candidate and fast-forward `main` from the recorded production base.
2. Confirm the production lock has no stale holder and the deployment capacity gate passes.
3. Trigger the existing `safe_deploy` operation once.
4. Preserve the prior revision and prior image; the existing deployment procedure attempts automatic rollback if deployment or health checks fail.
5. Verify Homepage, Collection, Examples, Product API, and GET-only `/create` entry without creating an order or payment object.
6. Verify the live sitemap contains 51 canonical URLs and only evidence-backed Journal `lastmod` values.
7. Render representative Homepage, Gift, SEO landing, Journal, Collection, and Examples pages to validate H1, Canonical, eligible JSON-LD, zero FAQPage objects, and no horizontal overflow.
8. Confirm no new HTTP/Nginx 5xx, MySQL restart, queue error, production-lock anomaly, or public internal-data leakage.

## Rollback conditions

Rollback is required if the release causes any of the following:

- Deployment or mandatory health-check failure
- New sustained public 5xx responses
- Product API database failure or a new MySQL restart
- Create or Checkout entry regression
- Incorrect Canonical, sitemap loss, public noindex, or materially broken structured data on priority pages
- Customer-visible internal data, prompt, review identifier, secret, or PII exposure
- Production lock or service state that cannot be safely reconciled during the release window

## Post-release measurement freeze

After a successful deployment, make no further on-page SEO changes for at least 14 complete days. Measure:

1. Impressions, average position, clicks, and CTR for the mapped existing-query groups.
2. Organic landing views by page identifier.
3. CTA clicks by source and same-site destination.
4. Organic landing sessions progressing to `/create`.
5. Query-page overlap for retirement and anniversary terms.
6. Christmas, Grandparents, Heritage Gift, Family Legacy Gift, and Crest page discovery trends.

Do not treat early daily volatility as evidence for another content round. The next optimization decision should use a complete 14-day comparison window.

## Release controls

- Production modified: NO
- Production deployment triggered: NO
- Indexing requests: 0
- Sitemap submissions: 0
- Orders or payment objects created: 0

## Exact next action

Founder/CSO reviews and explicitly approves this single candidate for production. Only after that approval should the reviewed commit be pushed, fast-forwarded into `main`, and deployed once through the existing locked `safe_deploy` path with automatic rollback protection.
