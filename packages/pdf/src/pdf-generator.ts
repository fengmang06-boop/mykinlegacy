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
  charcoalWarm: [0.145, 0.125, 0.092] as const,
  ivory: [0.965, 0.94, 0.87] as const,
  ivorySoft: [0.995, 0.985, 0.945] as const,
  parchment: [0.92, 0.865, 0.735] as const,
  gold: [0.74, 0.56, 0.27] as const,
  goldSoft: [0.58, 0.43, 0.21] as const,
  ink: [0.12, 0.105, 0.086] as const,
  muted: [0.34, 0.30, 0.25] as const,
  mist: [0.84, 0.79, 0.67] as const
};

interface PdfImage {
  width: number;
  height: number;
  data: Buffer;
}

interface PdfSection {
  heading: string;
  body: string;
}

interface PdfModel {
  deliverableCode: PdfGenerationInput["deliverable_code"];
  title: string;
  familyName: string;
  bodyText: string;
  fields: Map<string, string>;
  sections: PdfSection[];
}

export async function generateHeritagePdf(input: PdfGenerationInput): Promise<PdfGenerationOutput> {
  const pdf = buildPublicationPdf(input);

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
  return buildPublicationPdf({
    deliverable_code: inferDeliverableCode(text),
    title: inferTitle(text),
    house_name: inferFamilyName(text),
    body_text: text,
    disclaimer: GLOBAL_PDF_DISCLAIMER,
    output_file_path: ""
  });
}

function buildPublicationPdf(input: PdfGenerationInput): Buffer {
  const model = parsePdfModel(input);
  const image = loadApprovedCrestImage();
  const pageContents = buildPublicationPages(model, image);
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

  let body = `%PDF-1.4\n% pdf_layout_version=${PDF_LAYOUT_VERSION}\n% MyKinLegacy three-book reading experience with approved crest artwork when available\n`;
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

function buildPublicationPages(model: PdfModel, image: PdfImage | null): string[] {
  if (model.deliverableCode === "heritage_certificate_pdf") return buildCertificatePages(model, image);
  if (model.deliverableCode === "family_story_pdf") return buildStorybookPages(model, image);
  return buildMeaningGuidePages(model, image);
}

function buildCertificatePages(model: PdfModel, image: PdfImage | null): string[] {
  return [buildCertificateMainPage(model, image), buildCertificateKeepsakeNote(model)];
}

function buildCertificateMainPage(model: PdfModel, image: PdfImage | null): string {
  const collectionName = field(model, "Collection Name", `${model.familyName} Legacy Collection`);
  const recipient = field(model, "Presented To", field(model, "Recipient", model.familyName));
  const occasion = field(model, "Occasion", "A private family occasion");
  const date = field(model, "Date", "Recorded at the time this collection was prepared");
  const archiveNumber = field(model, "Archive Number", "Private archive record");
  const statement = sectionBody(model, "Ceremony Statement", 0) || model.sections.at(-1)?.body || ceremonialFallback(model);
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.parchment),
    rectCommand(46, 46, 520, 700, COLOR.ivorySoft),
    strokeRectCommand(46, 46, 520, 700, COLOR.gold, 1.3),
    strokeRectCommand(58, 58, 496, 676, COLOR.goldSoft, 0.65),
    textCommand(74, 714, "MyKinLegacy", "F2", 15, COLOR.goldSoft),
    textCommand(430, 714, "Heritage Certificate", "F3", 9, COLOR.muted),
    centeredTextCommand(306, 664, "HERITAGE CERTIFICATE", "F2", 24, COLOR.ink),
    centeredTextCommand(306, 638, "Collection Name", "F3", 9.5, COLOR.muted),
    centeredTextCommand(306, 626, collectionName, "F1", 15, COLOR.goldSoft),
    textCommand(94, 418, "Presented To", "F3", 11, COLOR.muted),
    centeredTextCommand(306, 386, recipient, "F2", 25, COLOR.ink),
    strokeLineCommand(134, 368, 478, 368, COLOR.goldSoft, 0.8),
    textCommand(94, 338, "Created For", "F3", 10, COLOR.muted),
    textCommand(180, 338, occasion, "F1", 12.5, COLOR.ink),
    textCommand(94, 314, "Date", "F3", 10, COLOR.muted),
    textCommand(180, 314, date, "F1", 12.5, COLOR.ink),
    rectCommand(86, 180, 440, 104, COLOR.ivory),
    strokeRectCommand(86, 180, 440, 104, COLOR.goldSoft, 0.55),
    ...wrappedTextCommands(statement, 110, 254, 70, "F1", 12.7, 18, COLOR.ink, 5),
    strokeLineCommand(98, 120, 278, 120, COLOR.goldSoft, 0.7),
    textCommand(112, 102, "Signature", "F3", 9.5, COLOR.muted),
    textCommand(112, 134, "MyKinLegacy Legacy Curator", "F1", 12, COLOR.ink),
    strokeCircleCommand(438, 122, 40, COLOR.goldSoft, 1),
    centeredTextCommand(438, 130, "MyKinLegacy", "F2", 8.5, COLOR.goldSoft),
    centeredTextCommand(438, 116, "Official Seal", "F3", 8, COLOR.muted),
    textCommand(88, 76, `Archive Number: ${archiveNumber}`, "F3", 9.5, COLOR.muted)
  ];

  if (image) {
    commands.push(drawImageCommand(246, 462, 120, 120));
    commands.push(centeredTextCommand(306, 448, "Final Crest", "F3", 8.5, COLOR.muted));
  } else {
    commands.push(strokeRectCommand(246, 462, 120, 120, COLOR.goldSoft, 0.7));
    commands.push(centeredTextCommand(306, 518, "Final Crest", "F2", 13, COLOR.goldSoft));
  }

  return commands.join("\n");
}

