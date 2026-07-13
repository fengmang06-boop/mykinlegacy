import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import type { PdfGenerationInput, PdfGenerationOutput } from "./types";

export const GLOBAL_PDF_DISCLAIMER =
  "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";

const PDF_LAYOUT_VERSION = "premium_v5_frameable";
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const COLOR = {
  charcoal: [0.055, 0.052, 0.046] as const,
  charcoalSoft: [0.105, 0.094, 0.078] as const,
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

interface PdfArtwork {
  full: PdfImage;
  shield: PdfImage;
  tree: PdfImage;
  knot: PdfImage;
  keyStar: PdfImage;
  laurel: PdfImage;
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
  const artwork = loadApprovedCrestArtwork();
  const pageContents = buildPublicationPages(model, artwork);
  const bodyFontObjectId = 3;
  const headingFontObjectId = 4;
  const utilityFontObjectId = 5;
  const imageEntries: Array<[string, PdfImage]> = artwork
    ? [
        ["Im1", artwork.full],
        ["Im2", artwork.shield],
        ["Im3", artwork.tree],
        ["Im4", artwork.knot],
        ["Im5", artwork.keyStar],
        ["Im6", artwork.laurel]
      ]
    : [];
  const firstPageObjectId = 6 + imageEntries.length;
  const pageObjectIds = pageContents.map((_, index) => firstPageObjectId + index * 2);
  const resourceXObject = imageEntries.length
    ? `/XObject << ${imageEntries.map(([name], index) => `/${name} ${6 + index} 0 R`).join(" ")} >> `
    : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageContents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  for (const [, image] of imageEntries) {
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

function buildPublicationPages(model: PdfModel, artwork: PdfArtwork | null): string[] {
  if (model.deliverableCode === "heritage_certificate_pdf") return buildCertificatePages(model, artwork?.full ?? null);
  if (model.deliverableCode === "family_story_pdf") return buildStorybookPages(model, artwork?.full ?? null);
  return buildMeaningGuidePages(model, artwork);
}

function buildCertificatePages(model: PdfModel, image: PdfImage | null): string[] {
  return [buildCertificateMainPage(model, image)];
}

function buildCertificateMainPage(model: PdfModel, image: PdfImage | null): string {
  const recipient = field(model, "Presented To", field(model, "Recipient", model.familyName));
  const occasion = field(model, "Created For", field(model, "Occasion", "A family milestone"));
  const values = field(model, "Family Values", "Love, unity, and legacy");
  const date = field(model, "Date", formatDisplayDate(new Date()));
  const archiveNumber = field(model, "Archive Number", "Archive record pending");
  const statement = sectionBody(model, "Ceremony Statement", 0) || model.sections.at(-1)?.body || ceremonialFallback(model);
  const recipientSize = recipient.length > 36 ? 18 : recipient.length > 25 ? 22 : 29;
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.parchment),
    rectCommand(24, 24, 564, 744, COLOR.charcoal),
    rectCommand(31, 31, 550, 730, COLOR.ivorySoft),
    strokeRectCommand(37, 37, 538, 718, COLOR.gold, 1.5),
    strokeRectCommand(45, 45, 522, 702, COLOR.goldSoft, 0.7),
    strokeRectCommand(53, 53, 506, 686, COLOR.mist, 0.35),
    ...certificateCornerOrnaments(),
    centeredTextCommand(306, 718, "MYKINLEGACY", "F2", 12, COLOR.goldSoft),
    centeredTextCommand(306, 699, "LEGACY, DESIGNED.", "F3", 6.8, COLOR.muted),
    centeredTextCommand(306, 664, "FAMILY LEGACY CERTIFICATE", "F2", 23, COLOR.ink),
    centeredTextCommand(306, 640, `CREATED FOR ${occasion.toUpperCase()}`, "F3", occasion.length > 30 ? 7.5 : 9, COLOR.goldSoft),
    centeredTextCommand(306, 424, "PRESENTED TO", "F3", 9.5, COLOR.muted),
    centeredTextCommand(306, 389, recipient, "F2", recipientSize, COLOR.ink),
    strokeLineCommand(116, 371, 496, 371, COLOR.goldSoft, 0.9),
    centeredTextCommand(306, 348, values.toUpperCase(), "F3", values.length > 48 ? 7.4 : 9, COLOR.goldSoft),
    rectCommand(70, 214, 472, 104, COLOR.ivory),
    strokeRectCommand(70, 214, 472, 104, COLOR.goldSoft, 0.6),
    ...wrappedTextCommands(statement, 92, 289, 76, "F1", 10.7, 14.5, COLOR.ink, 6),
    textCommand(82, 181, "DATE", "F3", 7.5, COLOR.muted),
    textCommand(82, 161, date, "F1", 10.5, COLOR.ink),
    textCommand(314, 181, "ARCHIVE NUMBER", "F3", 7.5, COLOR.muted),
    textCommand(314, 161, archiveNumber, "F1", archiveNumber.length > 28 ? 8.5 : 10.5, COLOR.ink),
    strokeLineCommand(82, 112, 286, 112, COLOR.goldSoft, 0.75),
    textCommand(104, 94, "MyKinLegacy", "F2", 10.5, COLOR.ink),
    textCommand(104, 80, "Legacy Curator", "F3", 7.5, COLOR.muted),
    fillCircleCommand(472, 110, 37, COLOR.goldSoft),
    strokeCircleCommand(472, 110, 30, COLOR.ivorySoft, 0.9),
    strokeCircleCommand(472, 110, 24, COLOR.ivorySoft, 0.45),
    centeredTextCommand(472, 116, "MKL", "F2", 13, COLOR.ivorySoft),
    centeredTextCommand(472, 99, "SEAL", "F3", 6.2, COLOR.ivorySoft)
  ];

  if (image) {
    commands.push(drawImageCommand(206, 438, 200, 200));
  } else {
    commands.push(strokeRectCommand(206, 438, 200, 200, COLOR.goldSoft, 0.7));
    commands.push(centeredTextCommand(306, 526, "Final Crest", "F2", 13, COLOR.goldSoft));
  }

  return commands.join("\n");
}

function buildStorybookPages(model: PdfModel, image: PdfImage | null): string[] {
  const ordered = [
    storyChapter(model, ["Dedication"], "Dedication", dedicationFallback(model)),
    storyChapter(
      model,
      [
        "Thirty-Five Years of Quiet Strength",
        "A Life of Quiet Strength",
        "A Life of Steady Contribution",
        "The Care at the Heart of Christmas",
        "A Family Story Beginning Together",
        "A Life Worth Celebrating",
        "A Life Held in Gratitude",
        "Life and Contribution",
        "The Beginning"
      ],
      "A Life of Quiet Strength",
      contributionFallback(model)
    ),
    storyChapter(
      model,
      ["What He Gave His Family", "What She Gave Her Family", "What They Gave Their Family", "What the Family Received", "A Memory", "Family Values"],
      "What the Family Received",
      memoryFallback(model)
    ),
    storyChapter(
      model,
      ["What His Children Carry Forward", "What Her Children Carry Forward", "What Their Family Carries Forward", "What the Family Carries Forward", "What Lives On"],
      "What the Family Carries Forward",
      livesOnFallback(model)
    ),
    storyChapter(model, ["Closing Letter"], "Closing Letter", closingLetterFallback(model))
  ];
  const pages = [buildStoryCover(model, image)];
  ordered.forEach((item, index) => {
    pages.push(buildStoryChapterPage(model, item.heading, item.body, index + 1, image));
  });
  return pages;
}

function storyChapter(model: PdfModel, candidates: string[], fallbackHeading: string, fallbackBody: string): PdfSection {
  const section = model.sections.find((item) => candidates.some((candidate) => candidate.toLowerCase() === item.heading.toLowerCase()));
  return section?.body ? section : { heading: fallbackHeading, body: fallbackBody };
}

function buildStoryCover(model: PdfModel, image: PdfImage | null): string {
  const occasion = field(model, "Occasion", "a meaningful family occasion");
  const voice = pdfRecipientVoice(model);
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.charcoal),
    rectCommand(44, 54, 524, 684, COLOR.charcoalSoft),
    strokeRectCommand(44, 54, 524, 684, COLOR.goldSoft, 1),
    textCommand(76, 694, "MyKinLegacy", "F2", 14, COLOR.gold),
    textCommand(76, 670, "Family Story", "F3", 10, COLOR.ivory),
    centeredTextCommand(306, 568, `A Story for ${model.familyName}`, "F2", 25, COLOR.ivory),
    centeredTextCommand(306, 538, `Prepared with care for ${occasion}.`, "F1", 12, COLOR.mist),
    strokeLineCommand(152, 506, 460, 506, COLOR.goldSoft, 0.7),
    ...paragraphBlock(openingStorySentence(model), 134, 450, 55, 13.5, 20, COLOR.ivory, 5),
    textCommand(76, 108, `For the family shaped by ${voice.possessive} example.`, "F3", 10, COLOR.gold)
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
  const isMemory = /Years of Quiet Strength|A Life of Quiet Strength/i.test(heading);
  const pageFill = chapterNumber === 1 ? COLOR.ivorySoft : chapterNumber === 2 ? COLOR.parchment : chapterNumber === 5 ? COLOR.charcoalSoft : COLOR.ivory;
  const textColor = chapterNumber === 5 ? COLOR.ivory : COLOR.ink;
  const mutedColor = chapterNumber === 5 ? COLOR.mist : COLOR.muted;
  const commands: string[] = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, chapterNumber === 5 ? COLOR.charcoal : COLOR.ivory),
    rectCommand(52, 64, 508, 660, pageFill),
    strokeRectCommand(52, 64, 508, 660, COLOR.goldSoft, 0.65),
    textCommand(76, 688, `0${chapterNumber}`, "F2", 13, COLOR.goldSoft),
    textCommand(124, 688, heading, "F2", heading.length > 30 ? 17 : 20, textColor),
    strokeLineCommand(76, 660, 528, 660, COLOR.goldSoft, 0.55)
  ];

  if (image && (chapterNumber === 1 || chapterNumber === 5)) {
    commands.push(drawImageCommand(424, 530, 84, 84));
  }

  if (isMemory) {
    commands.push(textCommand(92, 606, "THIRTY-FIVE YEARS", "F2", 11, COLOR.goldSoft));
    commands.push(textCommand(92, 580, "One quiet promise, kept every day.", "F1", 16, COLOR.ink));
    commands.push(strokeLineCommand(92, 558, 470, 558, COLOR.goldSoft, 0.55));
  }
  const maxLines = heading === "Closing Letter" ? 18 : 20;
  commands.push(
    ...paragraphBlock(body, 92, isMemory ? 518 : 610, 64, 12.7, 19, textColor, maxLines)
  );
  commands.push(textCommand(76, 92, "Family Story", "F3", 8.5, mutedColor));
  return commands.join("\n");
}

