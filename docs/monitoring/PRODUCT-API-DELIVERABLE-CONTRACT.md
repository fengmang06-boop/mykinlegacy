# Product API Deliverable Contract

## Customer contract

The public product is active at USD $49 and promises exactly:

- one Final Crest
- one Heritage Certificate
- one Family Story
- one Meaning Behind Your Crest
- one Complete Collection archive

## Public package response

The corrected package-level fields are:

```json
{
  "generation_config": {
    "generation_candidate_count": 3,
    "zip_required": true,
    "transparent_png": false,
    "required_pdf_count": 3
  },
  "customer_deliverables": {
    "final_crest_count": 1,
    "heritage_certificate_count": 1,
    "family_story_count": 1,
    "meaning_behind_your_crest_count": 1,
    "complete_collection_archive_count": 1
  }
}
```

`generation_candidate_count` is informational and describes internal candidate output. It is not a customer promise and does not control generation. `image_count` is no longer exposed.

The existing `deliverables` array remains the authoritative itemized customer contract and contains only:

1. `crest_variant_1_png`, quantity 1
2. `heritage_certificate_pdf`, quantity 1
3. `family_story_pdf`, quantity 1
4. `symbol_explanation_pdf`, quantity 1
5. `download_package_zip`, quantity 1

## Non-contract internal assets

`crest_variant_2_png` and `crest_variant_3_png` remain internal generation candidates. They are excluded from Product API customer deliverables, customer ZIP source entries, and Vault display/download lists.

## Compatibility

- No database migration
- No seed change
- No generation change
- No checkout change
- No order metadata change
- No ZIP/Vault/download change
- Public response adds one object and renames one misleading key