function buildCertificateKeepsakeNote(model: PdfModel): string {
  const archiveNumber = field(model, "Archive Number", "Private archive record");
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    strokeRectCommand(54, 70, 504, 652, COLOR.goldSoft, 0.8),
    textCommand(78, 680, "Authentication and Keepsake Note", "F2", 18, COLOR.ink),
    strokeLineCommand(78, 662, 534, 662, COLOR.goldSoft, 0.65),
    ...paragraphBlock(
      "This certificate records the private collection prepared for the recipient named on page one. It is intended to be printed, framed, gifted, or kept with the complete family legacy collection.",
      82,
      614,
      73,
      12.4,
      18,
      COLOR.ink,
      5
    ),
    textCommand(82, 474, "Archive Number", "F2", 12, COLOR.goldSoft),
    textCommand(82, 452, archiveNumber, "F1", 12, COLOR.ink),
    rectCommand(82, 330, 448, 76, COLOR.ivorySoft),
    strokeRectCommand(82, 330, 448, 76, COLOR.goldSoft, 0.5),
    ...wrappedTextCommands(
      "This page is not a story, symbol guide, or usage instruction. It exists only to support the frameable certificate as a private keepsake record.",
      104,
      376,
      68,
      "F1",
      11.5,
      17,
      COLOR.ink,
      4
    ),
    textCommand(82, 114, "Prepared by MyKinLegacy", "F3", 9.5, COLOR.muted)
  ];
  return commands.join("\n");
}

function buildStorybookPages(model: PdfModel, image: PdfImage | null): string[] {
  const ordered = [
    { heading: "Dedication", fallback: dedicationFallback(model) },
    { heading: "The Beginning", fallback: beginningFallback(model) },
    { heading: "Life and Contribution", fallback: contributionFallback(model) },
    { heading: "A Memory", fallback: memoryFallback(model) },
    { heading: "Family Values", fallback: valuesFallback(model) },
    { heading: "What Lives On", fallback: livesOnFallback(model) },
    { heading: "Closing Letter", fallback: closingLetterFallback(model) }
  ];
  const pages = [buildStoryCover(model, image)];
  ordered.forEach((item, index) => {
    const body = sectionBody(model, item.heading, index) || item.fallback;
    pages.push(buildStoryChapterPage(model, item.heading, body, index + 1, image));
  });
  return pages;
}

