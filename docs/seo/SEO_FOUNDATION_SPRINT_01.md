# MyKinLegacy SEO Foundation Sprint 01

## Executive summary

- Baseline production SEO verdict: **FAIL**
- Baseline readiness score: **58/100**
- Post-implementation target: **88/100**, pending production validation and Search Console ownership
- Scope: public discovery, on-page content, structured data, internal links, and measurement readiness
- Explicitly unchanged: payment, Stripe, Founder review, email, Vault, delivery, PDFs, crest generation, database schema, MRE, Atlas, DIE, and Geometry

## Production audit baseline

Audit date: 2026-07-14

| Area | Result | Evidence before changes |
| --- | --- | --- |
| HTTPS and availability | PASS | 30 audited public/conversion pages returned 200; unknown URL returned 404; HTTP redirected to HTTPS |
| Robots | PARTIAL | Private routes were blocked, but `/review` was not blocked and `/real-examples` plus `/gifts` were not explicitly represented |
| Sitemap | FAIL | Only 13 URLs; `/real-examples` and all 20 example details were missing |
| Indexability | FAIL | Public pages emitted `index, follow`, but a `site:mykinlegacy.com` check returned no visible results; Search Console access was unavailable |
| Canonicals | PARTIAL | 29/30 audited pages were correct; `/create` inherited the home canonical while noindexed |
| Titles | PASS | 30/30 audited pages had distinct titles |
| Descriptions | PASS | 30/30 audited pages had descriptions with no exact duplicates |
| H1 structure | PARTIAL | 29/30 pages had one H1; `/create` had two |
| Open Graph | FAIL | 0/30 audited pages had an Open Graph image |
| Twitter cards | PASS | 30/30 emitted a summary-large-image card, but without an image |
| Structured data | FAIL | Every audited page exposed Organization only; no Product, Offer, Breadcrumb, ItemList, FAQ, or CreativeWork coverage on core pages |
| Example depth | FAIL | 20 details had unique short previews but insufficient buyer context, personalization evidence, and related-example paths |
| Occasion coverage | FAIL | No substantial pages existed at the eight requested `/gifts/...` paths |
| Internal links | PARTIAL | Home linked to Collection and Examples, but no occasion cluster connected commercial intent to examples and Create |
| Broken links | PASS with note | 38 valid internal destinations returned 200; Cloudflare email protection produced one crawler-only `/cdn-cgi/l/email-protection` false positive |
| Image accessibility | PASS | No rendered image lacked an `alt` attribute; many decorative images correctly used empty alt text |
| Mobile/performance risk | PARTIAL | Responsive layouts exist, but 20 showcase PNG source files total 64,523,732 bytes (about 61.5 MiB); Next Image mitigates transfer size, but mobile visual validation is required |
| Core Web Vitals data | BLOCKED | PageSpeed Insights API returned quota error 429; no Search Console field data was available |
| First-party funnel tracking | PARTIAL | Landing views, example views, questionnaire funnel, checkout start, payment, Vault, and downloads use privacy-sanitized first-party events; GSC/GA4 ownership was not available to verify |

## Changes in this sprint

1. Added eight substantial occasion pages under `/gifts/`.
2. Added unique SEO title, description, H1, buyer context, personalization evidence, and related links for all 20 examples.
3. Expanded the sitemap to 41 canonical commercial/public URLs.
4. Explicitly blocked `/review` while keeping private transaction routes blocked.
5. Removed the legacy AI-generator page from the sitemap and pointed its metadata canonical to the symbolic crest page with `noindex, follow`.
6. Added a default social image and page-specific example artwork for Open Graph and Twitter cards.
7. Added Organization, WebSite, Product, Offer, BreadcrumbList, FAQPage, ItemList, CreativeWork, and VisualArtwork JSON-LD where the visible page supports it.
8. Added natural links across Home, Collection, Gift Guides, Real Examples, Example Details, and Create.
9. Corrected `/create` to one H1 and a self-referencing canonical while preserving `noindex, nofollow`.
10. Added optional Search Console HTML-tag support through `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`; no token is committed.

## Structured data ownership

