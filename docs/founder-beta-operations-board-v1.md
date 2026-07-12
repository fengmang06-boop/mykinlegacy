# MyKinLegacy Founder Beta Operations Board V1

## Purpose

Track exactly 10 controlled, real Founder Beta orders from invitation through recipient reaction. This board is complete only when all 10 slots have a final outcome.

Use buyer initials or an internal buyer reference. Do not record email addresses, payment details, vault tokens, or other secrets in this document.

## Status Vocabulary

- `Not started`: No activity yet.
- `In progress`: The step has started but is not confirmed complete.
- `Yes`: Confirmed by production evidence or buyer feedback.
- `No`: Confirmed not to have happened.
- `N/A`: Not applicable, with a note explaining why.
- `Failed`: The step failed and requires an issue reference.

## Ten-Order Board

### Order And Delivery

| Slot | Order number | Buyer | Recipient type | Occasion | Payment status | Generation status | Email delivered | Vault opened | ZIP downloaded |
|---:|---|---|---|---|---|---|---|---|---|
| 01 | Reserved - awaiting real order | Founder confirmation required | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 02 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 03 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 04 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 05 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 06 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 07 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 08 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 09 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |
| 10 | Pending | Pending | Pending | Pending | Not started | Not started | Not started | Not started | Not started |

### Artifact Engagement And Outcome

| Slot | Final Crest viewed | Certificate viewed | Story viewed | Meaning Guide viewed | Buyer feedback | Recipient reaction | Refund requested | Critical issue | Recommended follow-up |
|---:|---|---|---|---|---|---|---|---|---|
| 01 | Not started | Not started | Not started | Not started | Form prepared | Pending | Unknown | None confirmed | Founder provides the first real order number |
| 02 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 03 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 04 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 05 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 06 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 07 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 08 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 09 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |
| 10 | Not started | Not started | Not started | Not started | Pending | Pending | No | None | Pending |

## Launch Metrics

Update counts from the same 10-slot cohort. Never replace counts with impressions.

| Metric | Definition | Current | Target / gate |
|---|---|---:|---:|
| Invited | People directly invited into this Founder Beta cohort | 0 | 10 or more |
| Started questionnaire | Invitees who submitted at least one answer | 0 | Observe |
| Reached checkout | Invitees who opened checkout with a valid order | 0 | Observe |
| Paid | Orders with confirmed payment | 0 | 10 completed cohort slots |
| Email delivered | Paid orders with confirmed delivery email success | 0 | At least 8 |
| Vault opened | Paid buyers who opened the private Vault | 0 | Observe |
| ZIP downloaded | Paid buyers with a confirmed Complete Collection download | 0 | At least 8 successful orders overall |
| Positive feedback | Buyers whose overall feedback is positive | 0 | Observe |
| Felt personal | Buyers answering yes to personal relevance | 0 | At least 7 of 10 |
| Recommendation intent | Buyers answering yes to recommending MyKinLegacy | 0 | At least 7 of 10 |
| Refunds | Orders with a requested refund | 0 | No more than 1 of 10 |

### Funnel Rates

- Questionnaire start rate = `Started questionnaire / Invited`.
- Checkout reach rate = `Reached checkout / Started questionnaire`.
- Paid conversion rate = `Paid / Reached checkout`.
- Vault open rate = `Vault opened / Paid`.
- ZIP download rate = `ZIP downloaded / Paid`.
- Personal relevance rate = `Felt personal / completed feedback responses`.
- Recommendation rate = `Recommendation intent / completed feedback responses`.

## Issue Rules

### P0: Interrupt Founder Beta

Payment failure, email delivery failure, inaccessible Vault, failed ZIP download, broken file, or wrong recipient data.

- Stop inviting or processing additional beta buyers when a repeatable P0 is confirmed.
- Record the affected order, evidence, owner, containment, and retest result.
- Resume only after the issue is fixed and one production retest passes.

### P1: Continue And Record

Personalization weakness, confusing wording, or visual disappointment.

- Do not interrupt Founder Beta unless the issue is reclassified as P0.
- Record buyer wording verbatim and group similar findings for post-cohort review.

### P2: Backlog Only

Ideas and optional improvements.

- Record briefly without changing the current Founder Beta scope.
- Review only after all 10 orders have final outcomes.

## Issue Log

| Issue ID | Date | Order | Priority | Current behavior | Customer impact | Owner | Status | Retest evidence |
|---|---|---|---|---|---|---|---|---|
| None | - | - | - | - | - | - | - | - |

## Ten-Order Completion Criteria

Founder Beta is complete when:

1. All 10 board slots contain a real paid order number.
2. Every order has a final payment, generation, email, Vault, and ZIP status.
3. Final Crest, Certificate, Story, and Meaning Guide viewing status is recorded for every order.
4. Buyer feedback has been requested for all 10 orders and each response or non-response is recorded.
5. Recipient reaction is recorded when available; unavailable reactions are explicitly marked `N/A`.
6. Every refund and issue has a final status.
7. No P0 issue remains unresolved.
8. The daily status and final metrics reconcile with the 10 order rows.

An order counts as successfully complete only when payment is confirmed, generation completes, email is delivered, the Vault opens, the ZIP downloads, and all four customer-facing artifacts open correctly with the right recipient data.

## Public Beta Recommendation Rule

Recommend Public Beta only when all conditions are true:

- At least 8 of 10 orders complete successfully.
- At least 7 of 10 buyers say the collection felt personal.
- At least 7 of 10 buyers say they would recommend MyKinLegacy.
- No unresolved P0 issue exists.
- Refund requests are no more than 1 of 10.

If any condition fails, the result is `DO NOT RECOMMEND PUBLIC BETA`. Record the failed gate and the smallest corrective action before another controlled validation round.

## Final Decision Record

- Cohort completed on: Pending
- Successful orders: 0 / 10
- Felt personal: 0 / 10
- Would recommend: 0 / 10
- Refunds: 0 / 10
- Unresolved P0 issues: 0
- Public Beta recommendation: Pending
- Founder decision and date: Pending