function buildStoryCover(model: PdfModel, image: PdfImage | null): string {
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.charcoal),
    rectCommand(44, 54, 524, 684, COLOR.charcoalSoft),
    strokeRectCommand(44, 54, 524, 684, COLOR.goldSoft, 1),
    textCommand(76, 694, "MyKinLegacy", "F2", 14, COLOR.gold),
    textCommand(76, 670, "Family Story", "F3", 10, COLOR.ivory),
    centeredTextCommand(306, 568, model.familyName, "F2", 27, COLOR.ivory),
    centeredTextCommand(306, 538, "A private story prepared for the people who carry it forward.", "F1", 12, COLOR.mist),
    strokeLineCommand(152, 506, 460, 506, COLOR.goldSoft, 0.7),
    ...paragraphBlock(openingStorySentence(model), 134, 450, 55, 13.5, 20, COLOR.ivory, 5),
    textCommand(76, 108, "Read slowly. Keep close.", "F3", 10, COLOR.gold)
  ];

  if (image) {
    commands.push(drawImageCommand(236, 216, 140, 140));
  } else {
    commands.push(strokeRectCommand(236, 216, 140, 140, COLOR.goldSoft, 0.7));
  }

  return commands.join("\n");
}

function buildStoryChapterPage(
  _model: PdfModel,
  heading: string,
  body: string,
  chapterNumber: number,
  image: PdfImage | null
): string {
  const isMemory = heading === "A Memory";
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    rectCommand(52, 64, 508, 660, isMemory ? COLOR.parchment : COLOR.ivorySoft),
    strokeRectCommand(52, 64, 508, 660, COLOR.goldSoft, 0.65),
    textCommand(76, 688, `0${chapterNumber}`, "F2", 13, COLOR.goldSoft),
    textCommand(124, 688, heading, "F2", 20, COLOR.ink),
    strokeLineCommand(76, 660, 528, 660, COLOR.goldSoft, 0.55)
  ];

  if (image && (chapterNumber === 1 || chapterNumber === 7)) {
    commands.push(drawImageCommand(424, 530, 84, 84));
  }

  const maxLines = heading === "Closing Letter" ? 17 : 19;
  commands.push(
    ...paragraphBlock(body, 92, 610, heading === "A Memory" ? 58 : 64, 12.7, 19, COLOR.ink, maxLines)
  );
  if (isMemory) {
    commands.push(rectCommand(92, 154, 428, 72, COLOR.ivorySoft));
    commands.push(strokeRectCommand(92, 154, 428, 72, COLOR.goldSoft, 0.45));
    commands.push(
      ...wrappedTextCommands(
        "The emotional center of this story is not a symbol. It is the lived memory that made the collection worth preparing.",
        114,
        196,
        62,
        "F1",
        11,
        16,
        COLOR.ink,
        4
      )
    );
  }
  commands.push(textCommand(76, 92, "Family Story", "F3", 8.5, COLOR.muted));
  return commands.join("\n");
}

function buildMeaningGuidePages(model: PdfModel, image: PdfImage | null): string[] {
  const symbols = symbolSections(model);
  const primary = symbols[0] ?? { heading: "Primary Symbol", body: sectionBody(model, "Primary Symbol", 0) || "The central symbol gives the crest its main emotional direction." };
  const secondary = symbols[1] ?? { heading: "Secondary Symbol", body: sectionBody(model, "Secondary Symbol", 1) || "The supporting symbol adds context without competing with the main idea." };
  const supporting = symbols[2] ?? { heading: "Supporting Symbol", body: sectionBody(model, "Supporting Symbol", 2) || "The quiet supporting detail helps the crest feel complete and personal." };
  return [
    buildMeaningCover(model, image),
    buildMeaningOverview(model, image),
    buildMeaningSymbolPage(model, "Primary Symbol", primary.heading, primary.body, image, 1),
    buildMeaningSymbolPage(model, "Secondary Symbol", secondary.heading, secondary.body, image, 2),
    buildMeaningSymbolPage(model, "Supporting Symbol", supporting.heading, supporting.body, image, 3),
    buildMeaningTextPage(model, "Composition", sectionBody(model, "Composition", 3) || compositionFallback(model), image),
    buildMeaningTextPage(model, "Color and Atmosphere", sectionBody(model, "Color and Atmosphere", 4) || colorFallback(model), image),
    buildMeaningTextPage(model, "Closing Interpretation", sectionBody(model, "Closing Interpretation", 5) || meaningClosingFallback(model), image)
  ];
}

