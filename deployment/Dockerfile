FROM node:22-bookworm-slim AS app

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL="true"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json ./
COPY apps ./apps
COPY packages ./packages
COPY e2e ./e2e

ARG NEXT_PUBLIC_API_BASE_URL="/api/v1"
ARG NEXT_PUBLIC_SITE_URL="https://mykinlegacy.com"
ARG APP_WEB_URL="https://mykinlegacy.com"
ARG APP_BASE_URL="https://mykinlegacy.com"

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV APP_WEB_URL=$APP_WEB_URL
ENV APP_BASE_URL=$APP_BASE_URL

RUN corepack pnpm install --frozen-lockfile --prod=false
RUN corepack pnpm db:generate
RUN corepack pnpm -r build

ENV NODE_ENV="production"

EXPOSE 3000 4000
