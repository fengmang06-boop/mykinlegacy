# Founder Readiness Checklist v1.0

Project: Launch Sprint G  
Purpose: Check whether Founder can personally run one complete MyKinLegacy order from homepage to Download Vault.

This is an execution readiness checklist, not a strategy document.

## Current Readiness Verdict

Status: Not fully founder-ready yet.

The system has strong automated proof that the backend delivery loop can work with mock providers: private assets are created, a vault email is sent, a token-protected vault can be opened, and an asset can be downloaded through a short signed URL.

However, Founder browser readiness is stricter than backend E2E readiness.

Founder must be able to sit down, start at `/`, complete the order path, and reach the Download Vault without reading internal docs or manually stitching together hidden steps. Based on the current frontend and payment flow, that is not guaranteed yet.

## Automated Signal Checked

Command run:

```bash
corepack pnpm test -- e2e/mvp-happy-path.e2e.test.ts apps/web/src/customer-flow.test.tsx
```

Result:

- Passed.
- 37 test files passed.
- 197 tests passed.
- MVP happy path confirms private assets, vault email, token-protected vault, and signed download URL using mock providers.
- Customer frontend tests confirm the updated parents-who-have-everything homepage CTA and disclaimer language.

## 1. Can Founder Go From Homepage to Download Vault?

Answer: Not guaranteed without operational setup.

### What Works

- Homepage has a clear `Begin Their Legacy` entry.
- Create/interview flow exists.
- Confirm flow creates an order.
- Checkout flow creates a Stripe checkout session after required consent.
- Payment success page exists.
- Order status page exists.
- Download Vault page exists.
- Backend E2E proves vault delivery can work with private assets and token-protected links.

### What Blocks a Clean Founder Run

- Checkout currently routes through Stripe checkout session creation.
- There is no visible DEV mock payment success button in the customer frontend.
- Admin UI explicitly says payment status cannot be manually marked paid.
- Founder needs Stripe test configuration and webhook forwarding for payment to become `paid`.
- Payment success links to order status, but the order status page does not expose the vault link.
- The Download Vault link appears to rely on delivery email or backend-created token access.

Founder can complete the loop only if:

1. Web app is running.
2. API is running.
3. Database is seeded.
4. Worker/orchestration is running.
5. Stripe test checkout is configured.
6. Stripe webhook forwarding is active.
7. Email delivery or visible test email logs provide the vault link.

## 2. Can Founder Understand the Flow Without Instructions?

Answer: Mostly yes before payment; weaker after payment.

### Strong Points

- Homepage now communicates a meaningful keepsake for parents who already have everything.
- CTA is clear.
- Create page starts with `Who is this collection for?`
- Interview feels more gift-first than before.
- Product page explains the Collection as a private digital keepsake.

### Weak Points

- Payment success says `Payment received, verifying your order`, which feels operational rather than Collection-focused.
- Order status still says `House Identity`, `crest variants`, and `vault files`.
- Download Vault still says `Secure file delivery`, `Your Downloads`, `ZIP packages`, and `Download`.

Founder will understand the purchase intent, but the final receive experience still feels less polished than the landing/create experience.

## 3. Does Founder Need Any Manual Intervention?

Answer: Yes, unless a complete test environment is already running.

Manual setup likely needed:

- Start local/staging web app.
- Start local/staging API.
- Start worker.
- Ensure database is migrated and seeded.
- Ensure product/package data exists.
- Configure Stripe test keys.
- Run Stripe webhook forwarding.
- Access email logs or inbox to retrieve the vault link.

Manual intervention should not be needed inside the user flow after this setup, but the current customer frontend does not provide a mock payment shortcut.

## 4. Would Founder Hesitate at Any Step?

Answer: Yes.

Likely hesitation points:

1. Product price if current data still shows $49 while launch positioning expects $69.
2. Checkout because button says `Continue to Stripe`, not test/mock payment.
3. Payment success because it waits for payment verification.
4. Order status because it shows operational generation language.
5. Vault access because Founder may not know where to get the token link.
6. Download Vault because the page still feels like file delivery rather than receiving a meaningful Collection.

## 5. Would Founder Feel the Collection Is Worth It?

Answer: Partially.