function buildMeaningCover(model: PdfModel, image: PdfImage | null): string {
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.charcoal),
    rectCommand(38, 46, 536, 700, COLOR.charcoalSoft),
    strokeRectCommand(38, 46, 536, 700, COLOR.goldSoft, 1),
    textCommand(70, 704, "MyKinLegacy", "F2", 14, COLOR.gold),
    textCommand(70, 678, "Meaning Behind Your Crest", "F2", 24, COLOR.ivory),
    textCommand(70, 648, model.familyName, "F1", 13, COLOR.mist),
    ...paragraphBlock(
      "A visual guide to the finished crest: what leads the design, what supports it, and why the final artwork belongs to this family.",
      70,
      604,
      58,
      12,
      18,
      COLOR.ivory,
      5
    )
  ];
  if (image) commands.push(drawImageCommand(190, 212, 232, 232));
  else commands.push(strokeRectCommand(190, 212, 232, 232, COLOR.goldSoft, 0.9));
  commands.push(textCommand(70, 100, "Illustrated crest guide", "F3", 9, COLOR.gold));
  return commands.join("\n");
}

function buildMeaningOverview(model: PdfModel, image: PdfImage | null): string {
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    textCommand(62, 704, "Full Crest Overview", "F2", 22, COLOR.ink),
    strokeLineCommand(62, 682, 550, 682, COLOR.goldSoft, 0.65),
    ...paragraphBlock(
      sectionBody(model, "Full Crest Overview", 0) ||
        "The crest is arranged as a finished keepsake, not a collection of separate icons. The central image carries the main meaning while the frame, branches, and atmosphere help it feel protected and complete.",
      62,
      636,
      68,
      12.2,
      18,
      COLOR.ink,
      7
    ),
    rectCommand(84, 166, 444, 310, COLOR.charcoal),
    strokeRectCommand(84, 166, 444, 310, COLOR.goldSoft, 0.8)
  ];
  if (image) commands.push(drawImageCommand(188, 206, 236, 236));
  commands.push(textCommand(62, 92, "Begin with the whole crest before reading individual symbols.", "F3", 9, COLOR.muted));
  return commands.join("\n");
}

function buildMeaningSymbolPage(
  _model: PdfModel,
  role: string,
  symbolName: string,
  body: string,
  image: PdfImage | null,
  detailIndex: number
): string {
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    rectCommand(42, 54, 528, 684, COLOR.ivorySoft),
    strokeRectCommand(42, 54, 528, 684, COLOR.goldSoft, 0.65),
    textCommand(70, 700, role, "F3", 10.5, COLOR.goldSoft),
    textCommand(70, 668, titleCase(symbolName), "F2", 24, COLOR.ink),
    rectCommand(70, 332, 230, 250, COLOR.charcoal),
    strokeRectCommand(70, 332, 230, 250, COLOR.goldSoft, 0.7),
    textCommand(330, 548, "Why this detail matters", "F2", 13, COLOR.ink),
    ...paragraphBlock(body, 330, 514, 31, 11.4, 17, COLOR.ink, 12),
    textCommand(70, 102, "The symbol is explained only in relation to this crest and this family.", "F3", 8.5, COLOR.muted)
  ];
  if (image) {
    const size = detailIndex === 1 ? 184 : 164;
    const x = detailIndex === 1 ? 93 : 103;
    const y = detailIndex === 3 ? 370 : 382;
    commands.push(drawImageCommand(x, y, size, size));
  }
  return commands.join("\n");
}

