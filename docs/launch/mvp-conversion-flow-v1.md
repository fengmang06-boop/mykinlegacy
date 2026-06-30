# MVP Conversion Flow v1.0

Project: Launch Sprint B  
Brand: MyKinLegacy  
Core product: Family Legacy Collection  
Purpose: Define the smallest conversion loop that can accept payment, deliver a Collection, and prove real buyer intent.

This document defines the MVP成交闭环. It does not add products, growth channels, SEO expansion, subscriptions, physical goods, or advanced vault features.

## MVP One Sentence Definition

MyKinLegacy MVP helps a customer create, purchase, receive, and download one private Family Legacy Collection.

## Primary MVP Rule

The MVP is successful only if the full loop runs:

Landing Page -> Create / Interview -> Confirm Identity -> Checkout -> Payment -> Receive Collection -> Download Vault

If any step requires founder manual explanation, hidden admin action, or a broken backend dependency during a real user test, the MVP conversion loop is not complete.

## 1. MVP Flow

### 1. User First Screen

The first screen must show:

- what this is: a private Family Legacy Collection
- who it is for: families, gift buyers, parents, grandparents, wedding couples, memorial moments
- why it matters: preserve family meaning before the moment passes
- one primary action: Begin Your Legacy

The first screen should not lead with:

- file formats
- technical generation details
- internal product architecture
- too many navigation paths
- AI as the main promise

The user should understand within 5 seconds:

"This helps me turn family meaning into a keepsake Collection."

### 2. Why the User Continues

The user continues because the page creates one of these thoughts:

- "This could be a meaningful gift."
- "My father/mother/grandparent would keep this."
- "This would help explain our family story."
- "This belongs to our wedding/family reunion/memorial moment."
- "This is more personal than another ordinary gift."

The continuation motive is emotional recognition, not curiosity about technology.

### 3. Where the User Makes the Decision

The real purchase decision happens before checkout, during the identity confirmation moment.

At that point, the user should feel:

- the Collection is about my family
- the story is specific enough
- the symbolic identity is safe and respectful
- the result will be private
- the price makes sense for the occasion

If the confirmation step feels generic, the user will hesitate before payment.

### 4. Where the User Pays

Payment happens after:

- interview is completed
- identity summary is confirmed
- customer email is entered
- required consent is accepted

No login is required.

The payment step should be a single clear action:

Continue to Payment

For development and staging, mock purchase is allowed.

For real launch validation, at least one payment path must simulate or verify payment state end-to-end without bypassing the order lifecycle.

### 5. What the User Sees After Payment

After payment, the user must see a clear receive state:

- payment received or mock payment confirmed
- Collection preparation started or completed
- order number
- delivery email
- next step
- link to order status or Collection Vault when ready

The success page should not feel like a receipt only.

It should feel like:

"Your Collection is being prepared."

### 6. How the User Gets the Collection

The user receives the Collection through:

- on-screen success or order status path
- email delivery when available
- private Download Vault
- token-protected access

The user should never need an account for MVP.

The user should never receive a public file URL.

The user should see one clear destination:

Receive Your Collection

## 2. Conversion Path

The MVP conversion path must fit within 5 pages.

### Target 5-Page Path

| Page | Purpose | Required action |
| --- | --- | --- |
| 1 | Landing / Offer | Understand offer and start |
| 2 | Create / Interview | Answer minimum identity questions |
| 3 | Confirm Identity | Review summary, enter email, continue |
| 4 | Checkout / Payment | Accept required consent and pay |
| 5 | Receive / Vault | See success state and access Collection |

### Current Risk

If the active implementation separates these into more than 5 user-facing decision pages, it is a BLOCKER for MVP conversion.

Specifically, the MVP should avoid this bloated path:

Landing -> Product Page -> Create Start -> Interview -> Confirm -> Checkout -> Payment Success -> Order Status -> Download Vault

That path contains too many context changes for a first launch test.

### MVP Compression Rule

The product page may exist, but it should not be required to complete purchase.

The create start page may exist, but it should not feel like an extra decision page.

Order status may exist, but it should not be required if the Collection is immediately ready in mock mode.

## 3. Checkout Strategy

### Login

Required: NO

Reason:

Login creates unnecessary friction before the customer has experienced value.

### Email

Required: YES

Reason:

Email is needed for:

- delivery
- order lookup
- vault access recovery
- support
- purchase receipt

Email should be collected before checkout, not after payment.

### Skip Payment

Allowed: DEV ONLY

Skip payment must never be available in production public flow.

Allowed use cases:

- internal QA
- founder demo
- staging flow verification
- worker/delivery testing

### Mock Purchase

Supported: YES

Mock purchase is allowed for MVP validation only if:

- it creates a real order state transition
- it records payment as mock/test, not real
- it triggers the same post-payment delivery path
- it does not weaken paid-order security rules
- it is not exposed as a public free bypass

### Payment Rule

The MVP must prove one thing:

A customer can move from intent to paid-or-mock-paid order to received Collection without manual intervention.

## 4. Trust Layer

The MVP trust layer must be minimal. Do not overload the buyer with legal language.

### Layer 1: Trust Mechanism

Private by default.

Promise:

Your Collection is not published publicly. It is prepared for your private family use.

### Layer 2: Safety Explanation

Symbolic and heritage-inspired.

Promise:

The Collection is personal and symbolic. It does not claim official heraldic rights, legal arms, or certified ancestry.

### Layer 3: Delivery Guarantee

Receive your Collection or get support review.

Promise:

If your Collection cannot be prepared or delivered after required retries, support will review replacement, regeneration, or refund eligibility.

The MVP should not add more trust layers before payment.

Too much trust copy becomes fear copy.

## 5. Product Delivery

### After Payment Page

The user sees a Receive Collection page or success page with:

- order number
- payment state
- Collection state
- delivery email
- expected delivery status
- vault access when ready

If generation is instant or mocked, the page should show:

Your Family Legacy Collection is ready.

If generation is asynchronous, the page should show:

Your Family Legacy Collection is being prepared.

### Content Received

The MVP Collection should be presented as one private Collection, not a list of files.

The customer receives:

- Crest Artwork
- Heritage Certificate
- Family Story
- Symbol Guide
- Private Vault Access
- Archive Package

The interface can still technically deliver separate assets, but the user-facing framing is:

Your Collection is ready.

### How Content Is Presented

The presentation order should be:

1. Collection title
2. short opening note
3. primary artwork preview
4. artifact list
5. receive/download actions
6. support note
7. symbolic disclaimer

Do not make the first post-payment experience feel like a file manager.

### Email

Email is required for MVP.

Minimum email content:

- order number
- Collection status
- private vault link when ready
- support email
- disclaimer

Email should not include raw private file URLs.

### Download Vault

Required: YES

The vault is the MVP delivery home.

It must show:

- Collection name
- order number
- ready/not-ready status
- artifacts available
- token expiry
- support path

### Token

Required: YES

Vault access must use a token-protected link.

Rules:

- token must not be public-indexable
- token URL must not appear in sitemap
- token should not be logged as plain text
- token should have expiry or revocation behavior

## 6. Failure Points

| # | Failure point | Risk | Why it matters |
| --- | --- | --- | --- |
| 1 | Landing page does not explain offer fast enough | High | User leaves before understanding value. |
| 2 | User thinks this is just an AI image tool | High | Price resistance increases immediately. |
| 3 | Product value depends on file count | High | $69 feels expensive for digital assets. |
| 4 | CTA choices split attention | Medium | User browses instead of starting. |
| 5 | Create start page feels like another landing page | Medium | Flow feels longer than it is. |
| 6 | Interview feels like prompt input | High | Identity recognition weakens before payment. |
| 7 | Interview asks too little about occasion or recipient | High | Final identity summary feels generic. |
| 8 | API cannot create interview | High | User cannot enter funnel. |
| 9 | Answer save fails during interview | High | User loses trust and abandons. |
| 10 | Confirm page shows placeholder-like summary | High | User does not feel enough confidence to pay. |
| 11 | Email validation blocks legitimate users | Medium | Checkout cannot proceed. |
| 12 | Product price fails to load | High | User cannot trust checkout. |
| 13 | Price differs from founder messaging | High | Launch test produces invalid learning. |
| 14 | Consent labels feel cold or confusing | Medium | Buyer hesitates at payment step. |
| 15 | Stripe/mock payment cannot create session | High | Revenue loop breaks. |
| 16 | Payment success does not trigger delivery state | High | User feels paid but not served. |
| 17 | Collection generation is not ready | High | User sees an empty vault. |
| 18 | Email is not sent or not received | Medium | User may not find Collection later. |
| 19 | Vault token fails or expires too soon | High | Delivery promise fails. |
| 20 | Download page feels like files instead of Collection | Medium | Emotional value collapses after purchase. |

