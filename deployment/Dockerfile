FROM node:22-bookworm-slim AS app

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL="true"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/email/package.json ./packages/email/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY packages/payments/package.json ./packages/payments/package.json
COPY packages/pdf/package.json ./packages/pdf/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/storage/package.json ./packages/storage/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/validation/package.json ./packages/validation/package.json

ARG NEXT_PUBLIC_API_BASE_URL="/api/v1"
ARG NEXT_PUBLIC_SITE_URL="https://mykinlegacy.com"
ARG APP_WEB_URL="https://mykinlegacy.com"
ARG APP_BASE_URL="https://mykinlegacy.com"

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV APP_WEB_URL=$APP_WEB_URL
ENV APP_BASE_URL=$APP_BASE_URL

RUN corepack pnpm install --frozen-lockfile --prod=false
COPY apps ./apps
COPY packages ./packages
COPY e2e ./e2e
RUN corepack pnpm db:generate
RUN corepack pnpm -r build

ENV NODE_ENV="production"

EXPOSE 3000 4000
