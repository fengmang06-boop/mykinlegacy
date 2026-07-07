import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import type { PdfGenerationInput, PdfGenerationOutput } from "./types";

export const GLOBAL_PDF_DISCLAIMER =
  "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";

const PDF_LAYOUT_VERSION = "premium_v4";
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const COLOR = {
  charcoal: [0.055, 0.052, 0.046] as const,
  charcoalSoft: [0.105, 0.094, 0.078] as const,
  ivory: [0.965, 0.94, 0.87] as const,
  ivorySoft: [0.995, 0.985, 0.945] as const,
  gold: [0.74, 0.56, 0.27] as const,
  goldSoft: [0.58, 0.43, 0.21] as const,
  ink: [0.12, 0.105, 0.086] as const,
  muted: [0.34, 0.30, 0.25] as const
};

interface PdfImage {
  width: number;
  height: number;
  data: Buffer;
}

interface PdfModel {
  brand: string;
  tagline: string;
  title: string;
  preparedFor: string;
  opening: string;
  bodyLines: string[];
}

export async function generateHeritagePdf(input: PdfGenerationInput): Promise<PdfGenerationOutput> {
  const text = buildCustomerPdfText(input);
  const pdf = buildSimplePdf(text);

  await mkdir(dirname(input.output_file_path), { recursive: true });
  await writeFile(input.output_file_path, pdf);

  return {
    candidate_ref: `file://${input.output_file_path}`,
    file_path: input.output_file_path,
    deliverable_code: input.deliverable_code,
    mime_type: "application/pdf",
    size_bytes: pdf.byteLength,
    checksum_sha256: createHash("sha256").update(pdf).digest("hex")
  };
}

function buildCustomerPdfText(input: PdfGenerationInput): string {
  return [
    "MyKinLegacy",
    "Legacy, Designed.",
    input.title,
    "",
    `Prepared for ${input.house_name}`,
    documentOpening(input.deliverable_code),
    "",
    normalizeBodyText(sanitizeOfficialClaims(input.body_text), input.title),
    "",
    "Important Note",
    GLOBAL_PDF_DISCLAIMER
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function documentOpening(deliverableCode: PdfGenerationInput["deliverable_code"]): string {
  if (deliverableCode === "heritage_certificate_pdf") {
    return "A clean private archive document for family recognition, gifting, printing, and keeping.";
  }
  if (deliverableCode === "family_story_pdf") {
    return "A warm archive companion, written to be read slowly and kept with the family collection.";
  }
  return "A guide to the symbols chosen for this family, written so the artwork can be understood and remembered.";
}

export function buildSimplePdf(text: string): Buffer {
  const model = parsePdfModel(text);
  const image = loadApprovedCrestImage();
  const pageContents = buildPremiumPageContents(model, image);
  const bodyFontObjectId = 3;
  const headingFontObjectId = 4;
  const utilityFontObjectId = 5;
  const imageObjectId = image ? 6 : null;
  const firstPageObjectId = image ? 7 : 6;
  const pageObjectIds = pageContents.map((_, index) => firstPageObjectId + index * 2);
  const resourceXObject = imageObjectId ? `/XObject << /Im1 ${imageObjectId} 0 R >> ` : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageContents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  if (image && imageObjectId) {
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.data.length} >>\nstream\n${image.data.toString("binary")}\nendstream`
    );
  }

  for (const [index, content] of pageContents.entries()) {
    const pageObjectId = pageObjectIds[index];
    if (!pageObjectId) throw new Error("pdf_page_object_missing");
    const contentObjectId = pageObjectId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${bodyFontObjectId} 0 R /F2 ${headingFontObjectId} 0 R /F3 ${utilityFontObjectId} 0 R >> ${resourceXObject}>> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`
    );
  }

  let body = `%PDF-1.4\n% pdf_layout_version=${PDF_LAYOUT_VERSION}\n% MyKinLegacy premium archive PDF with approved crest artwork when available\n`;
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "binary");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

function parsePdfModel(text: string): PdfModel {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const brand = lines[0] ?? "MyKinLegacy";
  const tagline = lines[1] ?? "Legacy, Designed.";
  const title = lines[2] ?? "Private Archive Document";
  const preparedFor = lines.find((line) => line.startsWith("Prepared for ")) ?? "Prepared for your family";
  const preparedIndex = lines.indexOf(preparedFor);
  const opening = preparedIndex >= 0 ? lines[preparedIndex + 1] ?? "" : "";
  const bodyStart = opening ? preparedIndex + 2 : Math.max(3, preparedIndex + 1);
  return {
    brand,
    tagline,
    title,
    preparedFor,
    opening,
    bodyLines: lines.slice(bodyStart).slice(0, 720)
  };
}

