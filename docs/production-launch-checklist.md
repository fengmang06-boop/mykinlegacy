# Production Launch Checklist Draft

This is a draft checklist for Milestone 17 preparation only. Do not use it as approval to launch production.

## Domain And SSL

- Confirm DNS for `mykinlegacy.com`.
- Confirm DNS for production API and admin hosts.
- Enable SSL certificates for all production hosts.
- Verify HTTPS redirects.
- Verify canonical URLs use `https://mykinlegacy.com`.

## Production Environment

- Create production env vars through a secret manager.
- Do not commit production secrets.
- Set `NODE_ENV=production`.
- Set production `DATABASE_URL`.
- Set production `REDIS_URL`.
- Set production `APP_WEB_URL`, `API_PUBLIC_URL`, and `ADMIN_WEB_URL`.
- Confirm `ADMIN_BOOTSTRAP_ENABLED=false` after initial admin setup.

## Stripe

- Add Stripe live keys later through the secret manager.
- Configure Stripe webhook endpoint: `/api/v1/webhooks/stripe`.
- Verify webhook signing secret.
- Run invalid signature, duplicate webhook, and amount mismatch tests.
- Confirm frontend success redirect cannot mark an order paid.

## Database And Redis

- Run Prisma migrate deploy.
- Verify seed data.
- Create database backup before launch.
- Confirm automated backup schedule.
- Confirm Redis availability and persistence policy.

## Worker And Queue

- Confirm worker process is running.
- Confirm Redis connection.
- Confirm outbox dispatcher is enabled.
- Confirm generation queues are registered.
- Confirm DLQ monitoring is visible.

## Security And Privacy

- Run `corepack pnpm security:check`.
- Run no-secrets scan.
- Confirm private pages are noindex.
- Confirm admin pages are noindex.
- Confirm robots and sitemap expose only public pages.
- Confirm raw download tokens are not stored.
- Confirm signed URLs are not stored.
- Confirm full storage keys are not exposed publicly.

## Public Pages

- Verify `/`.
- Verify `/family-legacy-collection`.
- Verify `/family-crest-generator`.
- Verify `/ai-family-crest-generator`.
- Verify `/heritage-gift`.
- Verify `/family-legacy-gift`.
- Verify `/symbolic-family-crest`.
- Verify `/support`.
- Verify `/privacy`.
- Verify `/terms`.
- Verify `/refund-policy`.
- Verify `/digital-delivery`.
- Verify `/disclaimer`.

## Legal And Trust

- Review privacy page.
- Review terms page.
- Review refund policy.
- Review digital delivery page.
- Review disclaimer page.
- Confirm support email is `support@mykinlegacy.com`.
- Confirm pages do not claim official, legally granted, or historically certified coats of arms.

## Test Order

- Create a test interview.
- Submit answers.
- Confirm HouseDNA.
- Create order.
- Accept consent.
- Complete payment test.
- Verify webhook marks order paid.
- Verify worker creates required assets.
- Verify download token is created.
- Verify delivery email is sent.
- Verify Download Vault opens.
- Verify asset signed URL works.
- Verify admin can view order, manifest, assets, token, and email status.

## Email

- Configure production email provider later through secret manager.
- Verify support email sending.
- Verify delivery email rendering.
- Verify delivery email contains Download Vault link only.
- Verify logs do not contain raw token.

## Monitoring And Logs

- Confirm API logs.
- Confirm worker logs.
- Confirm error tracking or alert channel.
- Confirm recovery scan settings.
- Confirm DLQ alert path.
- Confirm uptime checks.

## Rollback Plan

- Document previous deployment artifact.
- Document database rollback or restore path.
- Document env rollback path.
- Confirm worker can be stopped safely.
- Confirm payment webhooks remain idempotent during rollback.

## Final Visual Review

- Review desktop and mobile homepage.
- Review product page.
- Review create flow.
- Review Download Vault.
- Review support and policy pages.
- Capture screenshots before launch.

## Final Gate

- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm security:check`
- Staging smoke passed.
- Staging E2E passed.
- Manual test order passed.