function buildMeaningTextPage(_model: PdfModel, heading: string, body: string, image: PdfImage | null): string {
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    textCommand(62, 704, heading, "F2", 22, COLOR.ink),
    strokeLineCommand(62, 680, 550, 680, COLOR.goldSoft, 0.65),
    rectCommand(62, 478, 488, 132, COLOR.charcoalWarm),
    strokeRectCommand(62, 478, 488, 132, COLOR.goldSoft, 0.6),
    textCommand(92, 558, "Visual reading", "F2", 13, COLOR.gold),
    ...wrappedTextCommands("Read the crest as one finished object: shape, symbol, material, and atmosphere working together.", 92, 532, 61, "F1", 11.5, 17, COLOR.ivory, 4),
    ...paragraphBlock(body, 82, 420, 72, 12.2, 18, COLOR.ink, 13)
  ];
  if (image) commands.push(drawImageCommand(424, 516, 74, 74));
  commands.push(textCommand(62, 88, "Meaning Behind Your Crest", "F3", 8.5, COLOR.muted));
  return commands.join("\n");
}

function parsePdfModel(input: PdfGenerationInput): PdfModel {
  const bodyText = normalizeBodyText(sanitizeOfficialClaims(input.body_text), input.title);
  const fields = parseFields(bodyText);
  const familyName =
    fieldFromMap(fields, "Presented To") ||
    fieldFromMap(fields, "Recipient") ||
    cleanDisplayName(input.house_name) ||
    "Your Family Legacy";
  return {
    deliverableCode: input.deliverable_code,
    title: input.title,
    familyName,
    bodyText,
    fields,
    sections: parseSections(bodyText)
  };
}

function parseFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z /&-]{2,42}):\s*(.+)$/.exec(line.trim());
    if (match?.[1] && match[2]) fields.set(match[1].trim(), match[2].trim());
  }
  return fields;
}

function parseSections(text: string): PdfSection[] {
  const sections: PdfSection[] = [];
  let current: PdfSection | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isSectionHeading(line)) {
      if (current) sections.push(current);
      current = { heading: line, body: "" };
      continue;
    }
    if (!current) current = { heading: "Opening", body: "" };
    current.body = [current.body, line].filter(Boolean).join(" ");
  }
  if (current) sections.push(current);
  return sections;
}

function inferDeliverableCode(text: string): PdfGenerationInput["deliverable_code"] {
  if (/Meaning Behind Your Crest|Primary Symbol|Full Crest Overview/i.test(text)) return "symbol_explanation_pdf";
  if (/Family Story|Dedication|Closing Letter/i.test(text)) return "family_story_pdf";
  return "heritage_certificate_pdf";
}

function inferTitle(text: string): string {
  if (/Meaning Behind Your Crest/i.test(text)) return "Meaning Behind Your Crest";
  if (/Family Story/i.test(text)) return "Family Story";
  return "Heritage Certificate";
}

function inferFamilyName(text: string): string {
  const match = /(?:Presented To|Recipient|Prepared for):\s*([^\n]+)/i.exec(text);
  return cleanDisplayName(match?.[1]) ?? "Your Family Legacy";
}

function field(model: PdfModel, key: string, fallback: string): string {
  return fieldFromMap(model.fields, key) ?? fallback;
}

function fieldFromMap(fields: Map<string, string>, key: string): string | null {
  for (const [fieldKey, value] of fields.entries()) {
    if (fieldKey.toLowerCase() === key.toLowerCase()) return value;
  }
  return null;
}

function sectionBody(model: PdfModel, heading: string, fallbackIndex: number): string {
  const direct = model.sections.find((section) => section.heading.toLowerCase() === heading.toLowerCase())?.body;
  if (direct) return direct;
  return model.sections[fallbackIndex]?.body ?? "";
}

function symbolSections(model: PdfModel): PdfSection[] {
  return model.sections.filter(
    (section) =>
      !/^(Opening|Full Crest Overview|Composition|Color and Atmosphere|Closing Interpretation)$/i.test(section.heading) &&
      !/^([A-Za-z /&-]+):/.test(section.heading)
  );
}