function buildPremiumPageContents(model: PdfModel, image: PdfImage | null): string[] {
  const pages = [buildCoverPage(model, image)];
  const wrappedLines = model.bodyLines.flatMap((line) => wrapLine(line, line === "Important Note" ? 52 : 82));
  let pageNumber = 2;
  let cursor = 0;
  while (cursor < wrappedLines.length) {
    const result = buildBodyPage(model, wrappedLines.slice(cursor), pageNumber);
    pages.push(result.content);
    cursor += result.linesConsumed;
    pageNumber += 1;
  }
  if (wrappedLines.length === 0) {
    pages.push(buildBodyPage(model, ["This private archive document has been prepared for the family collection."], pageNumber).content);
  }
  return pages;
}

function buildCoverPage(model: PdfModel, image: PdfImage | null): string {
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    rectCommand(38, 46, 536, 700, COLOR.ivorySoft),
    strokeRectCommand(38, 46, 536, 700, COLOR.goldSoft, 1.1),
    rectCommand(56, 456, 500, 232, COLOR.charcoal),
    strokeRectCommand(56, 456, 500, 232, COLOR.gold, 1.35),
    strokeRectCommand(66, 466, 480, 212, COLOR.goldSoft, 0.55),
    textCommand(78, 646, model.brand, "F2", 18, COLOR.gold),
    textCommand(78, 626, model.tagline, "F3", 9, COLOR.ivory),
    textCommand(78, 585, model.title, "F2", 25, COLOR.ivory),
    textCommand(78, 553, model.preparedFor, "F3", 12, COLOR.gold),
    textCommand(78, 515, "Private Legacy Collection", "F2", 13, COLOR.ivory),
    textCommand(78, 497, "Private Archive / clean keepsake document", "F3", 9.5, COLOR.ivory),
    rectCommand(76, 386, 460, 46, COLOR.ivory),
    strokeRectCommand(76, 386, 460, 46, COLOR.goldSoft, 0.8),
    ...wrappedTextCommands(model.opening, 94, 414, 68, "F1", 11, 15, COLOR.ink),
    textCommand(76, 334, "Inside this document", "F2", 13, COLOR.ink),
    strokeLineCommand(76, 324, 536, 324, COLOR.goldSoft, 0.65),
    ...wrappedTextCommands(
      "A title page, framed archive sections, readable body text, and a calm boundary note so the piece feels giftable without pretending to be official heraldry.",
      76,
      300,
      75,
      "F1",
      10.6,
      15,
      COLOR.ink
    ),
    textCommand(76, 96, "Prepared as a private archive document for family keeping.", "F3", 8.5, COLOR.muted),
    textCommand(410, 96, "MyKinLegacy", "F2", 9.5, COLOR.goldSoft)
  ];

  if (image) {
    commands.push(
      "q",
      "0.08 0.075 0.065 rg",
      "366 506 132 132 re f",
      "0.74 0.56 0.27 RG",
      "0.8 w",
      "366 506 132 132 re S",
      `132 0 0 132 366 506 cm`,
      "/Im1 Do",
      "Q",
      textCommand(372, 488, "Approved crest artwork", "F3", 8, COLOR.ivory)
    );
  } else {
    commands.push(
      strokeRectCommand(366, 506, 132, 132, COLOR.gold, 0.8),
      textCommand(386, 574, "Crest Artwork", "F2", 11, COLOR.gold),
      textCommand(392, 558, "linked when", "F3", 8, COLOR.ivory),
      textCommand(398, 546, "available", "F3", 8, COLOR.ivory)
    );
  }

  return commands.join("\n");
}

