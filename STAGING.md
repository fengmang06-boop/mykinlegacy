# Staging Deployment

This is the pre-production runbook for the MyKinLegacy MVP staging environment.

Staging is not production launch. It must use Stripe test mode, `AI_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, and `STORAGE_PROVIDER=local_private`.

## URLs

- Customer web: `https://staging.mykinlegacy.com`
- API: `https://api-staging.mykinlegacy.com`
- Admin: `https://admin-staging.mykinlegacy.com`
- Support email placeholder: `support@mykinlegacy.com`

## Prerequisites

- Node.js 22 or current LTS-compatible runtime
- Corepack / pnpm
- Docker Desktop or Docker Engine for the compose stack
- Stripe CLI for local webhook forwarding
- No live Stripe, OpenAI, email provider, S3, or R2 keys

If Docker is unavailable, use the process-based fallback below and record the blocker.

## Environment

Create a local staging env file from the safe example:

```bash
copy .env.staging.example .env.staging
```

Do not commit `.env.staging`. Staging secrets must be injected by a secret manager or server environment variables.

Required defaults:

```bash
NODE_ENV=staging
AI_PROVIDER=mock
EMAIL_PROVIDER=mock
STORAGE_PROVIDER=local_private
CLEANUP_DESTRUCTIVE_ENABLED=false
ADMIN_BOOTSTRAP_ENABLED=false
```

Use only Stripe test placeholders or Stripe test keys from the staging secret manager:

```bash
STRIPE_SECRET_KEY=replace_me_test_key_only
STRIPE_WEBHOOK_SECRET=replace_me_test_webhook_secret
```

## Docker Compose Staging

The staging compose stack is defined in `docker-compose.staging.yml` and includes:

- MySQL 8 on local port `3307`
- Redis on local port `6380`
- API on local port `4000`
- Worker
- Web on local port `3000`
- Admin on local port `3001`

Start infrastructure only:

```bash
corepack pnpm staging:db:up
corepack pnpm staging:redis:up
```

Start the full stack:

```bash
corepack pnpm staging:stack
```

Shut down:

```bash
corepack pnpm staging:down
```

## Process-Based Fallback

If containerizing all apps is not practical on the current machine, start MySQL and Redis with compose, then run apps as local processes:

```bash
corepack pnpm staging:db:up
corepack pnpm staging:redis:up
corepack pnpm db:generate
corepack pnpm staging:migrate
corepack pnpm staging:seed
corepack pnpm staging:api
corepack pnpm staging:worker
corepack pnpm staging:web
corepack pnpm staging:admin
```

Each app uses its build artifact:

- API: `corepack pnpm --filter @ai-heritage/api build && corepack pnpm --filter @ai-heritage/api start`
- Worker: `corepack pnpm --filter @ai-heritage/worker build && corepack pnpm --filter @ai-heritage/worker start`
- Web: `corepack pnpm --filter @ai-heritage/web build && corepack pnpm --filter @ai-heritage/web start`
- Admin: `corepack pnpm --filter @ai-heritage/admin build && corepack pnpm --filter @ai-heritage/admin start`

## Migration And Seed

Connect `DATABASE_URL` to staging MySQL, then run:

```bash
corepack pnpm db:generate
corepack pnpm staging:migrate
corepack pnpm staging:seed
```

Seed verification must confirm:

- `family_legacy_collection`
- `premium` package
- 8 deliverables
- prompt templates
- admin roles/permissions
- AI mock/placeholder provider
- delivery email template

Seed data must not include real customer data, real payment provider IDs, real AI keys, or committed admin passwords.

## Staging Smoke

Run:

```bash
corepack pnpm staging:smoke
```

The smoke script checks:

- API `/health`
- API `/api/v1/products`
- Web `/`
- Web `/family-legacy-collection`
- Admin `/admin/login`
- MySQL reachable
- Redis reachable
- staging env defaults
- worker startup contract / registered queues
- robots excludes private/admin routes
- sitemap excludes private/admin routes

If services are not running, this command fails and prints the blocked checks. That is expected; do not treat it as deployed.

## Staging E2E

Run:

```bash
corepack pnpm staging:e2e
```

Checklist for manual or live staging E2E:

