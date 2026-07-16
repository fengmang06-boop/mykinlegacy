# Product API Legacy Field Fix Report

## Change

The customer-facing product serializer now:

1. renames `generation_config.image_count` to `generation_config.generation_candidate_count`;
2. adds `customer_deliverables` counts derived from the already-filtered package deliverable records;
3. leaves the database seed and all generation code unchanged.

## Safety basis

- Repository-wide search found no runtime `image_count` reader outside Product API serialization.
- Production generation uses `REQUIRED_DELIVERABLES`, not package generation config.
- ZIP uses `CUSTOMER_PACKAGE_DELIVERABLES` and one crest.
- Vault explicitly filters internal variants 2 and 3.
- The response still includes the existing itemized deliverables array.

## Rollback

Revert the two changes in `apps/api/src/products/products.service.ts` and its test. No data rollback, migration, seed, artifact regeneration, or order repair is required.