function buildBodyPage(model: PdfModel, lines: string[], pageNumber: number): { content: string; linesConsumed: number } {
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    rectCommand(42, 716, 528, 38, COLOR.charcoal),
    textCommand(58, 739, "MyKinLegacy", "F2", 11, COLOR.gold),
    textCommand(58, 724, model.title, "F3", 8.5, COLOR.ivory),
    textCommand(498, 733, `Page ${pageNumber}`, "F3", 8.5, COLOR.ivory),
    strokeRectCommand(42, 54, 528, 700, COLOR.goldSoft, 0.8)
  ];
  let y = 676;
  let consumed = 0;
  let cardOpen = false;

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) {
      y -= 8;
      consumed += 1;
      continue;
    }
    const isSection = isSectionHeading(clean);
    const needed = isSection ? 34 : 16;
    if (y - needed < 92) break;

    if (isSection) {
      if (cardOpen) y -= 8;
      commands.push(rectCommand(58, y - 22, 496, 34, COLOR.ivorySoft));
      commands.push(strokeRectCommand(58, y - 22, 496, 34, COLOR.goldSoft, 0.5));
      commands.push(textCommand(76, y - 2, clean, "F2", 12.2, COLOR.ink));
      y -= 42;
      cardOpen = true;
    } else {
      const cardHeight = Math.max(22, line.length > 72 ? 32 : 24);
      commands.push(rectCommand(66, y - cardHeight + 6, 480, cardHeight, COLOR.ivorySoft));
      commands.push(textCommand(82, y - 8, clean, "F1", 10.6, COLOR.ink));
      y -= cardHeight + 5;
      cardOpen = true;
    }
    consumed += 1;
  }

  commands.push(
    strokeLineCommand(58, 76, 554, 76, COLOR.goldSoft, 0.55),
    textCommand(58, 60, "Private Legacy Collection", "F3", 8.2, COLOR.muted),
    textCommand(438, 60, "Legacy, Designed.", "F3", 8.2, COLOR.muted)
  );
  return { content: commands.join("\n"), linesConsumed: Math.max(1, consumed) };
}

function isSectionHeading(value: string): boolean {
  return (
    value === "Important Note" ||
    (/^[A-Z][A-Za-z /&-]{2,58}$/.test(value) && !value.endsWith(".") && value.split(/\s+/).length <= 6)
  );
}

function rectCommand(
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number]
): string {
  return `${color.join(" ")} rg ${x} ${y} ${width} ${height} re f`;
}

function strokeRectCommand(
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number],
  strokeWidth: number
): string {
  return `${color.join(" ")} RG ${strokeWidth} w ${x} ${y} ${width} ${height} re S`;
}

