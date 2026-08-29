# First Revenue Tracker

Status date: 2026-08-29  
Product price: USD 49  
Goal: first verified paid external order

## Current ledger

| Measure                           | Value |
| --------------------------------- | ----: |
| Verified external Stripe sessions |     0 |
| Payment Intents                   |     0 |
| Successful charges                |     0 |
| GA4 purchases                     |     0 |
| Stripe purchases                  |     0 |
| Revenue                           | USD 0 |

## Acceptance rule for the first paid order

Record the order only when Stripe shows a paid Checkout Session, Payment Intent, and successful charge and the application/GA4 path shows the corresponding purchase. The traffic class must be REAL_VISITOR or separately verified with non-PII evidence; UNKNOWN does not become external by assumption.

For the accepted order, record date/time, anonymous flow ID, source, medium, landing page, device class, checkout/session status, Payment Intent status, purchase status, and revenue. Do not store email, name, card details, questionnaire responses, or family information in this tracker.

Price remains unchanged. The tracker must show zero until a real paid event occurs.
