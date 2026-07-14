# MyKinLegacy SEO Indexing and Measurement Sprint 02

Baseline date: 2026-07-14

## Search Console

- Property: `sc-domain:mykinlegacy.com`
- Ownership: verified automatically with the existing DNS domain record.
- Sitemap: `https://mykinlegacy.com/sitemap.xml`
- Sitemap status: Success.
- Submitted and last read: 2026-07-14.
- Discovered public pages: 41.
- Discovered videos: 0.
- `robots.txt`: HTTP 200 and references the sitemap.
- Private review URLs in sitemap: 0.
- Legacy `/ai-family-crest-generator` URLs in sitemap: 0.

### Priority URL inspection

| URL | Google index status at inspection | Live test | Index request |
| --- | --- | --- | --- |
| `/` | Indexed | Not repeated | Not repeated |
| `/family-legacy-collection` | Discovered, not indexed | Eligible | Requested once |
| `/real-examples` | Discovered, not indexed | Eligible | Requested once |
| `/gifts/father-retirement` | Discovered, not indexed | Eligible | Requested once |
| `/gifts/fathers-day` | Discovered, not indexed | Eligible | Requested once |
| `/gifts/grandparents` | Discovered, not indexed | Eligible | Requested once |
| `/gifts/wedding` | Discovered, not indexed | Eligible | Requested once |
| `/gifts/christmas-family` | Discovered, not indexed | Eligible | Requested once |

Search Console reported that property data was still processing and advised returning in about one day. No URL received a repeated indexing request.

## GA4 measurement

- Property: MyKinLegacy
- Account: existing organization Analytics account
- Industry: Shopping
- Reporting timezone: United States, Los Angeles
- Currency: USD
- Web stream: MyKinLegacy Web
- Stream URL: `https://mykinlegacy.com`
- Measurement ID: `G-SD7D57WEH0`
- Advertising personalization signals: disabled in the site configuration.
- Google signals: disabled in the site configuration.

### Event contract

| Event | Trigger | PII rule |
| --- | --- | --- |
| `homepage_view` | Homepage funnel view | Page path only |
| `real_examples_view` | Real examples view | Page path only |
| `gift_landing_view` | Gift landing view | Page path and public gift slug only |
| `create_started` | Create page view | Page path only |
| `questionnaire_completed` | Final guided interview step completes | No interview ID or answers |
| `checkout_started` | Stripe Checkout session is created | No order number |
| `purchase_completed` | Paid order is verified on the success page | No order number, value, email, or recipient data |
| `founder_delivery_approved` | Customer delivery state becomes approved and Vault-ready | Public source label only |
| `vault_opened` | Token-protected Vault successfully loads | Public source label only |
| `collection_downloaded` | Complete Collection ZIP is selected | No asset ID, token, or order number |

GA4 receives only an allowlist of public page or source fields. Recipient names, family memories, email addresses, interview IDs, asset IDs, order IDs, raw order numbers, Vault tokens, prompts, and collection contents are omitted.

## Search and conversion baseline

This is a zero-data baseline, not an estimate.

| Metric | Baseline | Evidence note |
| --- | ---: | --- |
| Confirmed indexed URLs | 1 | Homepage confirmed through URL Inspection |
| Confirmed discovered but not indexed URLs | 7 | Seven inspected priority URLs |
| Other sitemap URLs awaiting coverage data | 33 | 41 discovered minus 8 inspected |
| Sitemap errors | 0 | Sitemap status Success |
| Crawl errors | 0 | No data available yet; Search Console processing |
| Impressions | 0 | No property performance data yet |
| Clicks | 0 | No property performance data yet |
| Average position | 0 | No property performance data yet |
| Organic sessions | 0 | New GA4 property, no collected data at baseline |
| Example-page visits | 0 | New GA4 property, no collected data at baseline |
| Questionnaire starts | 0 | New GA4 property, no collected data at baseline |
| Checkout starts | 0 | New GA4 property, no collected data at baseline |
| Purchases | 0 | New GA4 property, no collected data at baseline |

## Mobile transfer and performance

Measured with a fresh-cache mobile Chromium session at 390 x 844. Initial transfer covers the first viewport; full-scroll transfer includes lazy-loaded assets encountered while scrolling the page.

| Page | HTTP | Initial transfer | Full-scroll transfer | Initial FCP | Initial LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage | 200 | 1.47 MiB | 1.68 MiB | 7.47 s | 8.79 s | 0 |
| Real examples | 200 | 0.77 MiB | 1.24 MiB | 6.35 s | 6.35 s | 0 |
| Father retirement example | 200 | 0.91 MiB | 1.01 MiB | 6.16 s | 6.84 s | 0 |
| Father retirement gift page | 200 | 0.70 MiB | 0.80 MiB | 6.33 s | 6.44 s | 0 |

The 61.5 MiB source-image library is not transferred to a mobile visitor. Responsive images and lazy loading keep the tested pages below 1.68 MiB after a complete scroll.

The test originated from Shanghai. Repeated network timing separated about 5.1 seconds of TLS and route latency from 0.25 to 0.63 seconds between completed connection and first response byte. The application response itself is below the two-second threshold; the current Asia-to-origin route is not. No image-quality reduction was applied because source-image weight was not the measured bottleneck.

## Follow-up measurement cadence

1. Recheck Search Console coverage after 24 to 72 hours.
2. Confirm non-transaction events in GA4 Realtime after deployment.
3. Confirm checkout, purchase, approval, Vault, and download events only through real controlled actions; do not create fake purchases.
4. Capture a United States mobile PageSpeed or CrUX baseline once Google has field data.
5. Review search and funnel metrics weekly during controlled SEO growth.
