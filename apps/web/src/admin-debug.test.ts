import { afterEach, describe, expect, it } from "vitest";

import { getAdminAccess } from "./lib/admin-debug";

const originalAdminToken = process.env.ADMIN_ACCESS_TOKEN;

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
});
