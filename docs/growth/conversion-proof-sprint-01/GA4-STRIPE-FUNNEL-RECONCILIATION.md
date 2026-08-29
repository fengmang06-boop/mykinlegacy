# GA4 and Stripe Funnel Reconciliation

Status date: 2026-08-29  
Data through: GA4/GSC 2026-08-28; Stripe read at 2026-08-29

## Historical snapshot

| Funnel point               | GA4 RAW | Stripe live |            Verified external |
| -------------------------- | ------: | ----------: | ---------------------------: |
| Sessions                   |     127 |         n/a | Historical value unavailable |
| Create starts              |       6 |         n/a | Historical value unavailable |
| Questionnaire completions  |       2 |         n/a | Historical value unavailable |
| Checkout starts / sessions |       2 |           5 |                   0 verified |
| Payment Intents            |     n/a |           0 |                            0 |
| Purchases                  |       0 |           0 |                            0 |
| Revenue                    |   USD 0 |       USD 0 |                        USD 0 |

Stripe contains five matching USD 49 live Checkout Sessions since 2026-07-14. Three carry explicit internal test labels. Two AHL-prefixed sessions carry no trustworthy identity marker and therefore remain UNKNOWN. All five expired unpaid; none created a Payment Intent or charge.

The dates of the two GA4 checkout starts appear compatible with the two UNKNOWN Stripe sessions, but no historical shared anonymous session key exists. This is probable alignment, not exact reconciliation. The three explicit internal Stripe tests are not represented by GA4 conversion events.

## Canonical post-release funnel

`landing_view → collection_view / examples_view → create_started → intake_stage_started → intake_stage_completed → questionnaire_completed → checkout_started → stripe_checkout_created → payment_submitted → purchase_completed`

Post-release reconciliation joins on anonymous flow/session context where available and compares event time, order number, traffic class, Checkout Session, Payment Intent, charge, purchase, and revenue. A Stripe Checkout Session without a Payment Intent is not a payment attempt, and UNKNOWN is never counted as verified external.
