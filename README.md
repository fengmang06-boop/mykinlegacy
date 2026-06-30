# MyKinLegacy

Monorepo scaffold for the MyKinLegacy MVP.

## Workspace

- `apps/web` - customer-facing Next.js app
- `apps/admin` - internal admin Next.js app
- `apps/api` - NestJS API app
- `apps/worker` - background worker app
- `packages/*` - shared packages for config, domain, integrations, validation, and types

## Prerequisites

- Node.js LTS-compatible runtime
- pnpm via Corepack

If `pnpm` is not available directly, use:

```bash
corepack pnpm <command>
```

## Install

```bash
corepack pnpm install
```

## Development

Run all app dev servers:

```bash
corepack pnpm dev
```

Run individual apps:

```bash
corepack pnpm local:web
corepack pnpm local:admin
corepack pnpm local:api
corepack pnpm local:worker
```

Equivalent workspace commands:

```bash
corepack pnpm --filter @ai-heritage/web dev
corepack pnpm --filter @ai-heritage/admin dev
corepack pnpm --filter @ai-heritage/api dev
corepack pnpm --filter @ai-heritage/worker dev
```

Default ports:

- Web: `http://localhost:3000`
- Admin: `http://localhost:3001`
- API: `http://localhost:4000/health`

## Staging

Milestone 16 staging/pre-production setup is documented in [STAGING.md](STAGING.md).

Useful commands:

```bash
corepack pnpm staging:db:up
corepack pnpm staging:redis:up
corepack pnpm staging:migrate
corepack pnpm staging:seed
corepack pnpm staging:stack
corepack pnpm staging:smoke
corepack pnpm staging:e2e
corepack pnpm staging:down
```