function buildMeaningGuidePages(model: PdfModel, artwork: PdfArtwork | null): string[] {
  const details = [
    { heading: "The Shield", imageName: "Im2", fallback: shieldMeaningFallback(model) },
    { heading: "The Tree", imageName: "Im3", fallback: treeMeaningFallback(model) },
    { heading: "The Knot", imageName: "Im4", fallback: knotMeaningFallback(model) },
    { heading: "The Key and Guiding Star", imageName: "Im5", fallback: keyStarMeaningFallback(model) },
    { heading: "The Laurel Frame", imageName: "Im6", fallback: laurelMeaningFallback(model) }
  ];
  return [
    buildMeaningCover(model, artwork?.full ?? null),
    ...details.map((detail, index) =>
      buildMeaningDetailPage(
        detail.heading,
        sectionBody(model, detail.heading, index) || detail.fallback,
        detail.imageName,
        artwork !== null,
        index
      )
    )
  ];
}

function buildMeaningCover(model: PdfModel, image: PdfImage | null): string {
  const values = field(model, "Family Values", "love, unity, and legacy");
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.charcoal),
    rectCommand(38, 46, 536, 700, COLOR.charcoalSoft),
    strokeRectCommand(38, 46, 536, 700, COLOR.goldSoft, 1),
    textCommand(70, 704, "MyKinLegacy", "F2", 14, COLOR.gold),
    textCommand(70, 678, "Meaning Behind Your Crest", "F2", 24, COLOR.ivory),
    textCommand(70, 648, model.familyName, "F1", 13, COLOR.mist),
    ...paragraphBlock(
      `An illustrated guide to the details that honor ${model.familyName}: ${values.toLowerCase()}, and the meaning carried forward through family.`,
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
  commands.push(textCommand(70, 100, "Five details. One life honored.", "F3", 9, COLOR.gold));
  return commands.join("\n");
}

