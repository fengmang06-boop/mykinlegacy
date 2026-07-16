# Live Product Terminology Audit

Audit date: 2026-07-16

Decision: PASS

## Sources checked

- Live homepage: HTTP 200
- Live Family Legacy Collection page: HTTP 200
- Live digital delivery page: HTTP 200
- Live product API: HTTP 200
- Current customer-facing web labels
- Actual extracted production archive for order `AHL-20260711-01KX7S88`

## Customer-facing contract

The approved public terminology is:

1. Final Crest
2. Heritage Certificate
3. Family Story
4. Meaning Behind Your Crest
5. Complete Collection

The actual production archive contains one customer-facing crest and the following ordered folders:

- `00-Welcome/Welcome.txt`
- `01-Final-Crest/Final-Crest.png`
- `02-Heritage-Certificate/Heritage-Certificate.pdf`
- `03-Family-Story/Family-Story.pdf`
- `04-Meaning-Behind-Your-Crest/Meaning-Behind-Your-Crest.pdf`

## Batch 02 alignment

All four articles now describe the product as one Final Crest, one Heritage Certificate, one Family Story, one Meaning Behind Your Crest guide, and one Complete Collection archive delivered digitally.

The wedding article also states before its first product introduction that printing and framing are arranged separately when a physical presentation is preferred.

## Legacy internal field

The live product API still exposes `generation_config.image_count: 3`. This is an internal legacy configuration field. The same API's required deliverables list has quantity 1 for `crest_variant_1_png`, and the actual production archive contains one `Final-Crest.png` only.

This discrepancy is recorded as a non-customer-facing maintenance risk. It does not block this content publication and was not changed because this sprint forbids product or API changes.

## Result

`BLOCKED_BY_PRODUCT_CONTRACT_MISMATCH` was not triggered.

