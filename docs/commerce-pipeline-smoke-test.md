# MyKinLegacy Commerce Pipeline Smoke Test

Purpose: verify the MVP revenue path without changing product logic.

Flow under test:

`/create` -> order -> checkout -> Stripe webhook -> paid order -> placeholder generation -> private vault delivery placeholder.

## Required Environment

- `DATABASE_URL`
- `REDIS_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_BASE_URL`

Use Stripe test keys only for local validation.

## Local Services

From the project root:

```bash
corepack pnpm install
docker compose up -d mysql redis
corepack pnpm db:migrate:dev
corepack pnpm db:seed
corepack pnpm --filter @ai-heritage/api dev
corepack pnpm --filter @ai-heritage/worker dev
corepack pnpm --filter @ai-heritage/web dev
```

## Browser Path

1. Open `http://localhost:3000/create`.
2. Complete the guided flow.
3. Continue to checkout.
4. Accept the required consent items.
5. Create the Stripe test checkout session.
6. Complete payment using a Stripe test card.
7. Return to `/payment/success`.
8. Open `/order-status/<order_number>` and verify:
   - payment is `paid`
   - fulfillment moves to `queued`, `generating`, then `completed`
   - expected assets and generated assets match
   - vault availability becomes ready

## Stripe Webhook Simulation

Use Stripe CLI in a separate terminal:

```bash
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```

Copy the displayed webhook signing secret into `STRIPE_WEBHOOK_SECRET`, restart the API, then complete a Stripe test checkout from the browser path above.

## Private Vault Placeholder

The system stores only the token hash. The raw vault link is intentionally not recoverable from the database.

For the current MVP placeholder, delivery is verified by:

- `download_tokens` row exists for the paid order
- linked `download_token_assets` rows exist
- `email_logs` contains a mock delivery log with `masked_download_vault_link`
- `/downloads/:token` works only when a valid raw token is available from delivery

## Direct API Checks

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/orders/<order_number>
```

Expected order response after worker processing:

- `payment_status: paid`
- `fulfillment_status: completed`
- `generation_manifest.manifest_status: completed`
- `download_ready: true`

## Failure Checks

- Refreshing `/payment/success` must not mark an unpaid order as paid.
- Duplicate Stripe webhooks must not duplicate payment transactions.
- Vault access must reject invalid tokens.
- API responses must not expose token hashes, storage keys, raw prompts, or signed URLs except from the signed-url endpoint.