function buildMeaningDetailPage(
  heading: string,
  body: string,
  imageName: string,
  hasArtwork: boolean,
  detailIndex: number
): string {
  const imageLayouts = [
    { x: 154, y: 360, width: 304, height: 270 },
    { x: 146, y: 362, width: 320, height: 260 },
    { x: 136, y: 378, width: 340, height: 225 },
    { x: 112, y: 396, width: 388, height: 178 },
    { x: 108, y: 370, width: 396, height: 238 }
  ];
  const layout = imageLayouts[detailIndex] ?? imageLayouts[0];
  const commands = [
    rectCommand(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.ivory),
    rectCommand(42, 54, 528, 684, COLOR.ivorySoft),
    strokeRectCommand(42, 54, 528, 684, COLOR.goldSoft, 0.65),
    textCommand(70, 700, `DETAIL 0${detailIndex + 1}`, "F3", 10, COLOR.goldSoft),
    textCommand(70, 664, heading, "F2", heading.length > 22 ? 21 : 25, COLOR.ink),
    rectCommand(76, 334, 460, 306, COLOR.charcoal),
    strokeRectCommand(76, 334, 460, 306, COLOR.goldSoft, 0.7),
    ...paragraphBlock(body, 88, 286, 70, 12.2, 18, COLOR.ink, 10),
    textCommand(70, 92, "Meaning Behind Your Crest", "F3", 8.5, COLOR.muted)
  ];
  if (hasArtwork && layout) {
    commands.push(drawImageCommand(layout.x, layout.y, layout.width, layout.height, imageName));
  }
  return commands.join("\n");
}

