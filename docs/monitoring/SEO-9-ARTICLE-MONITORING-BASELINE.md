# SEO 9-Article Monitoring Baseline

Baseline date: 2026-07-16 (Asia/Shanghai)

## Scope

- Articles monitored: 9
- Batch 01: 5
- Batch 02: 4
- Expected sitemap URL count: 51
- Observed sitemap URL count: 51
- Sitemap HTTP status: 200
- Indexing requests made: no
- Sitemap submissions made: no
- Manufactured browser visits: no

## Daily collection contract

Every article record contains HTTP status, sitemap membership, GSC inspection status, impressions, clicks, CTR, average position, queries, countries, devices, GA4 landing users, sessions, engaged sessions, engagement time, `create_started`, `checkout_started`, `purchase_completed`, previous-monitor delta, and cumulative values since publication.

The only allowed availability classifications are:

- `AVAILABLE_ZERO_ACTIVITY`
- `AVAILABLE_MEANINGFUL_ACTIVITY`
- `PROCESSING_OR_UNAVAILABLE`
- `ACCESS_UNAVAILABLE`
- `API_ERROR`

Unavailable data is recorded as `null`; it is never converted to zero.

## Article baseline

| Batch | Path | HTTP | Sitemap | GSC inspection | Cumulative GSC | Cumulative GA4 |
| --- | --- | ---: | --- | --- | --- | --- |
| 01 | `/journal/family-legacy-gift-ideas` | 200 | yes | Submitted and indexed | meaningful activity | zero activity |
| 01 | `/journal/what-is-a-family-crest` | 200 | yes | Submitted and indexed | meaningful activity | zero activity |
| 01 | `/journal/retirement-gift-for-father` | 200 | yes | Submitted and indexed | zero activity | meaningful activity |
| 01 | `/journal/personalized-gifts-for-grandparents` | 200 | yes | Submitted and indexed | meaningful activity | zero activity |
| 01 | `/journal/how-to-create-a-family-keepsake` | 200 | yes | Submitted and indexed | zero activity | zero activity |
| 02 | `/journal/family-reunion-gift-ideas` | 200 | yes | URL unknown to Google at baseline | processing/unavailable | processing/unavailable |
| 02 | `/journal/personalized-anniversary-gifts-for-parents` | 200 | yes | URL unknown to Google at baseline | processing/unavailable | processing/unavailable |
| 02 | `/journal/how-to-create-a-modern-family-crest` | 200 | yes | URL unknown to Google at baseline | processing/unavailable | processing/unavailable |
| 02 | `/journal/personalized-wedding-gifts-for-couples` | 200 | yes | URL unknown to Google at baseline | processing/unavailable | processing/unavailable |

Batch 02 publication date is 2026-07-16. Its first-impression, first-query, first-organic-click, first-external-engaged-visit, first-create, first-checkout, and first-purchase milestones are persisted outside the repository and remain `null` until observed.

## Scheduler

- Task: `MyKinLegacy SEO Daily Monitor`
- Schedule: daily at 09:15 local time
- Account mode: current user, S4U, limited run level
- Concurrency: `IgnoreNew`
- Start when available: enabled
- Runtime limit: 10 minutes
- First unattended validation: passed, result code 0
- Output: Windows DPAPI-protected monitoring directory, outside Git

The monitor uses only `webmasters.readonly` and `analytics.readonly`. It performs no indexing, sitemap, property, analytics, or production writes.