The sales pages now make the value feel more gift-worthy. The Collection content document also contains a stronger emotional experience.

But the live post-payment experience has not fully caught up:

- success page does not preview emotional value
- order status is operational
- vault is still file/download-oriented
- live collection artifacts may not yet reflect the new `This Is Us` experience

Founder may believe the idea is worth it, but the current live receive path may not yet make the delivered Collection feel fully worth it.

## 6. Would Founder Send the Collection to Their Own Family?

Answer: Not yet without reviewing the delivered artifact quality.

Founder could probably send the concept or sales page to family.

Founder should not send the delivered Collection to family until:

- the vault link works
- artifacts are present
- artifact names are understandable
- the post-payment experience feels private and gift-worthy
- the final Collection includes enough recognition value

## 7. Would Founder Send the Website to Strangers?

Answer: Not yet.

The public-facing sales expression is much stronger after the parents-who-have-everything rewrite.

But sending to strangers requires confidence that:

- checkout works
- payment verification works
- worker fulfillment works
- email delivery works
- vault access works
- the receive experience does not feel like raw file delivery

That confidence should come from one Founder-run order first.

## Founder Self-Run Checklist

Founder should run this once before inviting any user.

| Step | URL / Action | Pass Criteria | Result |
| --- | --- | --- | --- |
| 1 | Open `/` | Understand offer in 5 seconds | Pending |
| 2 | Click `Begin Their Legacy` | Reaches create flow | Pending |
| 3 | Complete interview | No confusion or errors | Pending |
| 4 | Confirm collection | Summary feels understandable | Pending |
| 5 | Enter email | Email accepted | Pending |
| 6 | Accept consent | Consent is clear | Pending |
| 7 | Continue checkout | Stripe/test checkout opens | Pending |
| 8 | Complete test payment | Order becomes paid | Pending |
| 9 | Return success page | Payment confirmation appears | Pending |
| 10 | Open order status | Fulfillment status is understandable | Pending |
| 11 | Retrieve vault link | Email/log provides token link | Pending |
| 12 | Open Download Vault | Vault loads without error | Pending |
| 13 | Access artifact | At least one artifact can be opened/downloaded | Pending |
| 14 | Review final feeling | Founder would share with family | Pending |

## Launch Blockers

Only true blockers are listed below.

### Critical

1. No customer-visible DEV mock payment success path.
   - The checkout flow currently creates a Stripe checkout session.
   - Admin says payment status cannot be manually marked paid.
   - Founder cannot complete payment without Stripe test setup and webhook forwarding.

2. Founder may not be able to reach the Download Vault from the browser flow.
   - Payment success links to order status.
   - Order status does not show a vault link.
   - Vault access appears to depend on email delivery or manually finding the token.

3. Fulfillment requires the worker/orchestration path to be running.
   - If worker processing is not active, a paid order can remain stuck before vault delivery.

### High

4. Post-payment pages still feel operational instead of Collection-focused.
   - Payment success, order status, and Download Vault still use language like payment verification, assets, files, downloads, ZIP packages, and generation status.

5. Price readiness is unclear.
   - Launch validation discusses $69, while current product seed/test data has previously shown $49.
   - Founder cannot validate $69 willingness if checkout shows a different price.

6. Founder cannot send strangers until one full browser run is recorded.
   - Automated tests pass, but a human browser-based order from `/` to vault has not been marked complete in this checklist.

### Medium

7. Confirm summary may still feel placeholder-like.
   - It explains intended meaning, but may not reflect the user's actual answers visibly enough to create a strong payment moment.

8. Download Vault presentation is not yet aligned with the parents-gift positioning.
   - The vault works technically, but still feels like delivery infrastructure rather than a meaningful keepsake handoff.

## Final Founder Readiness Answer

Founder should not send the site to strangers yet.

Founder should first run one complete internal order with the full environment active:

Homepage -> Create -> Interview -> Confirm -> Checkout -> Stripe test payment -> Success -> Order Status -> Vault link -> Download Vault -> Artifact access

If that run passes without hidden manual steps, the site can move to the first controlled user test.

If the run requires manual token lookup, manual payment status changes, or founder explanation, it is not ready for external users.
