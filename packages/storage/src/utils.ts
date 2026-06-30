import { createHash, randomBytes } from "node:crypto";
import { extname } from "node:path";

export function calculateChecksumSha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function detectMimeType(input: { file_path?: string; body?: Buffer }): string {
  const ext = input.file_path ? extname(input.file_path).toLowerCase() : "";
  const body = input.body;

  if (ext === ".pdf" || body?.subarray(0, 4).toString() === "%PDF") {
    return "application/pdf";
  }
  if (ext === ".zip" || body?.subarray(0, 2).toString("hex") === "504b") {
    return "application/zip";
  }
  if (ext === ".png" || body?.subarray(1, 4).toString() === "PNG") {
    return "image/png";
  }
  if (ext === ".txt") {
    return "text/plain";
  }

  return "application/octet-stream";
}

export function buildStorageKey(input: {
  order_id: string;
  order_item_id: string;
  deliverable_code: string;
  asset_id: string;
  ext: string;
}): string {
  return `orders/${input.order_id}/${input.order_item_id}/${input.deliverable_code}/${input.asset_id}.${normalizeExt(input.ext)}`;
}

export function buildSafeFileName(input: {
  house_name: string;
  deliverable_code: string;
  ext: string;
}): string {
  return `${slugify(input.house_name)}-${input.deliverable_code.replaceAll("_", "-")}.${normalizeExt(input.ext)}`;
}

export function randomAssetId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let output = "";
  const bytes = randomBytes(16);
  for (let i = 0; i < 26; i += 1) {
    const byte = bytes[i % bytes.length] ?? 0;
    output += alphabet[byte % alphabet.length] ?? "0";
  }
  return output;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "house";
}

function normalizeExt(ext: string): string {
  return ext.replace(/^\./, "").toLowerCase();
}
