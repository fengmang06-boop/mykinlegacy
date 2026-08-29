# V2 Conversion Baseline

Status date: 2026-08-29  
Approved V2 release: 2026-07-29  
Approved V2 production commit: `1b5bd6f39dc1b0f6b6d91e3e871a8a37a015ffee`

## Historical RAW baseline through 2026-08-28

| Measure                   | RAW value | Interpretation                                 |
| ------------------------- | --------: | ---------------------------------------------- |
| GA4 users                 |       115 | Historical identity classification unavailable |
| GA4 sessions              |       127 | Do not treat all as external                   |
| Engaged sessions          |        28 | RAW only                                       |
| Page views                |       295 | RAW only                                       |
| Create starts             |         6 | Existing GA4 definition                        |
| Questionnaire completions |         2 | Existing GA4 definition                        |
| Checkout starts           |         2 | Existing GA4 definition                        |
| Purchases                 |         0 | Confirmed zero                                 |
| Revenue                   |     USD 0 | Confirmed zero                                 |

Channel detail: Direct 111 sessions, Unassigned 4, AI Assistant 8, Organic Search 4. The 12 known non-direct sessions are the strongest acquisition baseline, including 8 engaged sessions, but are not equivalent to verified external identity.

## Measurement baseline

The new cohort starts only after the traffic-identity and canonical-funnel release. Historical records remain RAW and are not backfilled. New reports must show:

- `RAW`: every captured event.
- `EXCLUDED_INTERNAL`: OWNER_INTERNAL, CODEX_QA, AUTOMATED_MONITOR, and DEVELOPMENT.
- `ESTIMATED_EXTERNAL`: REAL_VISITOR only. UNKNOWN remains separate and is not silently promoted.

The 7-day observation is scheduled for 2026-09-05 and the 14-day observation for 2026-09-12, subject to confirmed production release on 2026-08-29. If release validation completes later, both dates move by the same number of days.

## Conversion denominator rule

No direct conversion rate is published until both numerator and denominator use the same post-release identity contract. The first useful cohort is ESTIMATED_EXTERNAL sessions from release time onward.
