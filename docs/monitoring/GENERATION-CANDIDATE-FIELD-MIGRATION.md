# Generation Candidate Field Migration

Date: 2026-07-16

## Meaning

`generation_candidate_count = 3` describes internal generation candidates. It does not describe or control the customer package. The customer receives one Final Crest and one of each supporting publication/archive.

## Dependency Inventory

- Seed source: `packages/database/prisma/seed-data.ts`.
- Seed writer: `packages/database/prisma/seed.ts`.
- Storage: `ProductPackage.generationConfigJson` in `generation_config_json`.
- Public reader: Product API serializer.
- Generation runtime: no read dependency.
- Checkout/order processing: no read dependency.
- ZIP/Vault/download: no read dependency.
- Order snapshots: not modified.

Historical references remain in audit documentation only. The unused optional domain type was removed.

## Migration

Before migration:

- records inspected: 1
- records containing only `image_count`: 1
- value: 3
- conflicts: 0

After migration:

- records migrated: 1
- records containing `image_count`: 0
- records containing `generation_candidate_count`: 1
- value: 3
- conflicts: 0

The migration ran under the production lock and a Prisma transaction. A complete ProductPackage generation-config snapshot was written before the transaction with mode `600`. No order, customer, PII, payment, artifact, or delivery record was read or modified.

The API no longer translates the old field. It only removes `image_count` defensively from public output. The one-time deploy hook was removed after successful migration; the manual migration/rollback utility remains available.

## Rollback

`deployment/migrate-generation-candidate-count.sh --rollback <backup-file>` restores the exact backed-up JSON values inside a transaction. Backup files are restricted to `deployment/backups/generation-config`.