function drawImageCommand(x: number, y: number, width: number, height = width): string {
  return ["q", `${width} 0 0 ${height} ${x} ${y} cm`, "/Im1 Do", "Q"].join("\n");
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

function strokeCircleCommand(x: number, y: number, radius: number, color: readonly [number, number, number], strokeWidth: number): string {
  const c = radius * 0.5523;
  return `${color.join(" ")} RG ${strokeWidth} w ${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c S`;
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

function centeredTextCommand(
  x: number,
  y: number,
  value: string,
  font: "F1" | "F2" | "F3",
  size: number,
  color: readonly [number, number, number]
): string {
  const approxWidth = value.length * size * 0.265;
  return textCommand(x - approxWidth, y, value, font, size, color);
}

function wrappedTextCommands(
  value: string,
  x: number,
  y: number,
  width: number,
  font: "F1" | "F2" | "F3",
  size: number,
  leading: number,
  color: readonly [number, number, number],
  maxLines = 4
): string[] {
  return wrapLine(value, width)
    .slice(0, maxLines)
    .map((line, index) => textCommand(x, y - index * leading, line, font, size, color));
}

function paragraphBlock(
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  leading: number,
  color: readonly [number, number, number],
  maxLines: number
): string[] {
  const paragraphs = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const commands: string[] = [];
  let cursorY = y;
  let rendered = 0;
  for (const paragraph of paragraphs.length > 0 ? paragraphs : [value]) {
    for (const line of wrapLine(paragraph, width)) {
      if (rendered >= maxLines) return commands;
      commands.push(textCommand(x, cursorY, line, "F1", size, color));
      cursorY -= leading;
      rendered += 1;
    }
    cursorY -= Math.round(leading * 0.45);
  }
  return commands;
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

function isSectionHeading(value: string): boolean {
  return /^[A-Z][A-Za-z /&-]{2,58}$/.test(value) && !value.endsWith(".") && value.split(/\s+/).length <= 7;
}

function cleanDisplayName(value?: string | null): string | null {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  if (!cleaned || /^(unknown|null|undefined|n\/a|none)$/i.test(cleaned) || /\bHouse of Unknown\b/i.test(cleaned)) return null;
  return cleaned.slice(0, 90);
}

function ceremonialFallback(model: PdfModel): string {
  return `This certificate presents ${model.familyName} as a private family keepsake, prepared with care to mark the meaning of this collection.`;
}

function openingStorySentence(model: PdfModel): string {
  return `This story begins with ${model.familyName}, and with the quiet evidence of love, effort, memory, and continuity that made the collection worth preparing.`;
}

function dedicationFallback(model: PdfModel): string {
  return `For ${model.familyName}, this story is offered as a private expression of gratitude. It is meant to be read as a keepsake, not as a record of status or invented history.`;
}

function beginningFallback(_model: PdfModel): string {
  return `Every family story begins in ordinary moments: showing up, building a home, carrying responsibility, keeping faith, and making room for the people who come next.`;
}

function contributionFallback(model: PdfModel): string {
  return `${model.familyName} is recognized through the kind of contribution that is often felt before it is named. The value of the story lives in daily care, steady choices, and the example left for others.`;
}

function memoryFallback(_model: PdfModel): string {
  return `The memory at the center of this collection is the feeling of being held by a family life that mattered. It gives the story its warmth and keeps the collection personal.`;
}

function valuesFallback(_model: PdfModel): string {
  return `The values in this story are not slogans. They are qualities made visible through action: protection, love, resilience, integrity, faithfulness, and hope carried in practical ways.`;
}

function livesOnFallback(_model: PdfModel): string {
  return `What lives on is not a perfect history. It is the shape of care that family members can recognize, remember, and carry forward with dignity.`;
}

function closingLetterFallback(model: PdfModel): string {
  return `May this collection remind ${model.familyName} that legacy is not only what is recorded. It is what is remembered, practiced, and passed on with love.`;
}

function compositionFallback(model: PdfModel): string {
  return `The crest uses a clear center, a protective frame, and quiet supporting details so the artwork feels focused rather than crowded. Each element is meant to serve ${model.familyName}, not compete for attention.`;
}

function colorFallback(_model: PdfModel): string {
  return "The black and antique gold atmosphere gives the crest a private archive feeling: warm, dignified, printable, and suitable for a family keepsake.";
}

function meaningClosingFallback(model: PdfModel): string {
  return `The finished crest belongs to ${model.familyName} because the visual choices are tied to evidence, meaning, and emotional purpose rather than decoration alone.`;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
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