| Schema | Owning page(s) | Source of truth |
| --- | --- | --- |
| Organization | All pages through root layout | MyKinLegacy name, URL, support email, and real logo |
| WebSite | All pages through root layout | MyKinLegacy canonical site URL |
| Product + Offer | `/family-legacy-collection` | USD 49, digital delivery, Founder review, limited availability |
| BreadcrumbList | Collection, gift pages, example gallery, example details | Visible page hierarchy |
| FAQPage | Home, Collection, and eight gift pages | Questions and answers visible on each page |
| ItemList | Example gallery and each gift page | Real example URLs and artwork |
| CreativeWork + VisualArtwork | 20 example detail pages | Public showcase crest, recipient type, occasion, and meaning |

No ratings, review counts, legal heraldry, noble status, or genealogy certification are marked up.

## Sitemap and indexability status

- Expected sitemap URL count after deployment: **41**
- Commercial pages: Home, Collection, Real Examples, 8 gift pages, 20 example details, and supporting public pages
- Excluded: Create, Checkout, Payment, Order Status, Download, Admin, API, Review, and AI Generator
- Search Console submission status: **manual action required** because this environment has no verified Search Console property access
- Recommended property: domain property for `mykinlegacy.com`
- Submission URL: `https://mykinlegacy.com/sitemap.xml`

## Internal-link map

```text
Home
  -> Family Legacy Collection
  -> Real Examples
  -> Occasion gift pages
  -> Create

Family Legacy Collection
  -> Occasion gift pages
  -> Real Examples
  -> Create

Occasion gift page
  -> 3 relevant real examples
  -> 3 related occasion pages
  -> Collection policies
  -> Create

Real Examples
  -> all 20 example details
  -> all 8 occasion pages
  -> Collection
  -> Create

Example detail
  -> 3 related example details
  -> 1 relevant occasion page
  -> Collection
  -> Create
```

Every example receives a link from the gallery, related examples, and at least one relevant occasion cluster.

## Tracking readiness

| Metric | Status | Current measurement path |
| --- | --- | --- |
| Homepage visits | READY | `funnel_step_viewed` with page `/` |
| Real Examples visits | READY | `funnel_step_viewed` with page `/real-examples` |
| Questionnaire starts | READY | Create/interview funnel events |
| Checkout starts | READY | `checkout_started` |
| Paid orders | READY | Payment event plus production order state |
| Founder approvals | READY operationally | Founder Edition admin/order state, not a public analytics event |
| Successful deliveries | READY operationally | Resend log, Vault readiness, and artifact verification |
| Vault opens | READY | `vault_opened` |
| ZIP downloads | READY | Download click/event and production artifact logs |
| Organic query impressions/clicks | NOT VERIFIED | Requires Search Console ownership and sitemap submission |
| GA4 sessions/attribution | NOT CONFIGURED | Optional; first-party funnel logging remains the approved minimal path |

No raw email, private story, raw prompt, Vault token, storage key, secret, or signed URL is included in analytics payloads.

## Manual Founder actions after deployment

1. Add or open the `mykinlegacy.com` Domain property in Google Search Console.
2. Complete DNS ownership verification.
3. Submit `https://mykinlegacy.com/sitemap.xml` in the Sitemaps report.
4. Inspect Home, Collection, Real Examples, and one gift page with URL Inspection.
5. Request indexing only for the core cluster, not all pages individually.
6. Review indexing and Core Web Vitals after Google has collected data.
7. Configure GA4 only if the Founder wants channel attribution beyond the existing first-party funnel.

## Remaining risks

1. The domain appears new or not yet indexed; metadata changes cannot guarantee ranking or indexation.
2. Source showcase PNGs are large. Next Image reduces normal transfer size, but image optimization cache misses may still affect first visits.
3. No Search Console or GA4 account was available for direct verification.
4. PageSpeed field/lab data could not be retrieved because the public API quota returned 429.
5. Occasion pages must earn links and engagement; publishing alone will not create authority.
6. The Founder Edition cap and manual review limit traffic capacity, so SEO rollout should stay controlled.

## Recommendation gate

Recommend **READY FOR CONTROLLED SEO** only after:

- all validation commands pass;
- production sitemap contains 41 expected URLs;
- all new gift and example pages return 200 with canonical metadata;
- rendered mobile pages show no overflow or broken images;
- checkout and Founder review hold remain unchanged;
- Search Console ownership and sitemap submission are completed or explicitly accepted as a manual follow-up.
