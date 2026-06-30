import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { metadata } from "./app/layout";
import robots from "./app/robots";

const appRoot = join(__dirname, "..");

describe("admin security hardening", () => {
  it("keeps the entire admin app noindex", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.openGraph).toBeNull();
  });

  it("disallows crawling for the admin app robots contract", () => {
    const contract = robots();
    expect(contract.rules).toMatchObject({ userAgent: "*", disallow: "/" });
  });

  it("adds baseline security headers to the admin Next.js config", async () => {
    const config = await readFile(join(appRoot, "next.config.mjs"), "utf8");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("Permissions-Policy");
  });
});
