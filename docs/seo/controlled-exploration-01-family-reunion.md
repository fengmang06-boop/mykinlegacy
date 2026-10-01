# Controlled exploration 01 — family reunion gift ideas

Status: pending production verification (2026-10-01).

## Evidence and intent split

GSC complete through 2026-09-30. In the last 28 complete days:

| Query | Google-associated page | Impressions | Clicks | Average position | Previous 28-day impressions / position |
| --- | --- | ---: | ---: | ---: | ---: |
| family reunion gift ideas | `/journal/family-reunion-gift-ideas` | 66 | 0 | 28.97 | 20 / 26.55 |
| personalized family reunion gifts | `/gifts/family-reunion` | 47 | 0 | 34.23 | 25 / 35.20 |

The guide answers comparison and planning intent; the gift landing page
explains one personalized product. GSC's visible 90-day query/page rows map
each query only to its matching URL. Keep both URLs and their self-canonicals.
Do not create another reunion page or retarget the gift page to the broad
ideas query.

The guide is indexed, returns HTTP 200, is present in the sitemap, and has a
self-canonical and no noindex signal. It already provides seven story-first
gift directions, recipient scenarios, format selection, preservation, consent,
and practical planning guidance. No wholesale body rewrite is justified.

## One SERP packaging hypothesis

The current title promises preserved stories but does not communicate how
many concrete choices the guide offers. A direct, count-matched title may
help relevant searchers understand the page. This is a hypothesis, not a CTR
or ranking guarantee; at approximately position 29, low CTR is not itself
proof of bad copy.

- OLD_TITLE: `Meaningful Family Reunion Gift Ideas That Preserve Stories`
- NEW_TITLE: `Family Reunion Gift Ideas: 7 Meaningful Keepsakes`
- OLD_META and NEW_META: `Explore family reunion gift ideas that preserve shared memories, places, values, and stories—not only the event date or a standard event favor.`
- H1, body, FAQ, schema, product price, and conversion path: unchanged.
- Rollback: restore the old `metaTitle` and remove only the two new contextual
  links if they cause a verified relevance or navigation problem.

## Link support

Existing contextual inlinks: reunion gift landing page, Journal index, legacy
gift ideas guide, and anniversary gift ideas guide. This change adds natural,
varied in-text links from:

- `/journal/how-to-create-a-family-keepsake` — shared reunion keepsake formats.
- `/journal/family-history-interview-questions` — gift ideas built around shared
  family memories.

The target guide already links to the reunion gift landing page and other
informational resources. Do not add sitewide exact-match anchors.

## Baseline, monitoring, and stop rules

Baseline query/page: 66 impressions, 0 clicks, 0% CTR, position 28.97 over
2026-09-03–2026-09-30. Baseline page: 118 impressions, 1 click, 0.85% CTR,
position 22.77 over the same window. Previous query/page period: 20
impressions, 0 clicks, position 26.55.

Deployment timestamp: pending. Evaluate only after GSC has complete data
through deployment date +7, +14, and +28 days; compare equal-length pre/post
page periods and inspect the exact query/page pair. If deployed 2026-10-01,
the earliest complete-data end dates are 2026-10-08, 2026-10-15, and
2026-10-29; report availability can lag. Do not re-edit during the observation
window unless a verified technical failure, major regression, or new
cannibalization warrants repair or rollback. Google may rewrite the title;
note adoption before attributing CTR movement to this experiment.

Secondary experiment: none at launch. Seasonal, parent, crest, and legacy
clusters remain under review until one has stronger query-level evidence.
