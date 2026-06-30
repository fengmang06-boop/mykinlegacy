# MVP E2E Tests

These tests use Vitest and mock/local providers. They do not call real OpenAI, real email, production Stripe, S3/R2, or PayPal.

## Commands

```bash
corepack pnpm e2e:setup
corepack pnpm e2e:smoke
corepack pnpm e2e
corepack pnpm e2e:teardown
```

For a local full-stack rehearsal, start infrastructure first:

```bash
docker compose up -d mysql redis
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm db:seed
corepack pnpm dev
```

Required E2E defaults:

- `AI_PROVIDER=mock`
- `EMAIL_PROVIDER=mock`
- `STORAGE_PROVIDER=local_private`
- `APP_WEB_URL=http://localhost:3000`
- `API_URL=http://localhost:4000`
- `ADMIN_URL=http://localhost:3001`

If Docker, MySQL, or Redis are unavailable, run `corepack pnpm e2e:smoke`. The suite will verify the MVP chain with in-memory repositories and report real orchestration gaps in `e2e/integration-gap-report.json`.

Before staging, run the full validation baseline:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm e2e
```
