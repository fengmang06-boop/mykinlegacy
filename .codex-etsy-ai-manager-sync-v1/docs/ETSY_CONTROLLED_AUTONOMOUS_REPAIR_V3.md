# MENSSKULL Etsy Controlled Autonomous Repair V3

V3 applies the Founder's standing authorization only to low-risk green-zone listings.

## Permanent Boundaries

- Monday-Friday only, Asia/Shanghai.
- Maximum three listings per day.
- Etsy Open API only; browser automation is forbidden.
- Automatic writes are limited to `title` and `tags`.
- Default state remains `ETSY_READ_ONLY_MODE=true` and `ETSY_WRITE_APPROVED=false`.
- Each listing receives an isolated one-time write window bound to the listing ID and SHA-256 of the exact diff.
- Any write, scope, quota, baseline, state, or verification failure stops all remaining writes without retry.

## Green Zone

All requirements must pass: active state, zero orders, no winner protection, no title/tag change within 30 days, no active tracking, confirmed material/type/structure, no IP or authenticity risk, a title/tag-only defect, an independent search angle, Repair Priority Score at least 85, independent confidence at least 90, complete rollback, valid SHA-256, and more than 20% Etsy quota remaining.

The priority score is evidence-adjusted at execution time. Technical defect and commercial/brand-fit scores remain fixed. Title/tag repairability can reach its maximum only after an exact valid title and 13-tag package exists. Change safety can reach its maximum only after the listing is active, order-free, outside cooldown and tracking, and clear of cross-field and IP risks. Data reliability can reach its maximum only with a fresh complete baseline, reliable identifiers, at least two evidence statements, and a valid rollback SHA-256. This does not lower the 85-point threshold.

## Yellow And Red Zones

Yellow candidates are prepared but never written automatically. Red candidates are permanently excluded from automatic writes until the blocking condition is resolved. The daily batch is never padded.

## Three-Layer Review

1. Proposal Generator creates the exact title, 13 tags, search intent, evidence, and priority score.
2. Deterministic Validator checks field limits, relevance, product facts, identifiers, IP risk, rollback, and exact diff.
3. Independent Auto Reviewer reclassifies the candidate as green, yellow, or red and calculates confidence.

Only green candidates passing all three layers can use the standing authorization.

## Candidate Backlog And Refill

- A plan may contain 10 to 215 ranked candidates.
- The execution review takes the best 15, prioritizing complete exact packages over incomplete drafts and excluding known protected candidates from the front of the queue.
- Only candidates with a supplied current baseline can advance beyond preparation.
- Missing proposals or baselines remain yellow and cannot consume a write slot.
- The batch is never padded, but a blocked candidate no longer prevents the next eligible candidate from being reviewed.

## Execution

Run:

```bash
npm run etsy:repair:v3 -- --plan config/controlled-autonomous-repair-v3/<plan>.json
```

The execution report, rollback files, exact verification, and D1/D3/D7/D14 tracking plan are stored under `exports/controlled-autonomous-repair-v3/`.