Staging must stay on Stripe test mode, `AI_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, and `STORAGE_PROVIDER=local_private`. Do not use live Stripe, live AI, live email, production S3/R2, or production data in staging.

## Build, Lint, Test

```bash
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm db:seed
corepack pnpm build
corepack pnpm lint
corepack pnpm test
corepack pnpm typecheck
```

## Database

Prisma schema lives at `packages/database/prisma/schema.prisma`.

Useful commands:

```bash
corepack pnpm db:format
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm db:seed
corepack pnpm db:migrate:dev
corepack pnpm db:migrate:deploy
corepack pnpm db:studio
```

Generated Prisma Client output is written to `packages/database/generated/client` and exported from `@ai-heritage/database`.

MVP seed data is managed in `packages/database/prisma/seed-data.ts` and written by `packages/database/prisma/seed.ts`. The seed is idempotent and uses stable product, package, deliverable, prompt, email, RBAC, and placeholder AI codes.

House Identity Engine core lives in:

- `packages/domain/src/house-identity` for data contracts, builder, normalization, versioning, and memory logic
- `packages/validation/src/house-identity` for validation helpers
- `packages/database/src/repositories/house-identity.ts` for Prisma persistence helpers

Worker queue foundation lives in:

- `packages/queue` for BullMQ queue names, job envelopes, retry policy, DLQ helpers, structured worker logs, placeholder processors, and the outbox dispatcher skeleton
- `apps/worker` for queue registration, placeholder worker bootstrap, optional outbox dispatcher polling, health status, and graceful shutdown

Milestone 6 placeholder processors are registered for:

- `payment-confirmation`
- `generation-manifest`
- `generation`
- `cleanup`
- `dead-letter`

AI Prompt Rendering & Safety Layer lives in:

- `packages/ai/src/prompt-rendering` for prompt template loading, repository boundaries, variable resolution, prompt rendering, no-text image prompt enforcement, prompt version tracking, and rendered prompt metadata
- `packages/ai/src/generation` for AI provider abstraction, mock AI provider, disabled OpenAI adapter skeleton, AI generation job handlers, AI run recording helpers, output candidates, cost/latency tracking, and normalized AI errors
- `packages/validation/src/prompt-safety` for forbidden term detection, allowed disclaimer negation, no-text image validation, required disclaimer validation, knowledge source filtering, text output validation, and image prompt validation
- `packages/domain/src/prompt` for shared prompt contract types

PDF / ZIP / private asset storage foundation lives in:

- `packages/storage` for local private storage, disabled S3/R2 adapter skeletons, asset lifecycle helpers, PNG post-processing fixtures, ZIP packaging, manifest readiness helpers, file validation, and private asset repository boundaries
- `packages/pdf` for deterministic MVP PDF generation with mandatory heritage disclaimer text and no official ancestry/authenticity claims
- `apps/worker` for foundation processors registered on `image-postprocess`, `pdf-generation`, `zip-packaging`, and `asset-storage`

Storage defaults to local private files. Assets are not exposed as public URLs, and S3/R2 integration remains intentionally disabled until a later milestone.

Download Vault & Email Delivery foundation lives in:

- `packages/storage/src/download-vault.ts` for hash-only download tokens, expiration, revocation, max download checks, token-to-asset authorization, signed URL creation, and hashed download events
- `apps/api/src/downloads` for public Download Vault endpoints under `/api/v1/downloads`
- `packages/email` for email provider abstraction, mock email provider, disabled real provider skeletons, `delivery_ready` rendering, sanitized email logs, and delivery job helpers
- `apps/worker` for foundation processors on `download-token` and `email-delivery`

Download emails contain only the Download Vault link. Signed URLs are short-lived, are not persisted, and are not included in email logs or email payloads.

Customer frontend flow lives in:

- `apps/web/src/app` for public landing, product, create, checkout, payment return, order status, download vault, and support routes
- `apps/web/src/components` for the customer flow client components
- `apps/web/src/lib/api-client.ts` for the API envelope client, request correlation, idempotency keys, and ErrorContract handling
- `apps/web/src/lib/analytics.ts` for privacy-filtered analytics event foundations
- `apps/web/src/lib/state.ts` for frontend state labels and friendly generation status messages

Private customer flow pages export `noindex` metadata. Product price, package, and deliverables are loaded from the API rather than hardcoded into the page.

Admin Operations MVP lives in:

- `apps/api/src/admin` for admin login, RBAC checks, audit log foundation, dashboard/system health, safe operational resource APIs, and guarded mutations
- `apps/admin/src/app/admin` for internal operation pages covering dashboard, orders, generation jobs, manifests, assets, download tokens, email logs, prompt templates, knowledge library, audit logs, system health, and settings
- `apps/admin/src/components` for shared operational UI, reason-required actions, disabled permission states, and guardrail notices

Admin MVP uses environment-controlled dev bootstrap only. It does not expose raw download tokens, public asset URLs, full storage keys, raw prompts to lower roles, or full private HouseDNA by default.

Observability / Logging / Recovery foundation lives in:

- `packages/observability` for structured logging, sensitive-field sanitization, normalized errors, graceful health checks, MVP metrics, recovery issue scanning, safe recovery action guards, alert events, scheduler helpers, and noindex/privacy verification helpers
- `apps/api/src/admin` for admin dashboard and system-health visibility backed by MVP observability snapshots
- `apps/worker` for scheduler foundation wiring, recovery scan placeholders, and safe cleanup defaults

MVP observability is intentionally local/mock friendly. It degrades when DB or Redis checks are not configured, avoids external alerting services, and never logs raw tokens, signed URLs, full storage keys, raw prompts, API keys, card data, or private family story text.

Security / Privacy / Noindex hardening lives in:

- `apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts` for public indexing boundaries. Only `/`, `/family-legacy-collection`, and `/support` are included in the sitemap.
- Customer private routes for create, checkout, payment return, order status, and download vault pages export `noindex` metadata.
- `apps/admin/src/app/layout.tsx` keeps the admin app noindex by default.
- `apps/web/next.config.mjs` and `apps/admin/next.config.mjs` add baseline browser security headers.
- `packages/validation/src/security-hardening.test.ts`, `apps/web/src/security-hardening.test.tsx`, and `apps/admin/src/admin-security.test.ts` cover secret placeholders, robots/sitemap boundaries, admin noindex, and frontend private-field exposure checks.

Public brand placeholders are aligned to MyKinLegacy, `https://mykinlegacy.com`, and `support@mykinlegacy.com`. `.env.example` is placeholder-only; production secrets must come from a secret manager or deployment platform vault.

