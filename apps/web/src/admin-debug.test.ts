import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { getAdminAccess } from "./lib/admin-debug";

const originalAdminToken = process.env.ADMIN_ACCESS_TOKEN;
const testDir = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  if (originalAdminToken === undefined) {
    delete process.env.ADMIN_ACCESS_TOKEN;
  } else {
    process.env.ADMIN_ACCESS_TOKEN = originalAdminToken;
  }
});

describe("admin debug access", () => {
  it("reads ADMIN_ACCESS_TOKEN at runtime and accepts exact matches", () => {
    process.env.ADMIN_ACCESS_TOKEN = "runtime-admin-token";

    expect(getAdminAccess({ token: "runtime-admin-token" })).toMatchObject({
      authorized: true,
      configured: true
    });
  });

  it("accepts plus signs that were converted to spaces in URL query parsing", () => {
    process.env.ADMIN_ACCESS_TOKEN = "token+with+plus";

    expect(getAdminAccess({ token: "token with plus" })).toMatchObject({
      authorized: true,
      configured: true
    });
  });

  it("rejects wrong tokens without exposing configured value", () => {
    process.env.ADMIN_ACCESS_TOKEN = "runtime-admin-token";

    const access = getAdminAccess({ token: "wrong-token" });

    expect(access.authorized).toBe(false);
    expect(access.reason).not.toContain("runtime-admin-token");
  });

  it("admin orders page includes safe meaning and vault indicators", async () => {
    const source = await readFile(join(testDir, "app/admin/orders/page.tsx"), "utf8");

    expect(source).toContain("profile=yes");
    expect(source).toContain("themes=");
    expect(source).toContain("symbols=");
    expect(source).toContain("boundary=");
    expect(source).toContain("content=");
    expect(source).toContain("symbol guide=");
    expect(source).toContain("certificate=");
    expect(source).toContain("vault=");
    expect(source).toContain("raw vault tokens");
  });
});