function strokeLineCommand(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number],
  strokeWidth: number
): string {
  return `${color.join(" ")} RG ${strokeWidth} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function textCommand(
  x: number,
  y: number,
  value: string,
  font: "F1" | "F2" | "F3",
  size: number,
  color: readonly [number, number, number]
): string {
  return ["BT", `/${font} ${size} Tf`, `${color.join(" ")} rg`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, "ET"].join("\n");
}

function wrappedTextCommands(
  value: string,
  x: number,
  y: number,
  width: number,
  font: "F1" | "F2" | "F3",
  size: number,
  leading: number,
  color: readonly [number, number, number]
): string[] {
  return wrapLine(value, width)
    .slice(0, 4)
    .map((line, index) => textCommand(x, y - index * leading, line, font, size, color));
}

export function sanitizeOfficialClaims(text: string): string {
  return text
    .replace(/\bAI-generated\b/gi, "personalized")
    .replace(/\bAI generated\b/gi, "personalized")
    .replace(/\bplaceholder\b/gi, "archive document")
    .replace(/\binternal beta\b/gi, "private review")
    .replace(/\balpha\b/gi, "early archive")
    .replace(/official coat of arms/gi, "symbolic crest design")
    .replace(/legally granted/gi, "heritage-inspired")
    .replace(/historically certified/gi, "symbolic");
}

function normalizeBodyText(text: string, title: string): string {
  const lines = text.split(/\r?\n/);
  while (
    lines[0]?.trim() === "MyKinLegacy" ||
    lines[0]?.trim() === "Legacy, Designed." ||
    lines[0]?.trim() === title ||
    lines[0]?.trim() === ""
  ) {
    lines.shift();
  }
  let boundaryIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim() === "Boundary Statement") {
      boundaryIndex = index;
      break;
    }
  }
  const bodyLines = boundaryIndex >= 0 ? lines.slice(0, boundaryIndex) : lines;
  return bodyLines.join("\n").trim();
}

function loadApprovedCrestImage(): PdfImage | null {
  for (const filePath of approvedCrestCandidates()) {
    try {
      if (!existsSync(filePath)) continue;
      return pngToPdfImage(readFileSync(filePath), 260);
    } catch {
      continue;
    }
  }
  return null;
}

function approvedCrestCandidates(): string[] {
  return [
    resolve(process.cwd(), "packages", "storage", "assets", "official", "01a-classic-shield-legacy.png"),
    resolve(process.cwd(), "..", "storage", "assets", "official", "01a-classic-shield-legacy.png"),
    resolve(process.cwd(), "..", "..", "packages", "storage", "assets", "official", "01a-classic-shield-legacy.png"),
    resolve(process.cwd(), "artifacts", "crest-artwork-v1", "Crest-Artwork-01.png"),
    resolve(process.cwd(), "..", "artifacts", "crest-artwork-v1", "Crest-Artwork-01.png"),
    resolve(process.cwd(), "..", "..", "artifacts", "crest-artwork-v1", "Crest-Artwork-01.png"),
    join(__dirname, "..", "..", "..", "storage", "assets", "official", "01a-classic-shield-legacy.png"),
    join(__dirname, "..", "..", "..", "artifacts", "crest-artwork-v1", "Crest-Artwork-01.png"),
    join(__dirname, "..", "..", "..", "..", "artifacts", "crest-artwork-v1", "Crest-Artwork-01.png")
  ];
}

function pngToPdfImage(buffer: Buffer, maxDimension: number): PdfImage {
  const decoded = decodePng(buffer);
  const resized = downsampleRgb(decoded.rgb, decoded.width, decoded.height, maxDimension);
  return {
    width: resized.width,
    height: resized.height,
    data: deflateSync(resized.rgb)
  };
}

function decodePng(buffer: Buffer): { width: number; height: number; rgb: Buffer } {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("not_png");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const interlace = buffer.readUInt8(28);
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) throw new Error("unsupported_png");
  const channels = colorType === 6 ? 4 : 3;
  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset < buffer.length - 12) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  if (idatChunks.length === 0) throw new Error("png_idat_missing");
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * channels);
  const previous = Buffer.alloc(stride);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset] ?? 0;
    sourceOffset += 1;
    const scanline = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;
    unfilterScanline(scanline, previous, channels, filter);
    scanline.copy(rgba, y * stride);
    scanline.copy(previous);
  }
  const rgb = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * channels;
    const target = index * 3;
    const alpha = channels === 4 ? (rgba[source + 3] ?? 255) / 255 : 1;
    rgb[target] = Math.round((rgba[source] ?? 0) * alpha + 14 * (1 - alpha));
    rgb[target + 1] = Math.round((rgba[source + 1] ?? 0) * alpha + 13 * (1 - alpha));
    rgb[target + 2] = Math.round((rgba[source + 2] ?? 0) * alpha + 12 * (1 - alpha));
  }
  return { width, height, rgb };
}

function unfilterScanline(scanline: Buffer, previous: Buffer, bytesPerPixel: number, filter: number): void {
  for (let index = 0; index < scanline.length; index += 1) {
    const left = index >= bytesPerPixel ? scanline[index - bytesPerPixel] ?? 0 : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;
    if (filter === 1) scanline[index] = ((scanline[index] ?? 0) + left) & 0xff;
    else if (filter === 2) scanline[index] = ((scanline[index] ?? 0) + up) & 0xff;
    else if (filter === 3) scanline[index] = ((scanline[index] ?? 0) + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) scanline[index] = ((scanline[index] ?? 0) + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error("unsupported_png_filter");
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function downsampleRgb(rgb: Buffer, width: number, height: number, maxDimension: number): { width: number; height: number; rgb: Buffer } {
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / maxDimension));
  const targetWidth = Math.max(1, Math.floor(width / scale));
  const targetHeight = Math.max(1, Math.floor(height / scale));
  const output = Buffer.alloc(targetWidth * targetHeight * 3);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, y * scale);
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, x * scale);
      const source = (sourceY * width + sourceX) * 3;
      const target = (y * targetWidth + x) * 3;
      output[target] = rgb[source] ?? 0;
      output[target + 1] = rgb[source + 1] ?? 0;
      output[target + 2] = rgb[source + 2] ?? 0;
    }
  }
  return { width: targetWidth, height: targetHeight, rgb: output };
}

function escapePdfText(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(value: string, width: number): string[] {
  if (value.length <= width) return [value];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
