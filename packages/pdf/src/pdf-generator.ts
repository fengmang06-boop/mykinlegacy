import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { PdfGenerationInput, PdfGenerationOutput } from "./types";

export const GLOBAL_PDF_DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

export async function generateHeritagePdf(input: PdfGenerationInput): Promise<PdfGenerationOutput> {
  const text = [
    input.title,
    `House: ${input.house_name}`,
    "",
    input.disclaimer,
    "",
    sanitizeOfficialClaims(input.body_text),
    ""
  ].join("\n");
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

export function buildSimplePdf(text: string): Buffer {
  const lines = text.split(/\r?\n/).flatMap((line) => wrapLine(line, 82)).slice(0, 720);
  const pageContents = buildPageContents(lines);
  const pageCount = pageContents.length;
  const fontObjectId = 3;
  const pageObjectIds = pageContents.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  for (const [index, content] of pageContents.entries()) {
    const pageObjectId = pageObjectIds[index];
    if (!pageObjectId) throw new Error("pdf_page_object_missing");
    const contentObjectId = pageObjectId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    );
  }
  let body = "%PDF-1.4\n% pdf_layout_version=premium_v2\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body);
}

function buildPageContents(lines: string[]): string[] {
  const pages: string[] = [];
  let commands = pageHeaderCommands(1);
  let y = 732;
  let pageNumber = 1;

  for (const [index, line] of lines.entries()) {
    const clean = line.trim();
    if (!clean) {
      y -= 12;
      continue;
    }
    const isBrandTitle = index === 0 || clean === "Legacy, Designed.";
    const isSection = /^[A-Z][A-Za-z /&-]{2,58}$/.test(clean) && !clean.endsWith(".");
    const fontSize = isBrandTitle ? 18 : isSection ? 13 : 10.5;
    const leading = isBrandTitle ? 24 : isSection ? 22 : 14;
    if (y < 58) {
      commands.push(...pageFooterCommands(pageNumber));
      pages.push(commands.filter(Boolean).join("\n"));
      pageNumber += 1;
      commands = pageHeaderCommands(pageNumber);
      y = 732;
    }
    if (isSection && !isBrandTitle) {
      y -= 8;
      commands.push(lineCommand(50, y + 13, 562, y + 13));
    }
    commands.push("BT", `/F1 ${fontSize} Tf`, `50 ${y} Td`, `(${escapePdfText(clean)}) Tj`, "ET");
    y -= leading;
  }

  commands.push(...pageFooterCommands(pageNumber));
  pages.push(commands.filter(Boolean).join("\n"));
  return pages;
}

function pageHeaderCommands(pageNumber: number): string[] {
  return [
    "BT",
    "/F1 10 Tf",
    "50 776 Td",
    "(MyKinLegacy) Tj",
    "ET",
    "BT",
    "/F1 8 Tf",
    "496 776 Td",
    `(Private Archive ${pageNumber}) Tj`,
    "ET",
    lineCommand(50, 762, 562, 762)
  ];
}

function pageFooterCommands(pageNumber: number): string[] {
  return [
    lineCommand(50, 36, 562, 36),
    "BT",
    "/F1 8 Tf",
    "50 22 Td",
    `(MyKinLegacy Private Legacy Collection / Page ${pageNumber}) Tj`,
    "ET"
  ];
}

function lineCommand(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

export function sanitizeOfficialClaims(text: string): string {
  return text
    .replace(/official coat of arms/gi, "symbolic crest design")
    .replace(/legally granted/gi, "heritage-inspired")
    .replace(/historically certified/gi, "symbolic");
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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
