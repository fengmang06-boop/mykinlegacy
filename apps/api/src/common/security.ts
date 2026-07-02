import { createCipheriv, createHash, randomBytes } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  return sha256(normalizeEmail(email));
}

export function placeholderEncryptEmail(email: string): Buffer {
  return Buffer.from(`placeholder:v1:${hashEmail(email)}`, "utf8");
}

export function encryptEmailForStorage(email: string): Buffer {
  const key = customerPiiEncryptionKey();
  if (!key) {
    return placeholderEncryptEmail(email);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizeEmail(email), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.from(
    `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`,
    "utf8"
  );
}

export function encryptEmailForStorageStrict(email: string): Buffer {
  const encrypted = encryptEmailForStorage(email);
  if (!isValidEncryptedEmailPayload(encrypted)) {
    throw new Error("customer_email_encryption_failed");
  }
  return encrypted;
}

export function isValidEncryptedEmailPayload(value: Buffer | null | undefined): boolean {
  if (!value) return false;
  const serialized = value.toString("utf8");
  if (serialized.startsWith("placeholder:v1:")) return false;
  if (!serialized.startsWith("enc:v1:")) return false;

  const parts = serialized.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    return false;
  }
  const [, , ivBase64, tagBase64, ciphertextBase64] = parts;
  return [ivBase64, tagBase64, ciphertextBase64].every(isBase64UrlSegment);
}

export function isCustomerPiiEncryptionConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.CUSTOMER_PII_ENCRYPTION_KEY ?? env.PII_ENCRYPTION_KEY;
  return Boolean(raw && !isPlaceholderSecret(raw));
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return "***";
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortValue(nestedValue)])
    );
  }
  return value;
}

function customerPiiEncryptionKey(): Buffer | null {
  const raw = process.env.CUSTOMER_PII_ENCRYPTION_KEY ?? process.env.PII_ENCRYPTION_KEY;
  if (!raw || !isCustomerPiiEncryptionConfigured(process.env)) {
    return null;
  }
  return createHash("sha256").update(raw).digest();
}

function isPlaceholderSecret(value: string): boolean {
  return value === "disabled" || value === "replace_me" || value.startsWith("replace_with_");
}

function isBase64UrlSegment(value: string | undefined): boolean {
  return Boolean(value && /^[A-Za-z0-9_-]+$/.test(value));
}