## 7. MVP Success Condition

MVP success must be measurable.

### Primary Success Conditions

The MVP is successful when:

1. A real or test user can complete the full flow without founder intervention.
2. An order is created.
3. Payment is completed or mock-completed.
4. Payment state is reflected in the system.
5. A Collection delivery state is created.
6. The user can access a private Download Vault.
7. The user can receive or view at least one completed Collection artifact.

### Conversion Success Metrics

Minimum first validation targets:

| Metric | MVP pass threshold |
| --- | ---: |
| Landing-to-start rate | 20%+ from warm invited users |
| Interview completion rate | 60%+ of starters |
| Confirm-to-checkout rate | 50%+ of completed interviews |
| Checkout completion rate | 50%+ of checkout starters in test mode |
| Paid/mock-paid order delivery rate | 90%+ |
| Vault access success rate | 90%+ |
| User understands what they bought | 80%+ in founder follow-up |
| User says it could be a gift | 50%+ |
| User would share with family | 30%+ |

### MVP Failure Conditions

The MVP fails if:

- users cannot complete payment
- users pay but cannot access delivery
- users do not understand what they bought
- users describe it as "just AI images"
- users need founder support to finish the journey
- mock payment bypasses the real order lifecycle

## 8. Minimal Implementation Scope

This is the ONLY required MVP scope.

### Must Exist Now

1. One clear landing entry.
2. One primary CTA.
3. One Family Legacy Collection offer.
4. One guided create/interview flow.
5. One identity confirmation step.
6. Email capture.
7. Required consent.
8. Checkout page.
9. Stripe test or mock payment path.
10. Payment state transition.
11. Post-payment success/receive page.
12. Collection delivery state.
13. Download Vault.
14. Token-protected access.
15. Support contact.
16. Clear symbolic/non-official disclaimer.

### Must Not Expand Now

Do not add:

- second product
- additional packages
- subscription
- physical products
- Vault+
- family account system
- public galleries
- share center
- Pinterest strategy
- SEO page expansion
- surname pages
- wedding-specific product
- Father's Day product
- memorial product
- advanced collection editor
- regenerate controls
- referral program
- community features
- mobile app
- multilingual output
- AI model switching UI
- admin quality dashboard beyond necessary operations

## MVP Flow Diagram

Text version:

Visitor lands on MyKinLegacy
-> understands "private Family Legacy Collection"
-> clicks Begin Your Legacy
-> answers minimum family identity interview
-> reviews identity summary
-> enters delivery email
-> accepts required consent
-> completes payment or mock payment
-> sees receive/success state
-> Collection is prepared or ready
-> receives vault link on screen and/or email
-> opens private Download Vault
-> views or downloads Collection artifacts

## MVP Kill List

These must be deleted from the immediate launch mindset or delayed until after the first paid loop works:

1. More products.
2. More packages.
3. Pricing ladder.
4. Subscription.
5. Physical fulfillment.
6. Advanced vault.
7. Public gallery.
8. Referral engine.
9. Full sharing engine.
10. SEO expansion.
11. Pinterest campaigns.
12. AI search architecture.
13. Blog/content library.
14. Founder manifesto pages.
15. Complex onboarding.
16. User accounts.
17. Multi-language launch.
18. Regeneration marketplace.
19. Admin workflow perfection.
20. Visual redesign perfection.
21. Long interview system.
22. Multiple life-moment branches.
23. Dynamic product recommendations.
24. Upsells.
25. Coupons and discounts.
26. Countdown urgency.
27. Unvalidated testimonials.
28. Complex refund automation.
29. Public social previews.
30. Any feature not required to create, pay, receive, and access one Collection.

## Final MVP Standard

The MVP is not "a complete brand experience."

The MVP is not "the best possible Collection."

The MVP is not "a scalable growth engine."

The MVP is a paid proof loop:

A stranger understands the offer, creates one Family Legacy Collection, pays or mock-pays through the real order path, receives a private vault, and can access the Collection without manual rescue.

If that loop works, MyKinLegacy has a business test.

If that loop does not work, everything else is premature.
