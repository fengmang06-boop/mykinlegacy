# MyKinLegacy Organic Growth Engine V1

This controller extends the existing 09:00 Beijing-time GSC/GA4 monitor. It is
not a second data collector or a publishing bot. The existing MyKinLegacy
Autonomous Growth Operator is the sole scheduled decision-maker. Its cadence
is independent of the publication gate.

## Daily input and outputs

Run `py -3 scripts/mykinlegacy-organic-growth.py` after the daily monitor has
finished. Once a week, run it with `--crawl` to refresh the public sitemap and
internal-link graph. The script consumes only the existing combined
`%LOCALAPPDATA%\MyKinLegacy\monitoring\daily-results\latest.json`. It does not
read credentials or write to Google, the site, or production.

Output lives in `%LOCALAPPDATA%\MyKinLegacy\organic-growth`:

- `latest.json`: current dashboard, query/page classification, scored candidates,
  cluster evidence, indexation coverage, and decision.
- `YYYY-MM-DD.json`: dated report snapshot.
- `growth-ledger.json`: baseline, one snapshot per monitoring day, and a
  production-action ledger. Never overwrite or discard earlier actions.
- `crawl-latest.json`: sitemap inventory, indexability checks, and link graph.

The scorer is versioned as `organic-opportunity-v1.1`. Query-to-page matching
from URL tokens is only a proxy, not a semantic content judgment. A score is a
review order, never permission to deploy. GSC query anonymization means visible
query rows cannot be summed into sitewide totals; no visible impressions does
not prove no search exposure. An uninspected URL's Google index status is
unknown. Sitewide GA4 sessions must not be called organic sessions without a
reliable channel attribution and exclusion of internal/QA traffic.

## Decision and publication gate

1. Check the newest complete GSC date and source success, not merely file mtime.
2. Review `top_10_quick_wins`, `emerging_observation`, clusters, and potential
   cannibalization. If zero mature candidates exist, record HOLD and the next
   check; do not manufacture a page change to meet a quota.
3. For any intervention, record URL, query, first-party evidence, intent,
   before-state, one change hypothesis, deploy date, rollback, and 28-day
   observation window in `production_actions` after live deployment is verified. Keep at most
   one primary SERP experiment live at a time. Do not edit that page again
   during the window unless repairing a verified defect.
4. Prefer strengthening an existing page. A new page requires observed demand,
   a demonstrably unanswered intent, source evidence, business fit, internal
   link plan, and cannibalization check. Do not produce thin or filler pages.
5. Keep to 2–4 meaningful URL upgrades/new pages per week only when the gates
   pass. Low sample can mean zero. Expand a winner only after repeatable signal.
6. Before deployment, run focused tests plus build/lint. After deployment,
   verify HTTP 200, correct title/H1, self-canonical, robots/indexability,
   sitemap, relevant internal links, mobile layout, and unaffected `/create`
   path. Never request indexing repeatedly. Keep heraldry and privacy claims
   within the site's established boundaries.
7. Compare each deployed URL at 7, 14, and 28 *complete GSC days*. Record
   insufficient data honestly; watch the cluster as well as the page. Suppress
   expansion for poor relevance, unresolved indexation, or cannibalization.

The October 1 baseline had no mature query/page quick win or validated content
gap, so its initial batch is empty. This is a gate decision, not a failed run.

## Controlled exploration V1.1

The versioned scorer now labels a query/page pair `EMERGING_EXPERIMENT` when it
has at least 30 impressions in 28 days, at least 10 in the preceding 28 days, an approximate position of 15–40,
strong business relevance, clear intent, no visible cannibalization, and a
stable or growing query trend. This only admits the page to a content review;
the score never authorizes deployment by itself. A reviewer must confirm a
material improvement opportunity and perform page QA. The budget is at most
two controlled SEO experiments per calendar week and one live primary SERP
experiment per topic cluster. The same page and cluster have a 28-day observation lock unless a
verified defect requires repair or rollback.

`--record-action path/to/verified-manifest.json` appends a verified deployment
idempotently to the growth ledger, enforcing the weekly budget and page/cluster lock.
The report then calculates comparable pre/post 7-, 14-, and 28-complete-day
page windows when GSC has reached each end date. Review the paired query too;
page totals can include unrelated queries. Classify a single spike as
insufficient evidence, not success.

The first experiment is documented in
`docs/seo/controlled-exploration-01-family-reunion.md`. The existing guide owns
the informational `family reunion gift ideas` query; the existing gift page
owns commercial `personalized family reunion gifts`. No third URL is warranted.

## Operational boundaries

Operate only on MyKinLegacy. Do not touch MENSSKULL, OpenerLookup, SawFitCheck,
other Google properties, private customer data, checkout/payment behavior, or
security settings. Routine low-risk content and link changes are authorized
after QA. Escalate paid services, legal/compliance changes, destructive bulk
deletion, major redesign, irreversible URL changes, or credential problems.
