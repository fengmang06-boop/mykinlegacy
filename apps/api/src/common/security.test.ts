import { describe, expect, it } from "vitest";

import { encryptEmailForStorage, placeholderEncryptEmail } from "./security";

describe("PII security helpers", () => {
  it("falls back to non-reversible placeholder email storage without key", () => {
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    const encrypted = placeholderEncryptEmail("customer@example.com").toString("utf8");

    expect(encrypted).toContain("placeholder:v1:");
    expect(encrypted).not.toContain("customer@example.com");
  });

  it("encrypts delivery email without storing raw email when key is configured", () => {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "test-customer-pii-key";
    const encrypted = encryptEmailForStorage("customer@example.com").toString("utf8");

    expect(encrypted).toContain("enc:v1:");
    expect(encrypted).not.toContain("customer@example.com");
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  });
});
