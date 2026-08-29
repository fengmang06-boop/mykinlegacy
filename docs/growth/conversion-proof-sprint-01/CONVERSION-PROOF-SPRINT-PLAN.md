# Conversion Proof Sprint 01 Plan

Status date: 2026-08-29 (Asia/Shanghai)  
Mission phase: DISCOVERY_AND_CONVERSION_PROOF  
Primary goal: establish a trustworthy external-visitor funnel and obtain the first paid order without manufacturing demand signals.

## Locked boundaries

- Keep the approved V2 experience already released on 2026-07-29. Do not redeploy or redesign it as part of discovery.
- Keep the product price at USD 49.
- Protect the Modern Crest commercial page and the Family Legacy article from title, meta, or body changes while their gates remain closed.
- Pause Christmas and anniversary expansion.
- Publish no bulk articles, bulk metadata, ads, fake reviews, fake orders, or synthetic conversion-rate claims.
- Submit exactly one manual indexing request for `/journal/family-reunion-gift-ideas`; no other URL receives a request in this sprint.

## Execution sequence

1. Restore and verify GSC, GA4, Cloudflare, Stripe, and health monitoring.
2. Record the historical RAW baseline without rewriting old sessions.
3. Add the canonical funnel and explicit traffic identity contract.
4. Release the measurement change only after tests, type checks, lint, build, and security checks pass.
5. Submit the one approved Family Reunion indexing request after action-time confirmation.
6. Observe 7-day and 14-day cohorts; reconcile GA4 to Stripe without assuming UNKNOWN traffic is external.

## Baseline facts at sprint start

- GSC complete through 2026-08-28: 346 impressions, 2 clicks since launch.
- GA4 since launch: 127 sessions, 6 create starts, 2 questionnaire completions, 2 checkout starts, 0 purchases, USD 0 revenue.
- Stripe since 2026-07-14: 5 live checkout sessions, of which 3 are explicit internal tests and 2 are UNKNOWN; 0 verified external sessions, 0 Payment Intents, 0 purchases.
- Known non-direct acquisition: 12 sessions (8 AI Assistant and 4 organic), but historical traffic lacks the new identity contract and is not reclassified retroactively.

## Success criteria

- Every new funnel event carries anonymous session, source, medium, landing page, device category, traffic type, and reporting classification.
- RAW, EXCLUDED_INTERNAL, and ESTIMATED_EXTERNAL views remain distinguishable.
- The first paid order agrees across GA4, Stripe Checkout, Payment Intent, charge, purchase, and revenue records.
- No protected SEO winner, price, or approved V2 asset is modified.
