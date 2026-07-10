# MENSSKULL Etsy API Safety Policy

This integration is a read-only decision-support system by default. API efficiency and Etsy account safety take priority over polling frequency.

## Required Defaults

- `ETSY_READ_ONLY_MODE=true`
- `ETSY_WRITE_APPROVED=false`
- `ETSY_FULL_SYNC_APPROVED=false`
- Maximum approved writes remain three listings per day.
- Deployments never start Etsy synchronization or analysis jobs.
- GET requests never start synchronization.

## Synchronization Policy

The default sync is incremental:

1. Read paginated active-listing summaries.
2. Compare Etsy's update timestamp with the stored raw listing timestamp.
3. Fetch details, images, and inventory only for new or changed listings.
4. Skip unchanged listings without additional per-listing API calls.
5. Use a cross-process lock so only one sync can run.
6. Enforce a six-hour minimum interval unless an internal, reviewed operation explicitly overrides it.

A full sync requires an explicit internal call and `ETSY_FULL_SYNC_APPROVED=true`. Public API routes do not expose a full-sync switch.

## Quota Policy

Every Etsy response records the QPD, QPS, remaining-call, and retry headers when Etsy provides them. The latest snapshot is stored locally in `data/etsy-rate-limit.json`; it contains no OAuth token or customer data.

- Reserve at least 20 percent of QPD or 50 calls, whichever is larger.
- Bulk sync stops before entering the reserve.
- Interactive OAuth and approved tracking may use the reserve.
- A daily-limit 429 stops immediately. It is not retried as a short QPS error.
- QPS and temporary 5xx responses use at most two retries after the original request.
- An exhausted snapshot permits only a conservative probe after 60 minutes so the rolling 24-hour quota can be detected without retry storms.

## Prohibited Behavior

- No automatic Etsy listing edits.
- No automated review replies or customer messages.
- No scraping authenticated competitor data.
- No simulated human behavior or rate-limit evasion.
- No concurrent full syncs.
- No deployment-triggered synchronization.
