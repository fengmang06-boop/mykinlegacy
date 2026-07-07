# MENSSKULL Growth Constitution V1.0

Status: Active
Scope: All MENSSKULL Growth OS modules, Etsy integrations, AI analysis, optimization plans, image workflows, prompt workflows, reports, exports, and future automation.
Authority: Highest project rule for Growth development.

## 1. Core Principle

MENSSKULL Growth OS is a decision-support system. It may sync, analyze, score, draft, compare, track, and report. It must not silently modify live marketplace, customer, review, payment, or production commerce state.

## 2. Etsy Compliance

All Etsy work must comply with Etsy Terms of Use and Etsy API Terms.

The system must never:

* Automate listing edits without explicit user approval.
* Automate review replies.
* Automate customer messages.
* Scrape authenticated competitor data.
* Bypass Etsy API restrictions.
* Imitate human behavior to avoid rate limits.
* Perform actions that could trigger account penalties.

## 3. Default Etsy Mode

Every Etsy-related feature defaults to:

* Read-only.
* Manual approval required.
* Version history required.
* Rollback support required.
* Evidence required.
* Risk assessment required.

No Etsy write action may exist unless the user explicitly requests that specific write action and confirms it a second time before execution.

## 4. Evidence Standard

Every recommendation for title, tags, images, price, positioning, promotion, or product priority must include:

* Evidence from synced data, stored analysis, or manually supplied source data.
* Risk level.
* Expected benefit.
* Rollback plan.
* Human review requirement.

No recommendation may rely on invented sales, views, favorites, reviews, materials, dimensions, finishes, or competitor data.

## 5. Version History And Rollback

Before any future approved live change, the system must keep:

* Before snapshot.
* Proposed after snapshot.
* Approval record.
* Applied timestamp.
* Operator or requester.
* Rollback instructions.
* Verification result.

Local drafts and plans must be versioned enough to compare what changed and why.

## 6. Image Workflow

All image work follows the queue structure:

```text
growth/image-queue/
growth/generated-images/
growth/image-prompts/
```

Image prompts are draft-only instructions for manual review. Generated images must not replace Etsy listing images automatically. Every image suggestion must include evidence, risk, expected benefit, and rollback plan.

## 7. Prompt Workflow

Prompt templates must be stored under:

```text
growth/image-prompts/templates/
```

Prompts should be ready for Gemini or another approved image tool, but still remain drafts. They must include product facts from synced or manually verified data and avoid invented materials, claims, reviews, dimensions, or guarantees.

## 8. Growth Journal

Every important optimization must be recorded in the Growth Journal before it becomes an execution candidate.

Each journal entry must answer:

* What changed or is proposed.
* Which listing or module is affected.
* Evidence used.
* Constitution compliance result.
* Risk level.
* Expected benefit.
* Rollback plan.
* Manual approval status.

## 9. Forbidden Shortcuts

The system must not optimize for speed by weakening safety. It must not:

* Turn on Etsy write mode by default.
* Create hidden automation.
* Skip evidence.
* Skip manual approval.
* Hide risk.
* Treat AI output as final truth.
* Modify MyKinLegacy, Stripe, payments, checkout, or unrelated production services during Growth work.

## 10. Growth Priority

Growth work should prioritize:

1. Products with real demand signals.
2. Changes that can be manually reviewed.
3. Reversible improvements.
4. Clear buyer evidence.
5. Low account-risk execution.

MENSSKULL brand trust and marketplace safety outrank short-term traffic gains.
