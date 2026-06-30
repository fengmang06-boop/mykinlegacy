import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("staging smoke configuration", () => {
  it("keeps staging defaults on Stripe test placeholders, mock AI/email, and local private storage", async () => {
    const env = await readFile(".env.staging.example", "utf8");

    expect(env).toContain('NODE_ENV="staging"');
    expect(env).toContain('APP_WEB_URL="https://staging.mykinlegacy.com"');
    expect(env).toContain('API_PUBLIC_URL="https://api-staging.mykinlegacy.com"');
    expect(env).toContain('ADMIN_WEB_URL="https://admin-staging.mykinlegacy.com"');
    expect(env).toContain('STRIPE_SECRET_KEY="replace_me_test_key_only"');
    expect(env).toContain('STRIPE_WEBHOOK_SECRET="replace_me_test_webhook_secret"');
    expect(env).toContain('AI_PROVIDER="mock"');
    expect(env).toContain('EMAIL_PROVIDER="mock"');
    expect(env).toContain('STORAGE_PROVIDER="local_private"');
    expect(env).toContain('LOCAL_STORAGE_DIR="./.local-storage-staging"');
    expect(env).toContain('ADMIN_BOOTSTRAP_ENABLED="false"');
    expect(env).toContain('CLEANUP_DESTRUCTIVE_ENABLED="false"');
    expect(env).not.toMatch(/sk_live|pk_live|whsec_live|sk-proj-|OPENAI_API_KEY="sk-/i);
  });

  it("defines a staging compose stack for mysql, redis, api, worker, web, and admin", async () => {
    const compose = await readFile("docker-compose.staging.yml", "utf8");

    for (const service of ["mysql:", "redis:", "api:", "worker:", "web:", "admin:"]) {
      expect(compose).toContain(service);
    }
    expect(compose).toContain("AI_PROVIDER: mock");
    expect(compose).toContain("EMAIL_PROVIDER: mock");
    expect(compose).toContain("STORAGE_PROVIDER: local_private");
    expect(compose).toContain("replace_me_test_key_only");
    expect(compose).not.toMatch(/sk_live|whsec_live|sk-proj-/i);
  });

  it("documents staging migration, seed, smoke, E2E, Stripe test mode, and blockers", async () => {
    const docs = await readFile("STAGING.md", "utf8");
    const required = [
      "corepack pnpm staging:migrate",
      "corepack pnpm staging:seed",
      "corepack pnpm staging:smoke",
      "corepack pnpm staging:e2e",
      "stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe",
      "4242 4242 4242 4242",
      "Docker not installed",
      "AI_PROVIDER=mock",
      "EMAIL_PROVIDER=mock",
      "STORAGE_PROVIDER=local_private"
    ];

    for (const text of required) {
      expect(docs).toContain(text);
    }
  });

  it("documents the staging E2E checklist without exposing private fields", async () => {
    const docs = await readFile("STAGING.md", "utf8");
    const required = [
      "create interview",
      "submit answers",
      "confirm HouseDNA",
      "create order",
      "create consent",
      "simulate verified Stripe webhook",
      "GenerationManifest created",
      "download token created",
      "mock email log created",
      "admin can see order/manifest/assets/token/email",
      "no storage_key / prompt / raw token / signed URL list exposed"
    ];

    for (const text of required) {
      expect(docs).toContain(text);
    }
  });
});