1. create interview
2. submit answers
3. confirm HouseDNA
4. create order
5. create consent
6. create Stripe checkout session in test mode or use the mock strategy
7. simulate verified Stripe webhook
8. verify order paid
9. outbox consumed
10. GenerationManifest created
11. mock generation chain produces required assets
12. download token created
13. mock email log created
14. open Download Vault API
15. request signed URL
16. admin can see order/manifest/assets/token/email
17. no storage_key / prompt / raw token / signed URL list exposed

## Stripe Test Mode

Do not use live keys.

Webhook endpoint:

```text
/api/v1/webhooks/stripe
```

Local forwarding:

```bash
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```

Use Stripe test cards only:

```text
4242 4242 4242 4242
Any future expiry
Any 3-digit CVC
Any postal code
```

Replay or trigger a test event with Stripe CLI:

```bash
stripe trigger checkout.session.completed
```

The app must still verify webhook signatures. Frontend redirect success must not mark orders paid.

## Admin Staging

Admin bootstrap is disabled by default:

```bash
ADMIN_BOOTSTRAP_ENABLED=false
```

To create a temporary staging admin, set bootstrap env vars only in the staging server environment, start API, create/login the admin, then disable bootstrap and restart:

```bash
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_BOOTSTRAP_EMAIL=admin@mykinlegacy.com
ADMIN_BOOTSTRAP_PASSWORD=<secret-manager-value>
```

Minimum role for staging smoke is `viewer`. Use `support` or `admin` only for guarded mutation checks. Test admin passwords must never be committed.

Admin pages are noindex. Admin APIs are protected. Admin must not manually mark `payment_status=paid` or manually mark a manifest completed.

## Storage Staging

Default:

```bash
STORAGE_PROVIDER=local_private
LOCAL_STORAGE_DIR=./.local-storage-staging
```

Requirements:

- files are outside public directories
- no public URL is stored
- full storage key is not exposed to public APIs
- signed URL is short-lived
- `.local-storage-staging/` is ignored by git
- cleanup is dry-run / non-destructive by default

S3/R2 is not required for staging.

## Email Staging

Default:

```bash
EMAIL_PROVIDER=mock
```

Verify:

- delivery email rendered
- email log created
- email contains Download Vault link
- email does not contain signed URL
- email logs do not contain raw token
- no real email is sent

Resend, SendGrid, and SES are not required for staging.

## AI Staging

Default:

```bash
AI_PROVIDER=mock
```

Verify:

- mock image generation runs
- mock text generation runs
- AI run records cost/latency
- no real AI network call occurs
- no API key is required
- rendered prompt is not logged

## Security Checks

Run:

```bash
corepack pnpm security:check
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Security coverage includes:

- no obvious live secrets scan
- private route noindex
- robots/sitemap checks
- Stripe invalid signature test
- amount mismatch test
- duplicate webhook test
- raw token not stored
- signed URL not stored
- storage key not exposed
- admin cannot mark paid
- admin cannot mark manifest completed

## Troubleshooting

- Docker not installed / `docker` not found: install Docker Desktop or use a staging server with Docker Engine.
- MySQL port conflict: change host port `3307` in `docker-compose.staging.yml`.
- Redis port conflict: change host port `6380` in `docker-compose.staging.yml`.
- Prisma migration fails: confirm `DATABASE_URL` points to staging MySQL and not production.
- API health fails: check `API_PORT`, `DATABASE_URL`, and container logs.
- Worker does not start: check `REDIS_URL`, queue connection logs, and `WORKER_ENABLE_OUTBOX_DISPATCHER`.
- Stripe webhook fails: check Stripe CLI forwarding and test webhook secret.

## Known Limitations

- No production launch.
- No PayPal.
- No live AI provider.
- No real email provider.
- No production S3/R2.
- No public gallery.
- No DNS or SSL automation in repo.
- Browser-level staging E2E requires a machine with Docker/services available.

## Staging Blocker Report Template

Use this format when staging cannot fully run:

```text
blocker_name:
affected_flow:
missing_dependency:
current_status:
required_action:
severity:
whether_code_is_ready:
```

Known likely blocker:

```text
blocker_name: docker_not_available
affected_flow: docker compose staging stack
missing_dependency: Docker CLI / Docker Engine
current_status: cannot start MySQL, Redis, API, worker, web, admin containers
required_action: install Docker Desktop or run on a staging host with Docker Engine
severity: high
whether_code_is_ready: yes, staging config and scripts are present
```
