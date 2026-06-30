# Launch Readiness Audit v1.0

Project: Launch Sprint 001  
Brand: MyKinLegacy  
Core offer reviewed: Family Legacy Collection  
Primary question: If the site launched today, would someone buy?

## Executive Verdict

Short answer: a small number of warm, founder-invited users might buy, but the site is not ready for cold public launch.

The current website communicates a real offer: a private Family Legacy Collection with crest artwork, certificate, story, symbol guide, and vault delivery. The product is visible enough that a motivated visitor can understand the broad category.

The main launch risk is not whether the site has pages. It does. The risk is that the emotional reason to pay is still weaker than the functional description. The site still often feels like an AI digital delivery tool instead of a family meaning product. A stranger may understand "I get AI-generated files," but may not yet feel "this is worth preserving, gifting, and paying for today."

Current launch status:

- Ready for: guided founder testing with warm users.
- Not ready for: cold paid traffic, broad public launch, or claims of validated conversion.
- Highest-risk area: value proof before payment.
- Highest-leverage fix area: first-screen promise, Collection value framing, interview depth, and trust proof.

## Audit Scope

Reviewed the customer-facing flow and source content for:

- Home page
- Family Legacy Collection page
- Create page
- Guided interview flow
- Confirmation flow
- Checkout flow
- Support page
- Legal and policy pages
- Product data and current pricing references
- Existing strategic documents relevant to launch readiness

This audit did not modify code, pages, database, API, payment logic, or product functionality.

## 10-Point Launch Readiness Scorecard

| # | Check | Score | Assessment |
| --- | --- | ---: | --- |
| 1 | Home page explains what is sold within 5 seconds | 6/10 | The headline and hero copy explain a Family Legacy Collection, but the offer still mixes archive, AI-generated collection, crest artwork, PDFs, and vault delivery. The visitor can understand the category, but not instantly feel the emotional reason to buy. |
| 2 | User knows why it is worth buying | 5/10 | The site lists artifacts and privacy benefits, but does not yet prove why the Collection is worth keeping, gifting, or revisiting. The "why now" and "why this family" arguments are underdeveloped. |
| 3 | CTA is unique and clear | 4/10 | There are multiple CTA labels and paths: Begin Your Legacy, View Collection, Collection, How It Works, Gift Ideas, FAQ. The primary action is present, but not singular enough for launch conversion. |
| 4 | Page has limited distraction | 5/10 | The structure is orderly, but there are many sections and repeated explanations. Functional delivery language competes with emotional collection language. |
| 5 | No step causes purchase abandonment | 4/10 | The purchase path depends on API calls for interview creation, product detail, order creation, consent, and Stripe session creation. Any backend or environment issue blocks the user. Consent checkboxes also appear as raw internal terms, increasing friction. |
| 6 | Interview is not too long | 7/10 | The current interview is short at six steps. Length is acceptable. The issue is quality, not duration: questions still feel like prompt ingredients rather than a documentary-style family interview. |
| 7 | Collection is easy to understand | 5/10 | The artifact list is understandable, but the Collection still feels close to "files in a vault." It needs stronger opening, examples, and gift context to feel like a keepsake. |
| 8 | $69 has enough value support | 3/10 | The current implementation appears to use 4900 cents in seed/test data, while strategy discusses $69. Even at $49, value proof is thin. At $69, the site needs a much stronger emotional and presentation case. |
| 9 | Trust is sufficient | 5/10 | Privacy, legal disclaimers, refund policy, and symbolic-heritage boundaries are present. However, there is a "4.9 customer rating" line without visible proof, no real examples, no founder note, no early customer quote, and no transparent delivery expectation. |
| 10 | Site no longer feels like an AI Tool | 5/10 | Brand language has improved, but "AI-generated," "PNG," "PDF," "Download Vault," "Stripe," "generate," and prompt-style interview choices still make the experience feel tool-like. |

Overall launch readiness score: 49/100.

Interpretation:

- 0-39: do not invite buyers.
- 40-59: founder-guided test only.
- 60-79: limited public launch.
- 80-100: ready for meaningful cold traffic.

Current result: founder-guided test only.

## Key Observations

### 1. The offer is visible, but not yet emotionally inevitable

The site does say what the customer receives. It does not yet make the customer feel the Collection is something their family should have.

Current dominant impression:

"I will get AI-generated crest files, PDFs, and a vault."

Needed launch impression:

"This helps my family recognize, preserve, and share who we are."

### 2. The home page still sells deliverables before transformation

The hero mentions surname, values, symbols, story, crest artwork, printable PDFs, symbolic explanations, and download vault. That is clear, but it is still product inventory.

For a real buyer, the faster emotional question is:

"Who is this for, and why would it matter to my family right now?"

### 3. The Collection page needs proof, not more description

The Family Legacy Collection page explains the package, but it does not yet demonstrate a finished Collection deeply enough. There is no real sample story, sample certificate language, sample symbol explanation, or example use case.

For a $69 decision, the customer needs to imagine the recipient opening it.

### 4. The interview is short enough, but too shallow

The six-step interview reduces friction, which is good. But the questions are still mostly:

- name
- origin
- values
- animal
- colors/style
- motto

These are useful for generation, but weak for recognition.

The interview currently misses high-value launch questions:

- Why are you creating this?
- Who is this for?
- What family story should not be forgotten?
- Which person shaped the family most?
- What should your children remember?
- What should be avoided?

### 5. Consent language is accurate but too internal

Checkout consent labels currently expose raw operational terms such as:

- terms accepted
- privacy policy accepted
- heritage disclaimer accepted
- ai generation consent
- email delivery consent

This is legally clear, but emotionally cold. It may make checkout feel like a system form rather than a premium family collection.

### 6. Trust pages exist, but market trust is not proven

Legal trust exists. Human trust is weak.

The site has privacy, terms, refund, delivery, support, and disclaimers. That is good. But a buyer still lacks:

- real sample output
- founder explanation
- early customer reactions
- visible delivery timeline
- quality guarantee language
- what happens if the result feels wrong

### 7. Price is internally inconsistent

Strategic documents discuss $69. Current seed data and tests reference 4900 cents. Product pages load price from the API, so the visible price depends on backend data.

This creates launch ambiguity:

- If the intended launch price is $49, current strategic pricing language is ahead of the implementation.
- If the intended launch price is $69, current data likely needs a future price decision before launch.

This audit does not change pricing. It flags the mismatch as a launch risk.

### 8. The site still overuses "AI-generated"

The disclaimer needs AI clarity. The sales narrative does not need AI as the hero.

Current repeated phrase:

"AI-generated, heritage-inspired symbolic design."

This is safe but can reduce perceived keepsake value if it appears too early or too often.

## Would Someone Buy Today?

### Warm founder-invited user

Yes, possibly.

Likely buyer profile:

- already trusts the founder
- wants a meaningful family gift
- accepts early-stage rough edges
- is curious about AI-assisted family artifacts
- is willing to give feedback

Expected result:

- Some users will complete the journey if the backend and payment flow work.
- Purchase motivation will depend heavily on founder explanation outside the website.

### Cold visitor from Google, Pinterest, AI Search, or social

Low probability.

Main reasons:

- not enough proof of finished Collection quality
- not enough emotional specificity
- not enough reason to buy now
- not enough trust/social proof
- CTA and offer framing still split attention
- interview may feel like prompt setup

### Gift buyer

Moderate potential, but not fully unlocked.

The site mentions weddings, anniversary, holidays, and gifts. It does not yet strongly show recipient moments such as father, mother, grandparents, memorial, or wedding table opening.

### Conclusion

If launched today, MyKinLegacy could get early test purchases from warm traffic. It is unlikely to convert cold traffic efficiently without immediate copy, trust, and collection-proof improvements.

## Top 20 Must-Fix Issues Before Real Launch

### High Priority

1. The home page does not make one sharp promise in the first 5 seconds.
   - Current issue: the visitor sees many concepts at once.
   - Launch impact: weak immediate comprehension.

2. The site still sells artifacts and delivery more than transformation.
   - Current issue: PNG, PDF, ZIP, vault, and AI language dominate.
   - Launch impact: perceived value drops.

3. CTA is not singular enough.
   - Current issue: Begin Your Legacy and View Collection compete in the hero.
   - Launch impact: visitors may browse instead of starting.

4. The Collection page lacks a convincing finished example.
   - Current issue: mock previews are abstract.
   - Launch impact: buyer cannot judge quality.

