import { readFile, stat } from "node:fs/promises";

import { listZipEntries } from "./zip";
import { readPngMetadata } from "./png";
import { calculateChecksumSha256, detectMimeType } from "./utils";

export async function validateImageFile(filePath: string): Promise<{ valid: boolean; width: number; height: number; has_alpha: boolean; size_bytes: number }> {
  const body = await readFile(filePath);
  const stats = await stat(filePath);
  const metadata = readPngMetadata(body);
  return {
    valid: detectMimeType({ file_path: filePath, body }) === "image/png" && stats.size > 0,
    ...metadata,
    size_bytes: stats.size
  };
}

export async function validateTransparentPng(filePath: string): Promise<{ valid: boolean; has_alpha: boolean }> {
  const body = await readFile(filePath);
  const metadata = readPngMetadata(body);
  return {
    valid: metadata.has_alpha,
    has_alpha: metadata.has_alpha
  };
}

export async function validatePdfFile(filePath: string, disclaimer: string): Promise<{ valid: boolean; size_bytes: number; checksum_sha256: string }> {
  const body = await readFile(filePath);
  return {
    valid: body.subarray(0, 4).toString() === "%PDF" && body.includes(Buffer.from(disclaimer)),
    size_bytes: body.byteLength,
    checksum_sha256: calculateChecksumSha256(body)
  };
}

export async function validateZipFile(filePath: string, requiredEntries: string[]): Promise<{ valid: boolean; entries: string[]; checksum_sha256: string; size_bytes: number }> {
  const body = await readFile(filePath);
  const entries = listZipEntries(body);
  return {
    valid:
      detectMimeType({ file_path: filePath, body }) === "application/zip" &&
      requiredEntries.every((entry) => entries.includes(entry)) &&
      body.byteLength > 0,
    entries,
    checksum_sha256: calculateChecksumSha256(body),
    size_bytes: body.byteLength
  };
}