End-to-end testing foundation lives in:

- `e2e/mvp-happy-path.e2e.test.ts` for the mock-provider happy path from interview fixtures through mock AI, PDF/ZIP, private storage, download token, mock email, Download Vault, signed URL, and admin visibility.
- `e2e/failure-and-security.e2e.test.ts` for Stripe duplicate/mismatch, redirect-before-webhook, missing consent, AI/PDF/ZIP/email/download failures, noindex, sensitive exposure, admin guardrails, and recovery safety checks.
- `e2e/integration-gap-report.json` for known DB/Redis/worker/browser orchestration gaps that must be closed before staging.
- `e2e/fixtures.ts` for sample HouseDNA, interview answers, order, consent, Stripe event, AI candidates, assets, download token context, email template, and admin user fixtures.

Run E2E smoke tests:

```bash
corepack pnpm e2e:setup
corepack pnpm e2e:smoke
corepack pnpm e2e
corepack pnpm e2e:teardown
```

The MVP E2E suite uses `AI_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, and `STORAGE_PROVIDER=local_private`. It does not require real OpenAI, real email, production Stripe, PayPal, production S3/R2, or public gallery support. If MySQL, Redis, Docker, or browser-level orchestration are unavailable, run `corepack pnpm e2e:smoke` and review `e2e/integration-gap-report.json`.

Milestone 15.5 orchestration gap closure lives in:

- `packages/database/src/orchestration` for the `order.paid` outbox consumer, GenerationManifest creation, manifest-driven asset completion, hash-only download token creation, mock delivery email log, safe customer status summary, and admin visibility summary.
- `PrismaOrchestrationRepository` for a real MySQL-backed path over the existing Prisma tables.
- `InMemoryOrchestrationRepository` for local tests when Docker/MySQL is unavailable.
- `apps/api/src/orders` for safe generation progress fields on order status responses.
- `apps/api/src/admin` for DB-backed orchestration visibility without raw tokens, signed URLs, full storage keys, rendered prompts, or full HouseDNA.

Local stack helpers:

```bash
corepack pnpm local:db:up
corepack pnpm local:redis:up
corepack pnpm local:seed
corepack pnpm local:stack
corepack pnpm e2e:local-stack
```

Before staging, run:

```bash
docker compose up -d mysql redis
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm db:seed
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm e2e
```

TODO:

- Verify M11.6 frontend visual redesign actually applies in browser. Check dev server cache, route files, CSS import order, stale build, and whether changed components are used by the active routes.

Public customer API foundation lives in `apps/api/src`:

- Global API prefix: `/api/v1`
- Health endpoint: `/health`
- Products: `GET /api/v1/products`, `GET /api/v1/products/:productCode`
- Interviews: create, get, answer, normalize, confirm
- Orders: create, status, consent
- Payments: `POST /api/v1/payments/stripe/create-checkout-session`
- Stripe webhooks: `POST /api/v1/webhooks/stripe`
- Mutation endpoints require `Idempotency-Key`

Local MySQL 8 is available through Docker Compose:

```bash
docker compose up -d mysql redis
```

The local development database name is `ai_heritage`.
Local Redis is available at `redis://localhost:6379`.

## Environment

Copy `.env.example` to `.env` locally and fill placeholders. Do not commit real secrets.

## Scope

This repository is currently at Milestone 15.5: Orchestration Gap Closure Before Staging. It intentionally contains no advanced moderation dashboard, human review queue UI, advanced refund automation, prompt A/B testing, public gallery management, multi-member House support, advanced deletion automation, physical product operations, multi-language operations, PayPal admin flow, production auth provider integration, MFA implementation, real email provider send, real AI provider execution, or real storage CDN.
