import { describe, expect, it } from "vitest";

import {
  decryptEmailFromStorageForVerification,
  encryptEmailForStorage,
  encryptEmailForStorageStrict,
  isCustomerPiiEncryptionConfigured,
  isValidEncryptedEmailPayload,
  placeholderEncryptEmail
} from "./security";

describe("PII security helpers", () => {
  it("falls back to non-reversible placeholder email storage without key", () => {
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    const encrypted = placeholderEncryptEmail("customer@example.com").toString("utf8");

    expect(encrypted).toContain("placeholder:v1:");
    expect(encrypted).not.toContain("customer@example.com");
  });

  it("does not treat example placeholder secrets as usable encryption keys", () => {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "replace_with_customer_pii_encryption_key_from_secret_manager";
    const encrypted = encryptEmailForStorage("customer@example.com").toString("utf8");

    expect(isCustomerPiiEncryptionConfigured()).toBe(false);
    expect(encrypted).toContain("placeholder:v1:");
    expect(isValidEncryptedEmailPayload(Buffer.from(encrypted))).toBe(false);
    expect(encrypted).not.toContain("customer@example.com");
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  });

  it("encrypts delivery email without storing raw email when key is configured", () => {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "test-customer-pii-key";
    const encrypted = encryptEmailForStorage("customer@example.com").toString("utf8");

    expect(isCustomerPiiEncryptionConfigured()).toBe(true);
    expect(encrypted).toContain("enc:v1:");
    expect(isValidEncryptedEmailPayload(Buffer.from(encrypted))).toBe(true);
    expect(decryptEmailFromStorageForVerification(Buffer.from(encrypted))).toBe(
      "customer@example.com"
    );
    expect(encrypted).not.toContain("customer@example.com");
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  });

  it("strict email encryption rejects placeholder or malformed encrypted payloads", () => {
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;

    expect(() => encryptEmailForStorageStrict("customer@example.com")).toThrow(
      "customer_email_encryption_failed"
    );
    expect(isValidEncryptedEmailPayload(Buffer.from("enc:v1:missing"))).toBe(false);
    expect(isValidEncryptedEmailPayload(Buffer.from("placeholder:v1:not-decryptable"))).toBe(false);
  });
});