5. $69 is not currently supported by visible value proof.
   - Current issue: emotional, gift, and preservation value are not strong enough above purchase point.
   - Launch impact: price objection.

6. Current product data appears to use $49, while launch question assumes $69.
   - Current issue: strategic price and implementation price may not match.
   - Launch impact: confusion, wrong test result, or founder misread.

7. The interview does not ask the most purchase-relevant family questions.
   - Current issue: it asks for design inputs, not life-moment meaning.
   - Launch impact: weaker final Collection recognition.

8. Checkout consent labels feel raw and internal.
   - Current issue: checkbox labels are system terms.
   - Launch impact: trust friction at payment.

9. The "4.9 customer rating" line needs proof or removal before real launch.
   - Current issue: no visible evidence is attached.
   - Launch impact: trust risk.

10. The site still positions AI too visibly as the product mechanism.
    - Current issue: AI-generated appears in metadata, hero, product, policy, and disclaimers.
    - Launch impact: lowers keepsake value and increases skepticism.

11. Product page can show API-loading or API-error state if backend is unavailable.
    - Current issue: package details depend on API.
    - Launch impact: direct purchase blocker.

12. The user cannot clearly see what happens if the result is disappointing.
    - Current issue: refund/delivery policy exists, but quality assurance is not clearly explained in the purchase path.
    - Launch impact: buyer anxiety.

### Medium Priority

13. Gift use cases are too generic.
    - Current issue: wedding, anniversary, ancestry gift, home office are listed, but not emotionally demonstrated.
    - Launch impact: weaker gift conversion.

14. The opening experience does not yet feel ceremonial.
    - Current issue: the Collection is described as delivery, not discovery.
    - Launch impact: lower preservation value.

15. Family Legacy Collection naming is clear internally but may need a one-sentence plain-English explanation.
    - Current issue: new visitors may ask, "Is this a crest, story, certificate, or gift?"
    - Launch impact: comprehension delay.

16. The confirmation page shows placeholder-like summary rows.
    - Current issue: "From your interview draft" and generic values may not feel personal.
    - Launch impact: weak pre-payment confidence.

17. There is no clear delivery time expectation in the sales path.
    - Current issue: "instant access" appears in trust row, while generation may take time.
    - Launch impact: expectation mismatch.

18. Support is present but reactive.
    - Current issue: support page handles problems, but buyer reassurance before purchase is light.
    - Launch impact: preventable doubts remain.

### Low Priority

19. Navigation has several educational paths before purchase.
    - Current issue: How It Works, Gift Ideas, FAQ, Collection, and CTA all compete.
    - Launch impact: lower focus, but not fatal.

20. Brand language is not fully aligned with the Brand Language System.
    - Current issue: Download, files, generate, package, and AI-generated still appear frequently.
    - Launch impact: weaker premium feel over time.

## Launch Gate Recommendation

For the next 7 days, the safest launch mode is:

Founder-guided private beta, not public launch.

Recommended audience:

- 10 to 20 warm users
- gift buyers
- parents
- grandparents
- wedding-adjacent users
- people already interested in family history or meaningful gifts

Required founder framing:

"This is an early private test of MyKinLegacy. The goal is to see whether a Family Legacy Collection feels meaningful enough to preserve and share."

Do not frame it as:

"Try this AI family crest generator."

## What Must Be Learned From First Test Users

The first launch test should answer:

1. Can users explain what MyKinLegacy sells after 5 seconds?
2. Do users understand Family Legacy Collection without founder explanation?
3. Which artifact creates the most desire?
4. Does the interview feel meaningful or like a form?
5. Does the user believe the Collection could be a gift?
6. Does the user hesitate at the price?
7. Does the user trust the symbolic/non-official positioning?
8. Does "AI-generated" increase interest or reduce value?
9. Does checkout feel safe or cold?
10. Would the user share the Collection with family?

## Final Decision

Launch readiness decision: Conditional test only.

MyKinLegacy should not treat the current site as ready for broad launch. It is ready to be used as a learning instrument with invited users if the founder personally frames the test, watches where users hesitate, and records whether anyone is willing to pay without heavy persuasion.

The current site can answer the first real question:

"Does anyone care enough to try?"

It cannot yet reliably answer:

"Can this convert cold traffic at scale?"

That comes after the High Priority issues are resolved and at least a small number of real users show willingness to pay.
