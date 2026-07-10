import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "./index";

const FORBIDDEN_SHARED_LANGUAGE = /Inside this document|Private Archive \/ clean keepsake document|Important Note|personalized symbolic keepsake|certified genealogical|internal beta|alpha/i;

describe("PDF generation foundation", () => {
  it("generates a frameable certificate with no story or guide content", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "heritage_certificate_pdf",
      title: "Heritage Certificate",
      body_text: [
        "Collection Name: House Alder Legacy Collection",
        "Presented To: Father",
        "Occasion: Retirement",
        "Crest: Final crest artwork prepared for this collection.",
        "Archive Number: AHL-TEST-01",
        "Date: July 10, 2026",
        "Signature: MyKinLegacy Legacy Curator",
        "Official Seal: MyKinLegacy keepsake seal",
        "",
        "Ceremony Statement",
        "Father is presented with this private family legacy collection for retirement, prepared with care, dignity, and gratitude."
      ].join("\n")
    });

    expect(pdfText).toContain("pdf_layout_version=premium_v4");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText).toContain("HERITAGE CERTIFICATE");
    expect(pdfText).toContain("Presented To");
    expect(pdfText).toContain("Archive Number");
    expect(pdfText).toContain("Official Seal");
    expect(pdfText).not.toContain("Family Story");
    expect(pdfText).not.toContain("Primary Symbol");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    expect(pdfText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(2);
  });

  it("generates a distinct family storybook without certificate or symbol-guide labels", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "family_story_pdf",
      title: "Family Story",
      body_text: [
        "Dedication",
        "For Mother on her 60th birthday, this story is offered with gratitude.",
        "The Beginning",
        "The family remembers a home held together with patience, kindness, and strength.",
        "Life and Contribution",
        "Her contribution was steady and practical, shown through daily care rather than ceremony.",
        "A Memory",
        "The emotional center is the memory of being welcomed, fed, listened to, and protected.",
        "Family Values",
        "Love, kindness, and strength appear through lived experience.",
        "What Lives On",
        "What lives on is the feeling of being gathered together.",
        "Closing Letter",
        "May this story remind the family that love can become a legacy."
      ].join("\n")
    });

    expect(pdfText).toContain("Family Story");
    expect(pdfText).toContain("Dedication");
    expect(pdfText).toContain("The Beginning");
    expect(pdfText).toContain("A Memory");
    expect(pdfText).toContain("Closing Letter");
    expect(pdfText).not.toContain("Official Seal");
    expect(pdfText).not.toContain("Meaning:");
    expect(pdfText).not.toContain("Relationship to family:");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    const pages = pdfText.match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(pages.length).toBeLessThanOrEqual(8);
  });

  it("generates a visual meaning guide without dictionary blocks or story repetition", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "symbol_explanation_pdf",
      title: "Meaning Behind Your Crest",
      body_text: [
        "Full Crest Overview",
        "The crest is read as one finished object, with the tree leading the design.",
        "Primary Symbol",
        "Tree was chosen because it carries continuity, roots, and family unity.",
        "Secondary Symbol",
        "Shield supports the design by giving the crest a protected frame.",
        "Supporting Symbol",
        "Laurel adds gratitude and quiet honor without pretending status.",
        "Composition",
        "One idea leads, two ideas support, and the frame keeps the crest calm.",
        "Color and Atmosphere",
        "The black and antique gold palette gives the crest a private archive feeling.",
        "Closing Interpretation",
        "The finished crest belongs to the recipient because the symbols are earned by evidence."
      ].join("\n")
    });

    expect(pdfText).toContain("Meaning Behind Your Crest");
    expect(pdfText).toContain("Full Crest Overview");
    expect(pdfText).toContain("Primary Symbol");
    expect(pdfText).toContain("Composition");
    expect(pdfText).toContain("Color and Atmosphere");
    expect(pdfText).toContain("Closing Interpretation");
    expect(pdfText).not.toContain("Meaning:");
    expect(pdfText).not.toContain("Why chosen:");
    expect(pdfText).not.toContain("Emotional role:");
    expect(pdfText).not.toContain("Official Seal");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    const pages = pdfText.match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(6);
    expect(pages.length).toBeLessThanOrEqual(8);
  });
});

async function generateTextFor(input: {
  deliverable_code: "heritage_certificate_pdf" | "family_story_pdf" | "symbol_explanation_pdf";
  title: string;
  body_text: string;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-heritage-pdf-"));
  const output = await generateHeritagePdf({
    ...input,
    house_name: "House Alder",
    disclaimer: GLOBAL_PDF_DISCLAIMER,
    output_file_path: join(dir, `${input.deliverable_code}.pdf`)
  });
  const body = await readFile(output.file_path);
  expect(output.mime_type).toBe("application/pdf");
  expect(output.size_bytes).toBeGreaterThan(10 * 1024);
  expect(body.subarray(0, 4).toString()).toBe("%PDF");
  expect(body.includes(Buffer.from("%%EOF"))).toBe(true);
  expect(pdfStartXrefValid(body)).toBe(true);
  await rm(dir, { recursive: true, force: true });
  return body.toString("latin1");
}

function pdfStartXrefValid(body: Buffer): boolean {
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/s.exec(body.toString("latin1"));
  if (!match) return false;
  const offset = Number(match[1]);
  return Number.isInteger(offset) && body.subarray(offset, offset + 4).toString("latin1") === "xref";
}
