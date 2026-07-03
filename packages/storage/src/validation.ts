import { readFile, stat } from "node:fs/promises";

import { listZipEntries } from "./zip";
import { readPngMetadata } from "./png";
import { calculateChecksumSha256, detectMimeType } from "./utils";

export interface ArtifactBinaryValidation {
  valid: boolean;
  signature_valid: boolean;
  format_valid: boolean;
  size_bytes: number;
  minimum_bytes: number;
  detected_mime_type: string;
  file_ext: string;
  errors: string[];
  pdf_header_valid?: boolean;
  pdf_eof_valid?: boolean;
  pdf_xref_valid?: boolean;
  png_header_valid?: boolean;
  png_dimensions_valid?: boolean;
  zip_header_valid?: boolean;
  zip_eocd_valid?: boolean;
  zip_entries_valid?: boolean;
  zip_test_passed?: boolean;
  zip_entries?: string[];
}

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
  const artifact = validateArtifactBuffer({ body, file_ext: "pdf", mime_type: "application/pdf" });
  return {
    valid: artifact.valid && body.includes(Buffer.from(disclaimer)),
    size_bytes: body.byteLength,
    checksum_sha256: calculateChecksumSha256(body)
  };
}

export async function validateZipFile(filePath: string, requiredEntries: string[]): Promise<{ valid: boolean; entries: string[]; checksum_sha256: string; size_bytes: number }> {
  const body = await readFile(filePath);
  const artifact = validateArtifactBuffer({
    body,
    file_ext: "zip",
    mime_type: "application/zip",
    required_entries: requiredEntries
  });
  return {
    valid: artifact.valid,
    entries: artifact.zip_entries ?? [],
    checksum_sha256: calculateChecksumSha256(body),
    size_bytes: body.byteLength
  };
}

export function validateArtifactBuffer(input: {
  body: Buffer;
  file_ext: string;
  mime_type?: string | null;
  required_entries?: string[];
}): ArtifactBinaryValidation {
  const fileExt = input.file_ext.replace(/^\./, "").toLowerCase();
  const errors: string[] = [];
  const minimumBytes = minimumDownloadableBytes(fileExt);
  const detectedMimeType = detectMimeType({ body: input.body });

  if (input.body.byteLength < minimumBytes) {
    errors.push("file_too_small");
  }

  if (fileExt === "png") {
    const pngHeaderValid = input.body.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    let pngDimensionsValid = false;
    try {
      const metadata = readPngMetadata(input.body);
      pngDimensionsValid = metadata.width > 0 && metadata.height > 0;
    } catch {
      errors.push("png_metadata_invalid");
    }
    if (!pngHeaderValid) errors.push("png_header_invalid");
    if (!pngDimensionsValid) errors.push("png_dimensions_invalid");

    const formatValid = pngHeaderValid && pngDimensionsValid && detectedMimeType === "image/png";
    return {
      valid: errors.length === 0 && formatValid,
      signature_valid: pngHeaderValid,
      format_valid: formatValid,
      size_bytes: input.body.byteLength,
      minimum_bytes: minimumBytes,
      detected_mime_type: detectedMimeType,
      file_ext: fileExt,
      errors,
      png_header_valid: pngHeaderValid,
      png_dimensions_valid: pngDimensionsValid
    };
  }

  if (fileExt === "pdf") {
    const pdfHeaderValid = input.body.subarray(0, 5).toString("latin1") === "%PDF-";
    const pdfEofValid = input.body.includes(Buffer.from("%%EOF"));
    const pdfXrefValid = pdfStartXrefValid(input.body);
    if (!pdfHeaderValid) errors.push("pdf_header_invalid");
    if (!pdfEofValid) errors.push("pdf_eof_missing");
    if (!pdfXrefValid) errors.push("pdf_xref_invalid");

    const formatValid = pdfHeaderValid && pdfEofValid && pdfXrefValid && detectedMimeType === "application/pdf";
    return {
      valid: errors.length === 0 && formatValid,
      signature_valid: pdfHeaderValid,
      format_valid: formatValid,
      size_bytes: input.body.byteLength,
      minimum_bytes: minimumBytes,
      detected_mime_type: detectedMimeType,
      file_ext: fileExt,
      errors,
      pdf_header_valid: pdfHeaderValid,
      pdf_eof_valid: pdfEofValid,
      pdf_xref_valid: pdfXrefValid
    };
  }

  if (fileExt === "zip") {
    const zipHeaderValid = input.body.subarray(0, 4).toString("hex") === "504b0304";
    const zipEocdOffset = findZipEndOfCentralDirectory(input.body);
    const zipEocdValid = zipEocdOffset >= 0;
    const entries = listZipEntries(input.body);
    const zipEntriesValid =
      entries.length > 0 &&
      (input.required_entries ?? []).every((entry) => entries.includes(entry));
    if (!zipHeaderValid) errors.push("zip_header_invalid");
    if (!zipEocdValid) errors.push("zip_eocd_missing");
    if (!zipEntriesValid) errors.push("zip_entries_invalid");

    const formatValid = zipHeaderValid && zipEocdValid && zipEntriesValid && detectedMimeType === "application/zip";
    return {
      valid: errors.length === 0 && formatValid,
      signature_valid: zipHeaderValid,
      format_valid: formatValid,
      size_bytes: input.body.byteLength,
      minimum_bytes: minimumBytes,
      detected_mime_type: detectedMimeType,
      file_ext: fileExt,
      errors,
      zip_header_valid: zipHeaderValid,
      zip_eocd_valid: zipEocdValid,
      zip_entries_valid: zipEntriesValid,
      zip_test_passed: formatValid,
      zip_entries: entries
    };
  }

  const formatValid = input.body.byteLength >= minimumBytes;
  return {
    valid: errors.length === 0 && formatValid,
    signature_valid: formatValid,
    format_valid: formatValid,
    size_bytes: input.body.byteLength,
    minimum_bytes: minimumBytes,
    detected_mime_type: detectedMimeType,
    file_ext: fileExt,
    errors
  };
}

export function minimumDownloadableBytes(fileExt: string): number {
  const normalized = fileExt.replace(/^\./, "").toLowerCase();
  if (normalized === "zip") return 20 * 1024;
  if (normalized === "png" || normalized === "pdf") return 10 * 1024;
  return 1024;
}

function pdfStartXrefValid(body: Buffer): boolean {
  const text = body.toString("latin1");
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/s.exec(text);
  if (!match) return false;
  const offset = Number(match[1]);
  if (!Number.isInteger(offset) || offset < 0 || offset >= body.byteLength) return false;
  return body.subarray(offset, offset + 4).toString("latin1") === "xref";
}

function findZipEndOfCentralDirectory(body: Buffer): number {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, body.byteLength - 65557);
  for (let offset = body.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (offset >= 0 && body.readUInt32LE(offset) === signature) {
      return offset;
    }
  }
  return -1;
}