function parsePdfModel(input: PdfGenerationInput): PdfModel {
  const bodyText = normalizeBodyText(sanitizeOfficialClaims(input.body_text), input.title);
  const fields = parseFields(bodyText);
  const familyName =
    fieldFromMap(fields, "Presented To") ||
    fieldFromMap(fields, "Recipient") ||
    cleanDisplayName(input.house_name) ||
    "Family Keepsake";
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
  if (/Heritage Certificate|Presented To:/i.test(text)) return "heritage_certificate_pdf";
  if (/Meaning Behind Your Crest|The Shield|The Tree|The Knot/i.test(text)) return "symbol_explanation_pdf";
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
  return cleanDisplayName(match?.[1]) ?? "Family Keepsake";
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

function drawImageCommand(x: number, y: number, width: number, height = width, imageName = "Im1"): string {
  return ["q", `${width} 0 0 ${height} ${x} ${y} cm`, `/${imageName} Do`, "Q"].join("\n");
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

function certificateCornerOrnaments(): string[] {
  return [
    strokeLineCommand(54, 73, 54, 112, COLOR.goldSoft, 0.7),
    strokeLineCommand(54, 73, 93, 73, COLOR.goldSoft, 0.7),
    strokeCircleCommand(54, 73, 4, COLOR.goldSoft, 0.7),
    strokeLineCommand(558, 73, 558, 112, COLOR.goldSoft, 0.7),
    strokeLineCommand(519, 73, 558, 73, COLOR.goldSoft, 0.7),
    strokeCircleCommand(558, 73, 4, COLOR.goldSoft, 0.7),
    strokeLineCommand(54, 719, 54, 680, COLOR.goldSoft, 0.7),
    strokeLineCommand(54, 719, 93, 719, COLOR.goldSoft, 0.7),
    strokeCircleCommand(54, 719, 4, COLOR.goldSoft, 0.7),
    strokeLineCommand(558, 719, 558, 680, COLOR.goldSoft, 0.7),
    strokeLineCommand(519, 719, 558, 719, COLOR.goldSoft, 0.7),
    strokeCircleCommand(558, 719, 4, COLOR.goldSoft, 0.7),
    strokeLineCommand(252, 731, 360, 731, COLOR.goldSoft, 0.45),
    fillCircleCommand(306, 731, 2.5, COLOR.goldSoft)
  ];
}

function strokeCircleCommand(x: number, y: number, radius: number, color: readonly [number, number, number], strokeWidth: number): string {
  const c = radius * 0.5523;
  return `${color.join(" ")} RG ${strokeWidth} w ${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c S`;
}

function fillCircleCommand(x: number, y: number, radius: number, color: readonly [number, number, number]): string {
  const c = radius * 0.5523;
  return `${color.join(" ")} rg ${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c f`;
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
  const occasion = field(model, "Created For", "a meaningful family occasion");
  const values = field(model, "Family Values", "love, unity, and legacy").toLowerCase();
  return `Presented to ${model.familyName} for ${occasion}, in recognition of ${values} and the care this family wishes to preserve.`;
}

function openingStorySentence(model: PdfModel): string {
  const values = field(model, "Family Values", "love, unity, and legacy").toLowerCase();
  return `${model.familyName}'s story gives ${values} a human form through choices, memories, and an example the family can recognize.`;
}

function dedicationFallback(model: PdfModel): string {
  return `For ${model.familyName}, this story is offered as a private expression of gratitude. It is meant to be read as a keepsake, not as a record of status or invented history.`;
}

function contributionFallback(model: PdfModel): string {
  return `${model.familyName} is recognized through the kind of contribution that is often felt before it is named. The value of the story lives in daily care, steady choices, and the example left for others.`;
}

function memoryFallback(_model: PdfModel): string {
  return `The memory at the center of this collection is the feeling of being held by a family life that mattered. It gives the story its warmth and keeps the collection personal.`;
}

function livesOnFallback(_model: PdfModel): string {
  return `What lives on is not a perfect history. It is the shape of care that family members can recognize, remember, and carry forward with dignity.`;
}

function closingLetterFallback(model: PdfModel): string {
  return `May this collection remind ${model.familyName} that legacy is not only what is recorded. It is what is remembered, practiced, and passed on with love.`;
}

function shieldMeaningFallback(model: PdfModel): string {
  const voice = pdfRecipientVoice(model);
  return `The shield reflects the protection associated with ${model.familyName}. Its strength is calm rather than aggressive: a boundary around the people ${voice.subject} holds close, built through responsibility, practical care, and the choices that help family life feel secure.`;
}

function treeMeaningFallback(model: PdfModel): string {
  const voice = pdfRecipientVoice(model);
  return `The tree represents the family life ${model.familyName} helped sustain. Its trunk suggests character under pressure, while its branches show the relationships and possibilities that grew around ${voice.object}. The image turns lived values into something visible: shelter, continuity, and a future made steadier by ${voice.possessive} example.`;
}

function knotMeaningFallback(model: PdfModel): string {
  return `The knot at the roots gives family connection a visible form. Its interwoven lines acknowledge that responsibility, affection, memory, and family life are connected in ${model.familyName}'s story. The knot honors those bonds without making them grander than the honest details the family chose to preserve.`;
}

function keyStarMeaningFallback(model: PdfModel): string {
  const voice = pdfRecipientVoice(model);
  return `The key and guiding star speak to what ${model.familyName} opened for others and how ${voice.subject} offered direction. The key suggests trust and opportunity. The star reflects guidance through example, keeping ${voice.possessive} influence present beyond this occasion and into the family's next chapter.`;
}

function laurelMeaningFallback(model: PdfModel): string {
  const occasion = field(model, "Occasion", "this family occasion").toLowerCase();
  const voice = pdfRecipientVoice(model);
  return `The laurel frame marks ${occasion} with gratitude, not status. Its branches surround the crest as a quiet recognition of the values held here. For ${model.familyName}, it says that ${voice.possessive} presence matters, ${voice.possessive} contribution is remembered, and the family's meaning will continue.`;
}

function pdfRecipientVoice(model: PdfModel): { subject: "he" | "she" | "they"; object: "him" | "her" | "them"; possessive: "his" | "her" | "their" } {
  const evidence = `${field(model, "Relationship", "")} ${model.familyName}`.toLowerCase();
  if (/\b(mother|grandmother|wife|daughter|sister|aunt|woman|female)\b/.test(evidence)) {
    return { subject: "she", object: "her", possessive: "her" };
  }
  if (/\b(father|grandfather|husband|son|brother|uncle|man|male)\b/.test(evidence)) {
    return { subject: "he", object: "him", possessive: "his" };
  }
  return { subject: "they", object: "them", possessive: "their" };
}

function formatDisplayDate(value: Date): string {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function loadApprovedCrestArtwork(): PdfArtwork | null {
  for (const filePath of approvedCrestCandidates()) {
    try {
      if (!existsSync(filePath)) continue;
      const decoded = decodePng(readFileSync(filePath));
      return {
        full: rgbToPdfImage(decoded.rgb, decoded.width, decoded.height, 420),
        shield: cropPdfImage(decoded, { x: 210, y: 160, width: 840, height: 850 }, 420),
        tree: cropPdfImage(decoded, { x: 320, y: 205, width: 620, height: 560 }, 420),
        knot: cropPdfImage(decoded, { x: 350, y: 635, width: 560, height: 350 }, 420),
        keyStar: cropPdfImage(decoded, { x: 290, y: 500, width: 650, height: 290 }, 420),
        laurel: cropPdfImage(decoded, { x: 75, y: 315, width: 1100, height: 650 }, 420)
      };
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

function rgbToPdfImage(rgb: Buffer, width: number, height: number, maxDimension: number): PdfImage {
  const resized = downsampleRgb(rgb, width, height, maxDimension);
  return {
    width: resized.width,
    height: resized.height,
    data: deflateSync(resized.rgb)
  };
}

function cropPdfImage(
  decoded: { width: number; height: number; rgb: Buffer },
  crop: { x: number; y: number; width: number; height: number },
  maxDimension: number
): PdfImage {
  const x = Math.max(0, Math.min(decoded.width - 1, crop.x));
  const y = Math.max(0, Math.min(decoded.height - 1, crop.y));
  const width = Math.max(1, Math.min(crop.width, decoded.width - x));
  const height = Math.max(1, Math.min(crop.height, decoded.height - y));
  const rgb = Buffer.alloc(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * decoded.width + x) * 3;
    const targetStart = row * width * 3;
    decoded.rgb.copy(rgb, targetStart, sourceStart, sourceStart + width * 3);
  }
  return rgbToPdfImage(rgb, width, height, maxDimension);
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
