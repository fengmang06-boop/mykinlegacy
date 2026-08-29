# Checkout Abandonment Audit

Status date: 2026-08-29

## Observed evidence

Five matching USD 49 live Stripe Checkout Sessions exist since 2026-07-14. Three are explicit internal tests and two are UNKNOWN. All five expired unpaid. There are zero Payment Intents, zero charges, zero purchases, and USD 0 revenue.

Because no session is verified external, this evidence does not prove five customer abandonments or even two customer abandonments. It proves that two historical sessions cannot be attributed and that no recorded flow crossed from Checkout Session creation into payment initiation.

## Instrumented checkout sequence

- `checkout_started`: checkout page is viewed.
- `stripe_checkout_created`: the server returns a Stripe Checkout Session.
- `payment_submitted`: the browser is about to redirect to Stripe.
- `purchase_completed`: the paid confirmation path is reached.

The sequence uses the same anonymous flow ID and traffic context as earlier funnel events. It records no payment details or customer PII.

## Current diagnosis

The largest bottleneck is not yet a proven copy or price objection. It is the combined identity gap and the observed `stripe_checkout_created → Payment Intent` drop to zero. The next evidence needed is one genuinely external, correctly classified checkout path. No synthetic charge or fake order should be created to manufacture that evidence.
