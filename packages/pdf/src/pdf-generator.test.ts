import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "./index";

const FORBIDDEN_SHARED_LANGUAGE = /Your Family Legacy|Private family gift|customer input|customer selected|customer wording|maps to|symbolic interpretation|this page is not|Recorded at the time this collection was prepared|Inside this document|internal beta|alpha/i;

describe("PDF generation foundation", () => {
  it("generates a frameable certificate with no story or guide content", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "heritage_certificate_pdf",
      title: "Heritage Certificate",
      body_text: [
        "Presented To: Michael Johnson",
        "Relationship: My father",
        "Created For: Retirement",
        "Family Values: Protection, Integrity, and Sacrifice",
        "Crest: Final Crest",
        "Archive Number: AHL-TEST-01",
        "Date: July 11, 2026",
        "Signature: MyKinLegacy Legacy Curator",
        "Brand Seal: MyKinLegacy",
        "",
        "Ceremony Statement",
        "Presented in recognition of thirty-five years of quiet strength. Michael Johnson protected his family through steady work, lived with integrity, and carried sacrifice without asking for praise.",
        "Archive Authentication",
        "This certificate is recorded by MyKinLegacy under archive number AHL-TEST-01.",
        "Keepsake Note",
        "May it remain with the crest and family story as a lasting record of the life and values honored here."
      ].join("\n")
    });

    expect(pdfText).toContain("pdf_layout_version=premium_v5_frameable");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText).toContain("FAMILY LEGACY CERTIFICATE");
    expect(pdfText).toContain("PRESENTED TO");
    expect(pdfText).toContain("ARCHIVE NUMBER");
    expect(pdfText).toContain("MKL");
    expect(pdfText).not.toContain("Official Seal");
    expect(pdfText).not.toContain("Family Story");
    expect(pdfText).not.toContain("Primary Symbol");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    expect(pdfText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(1);
  });

  it("generates a distinct family storybook without certificate or symbol-guide labels", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "family_story_pdf",
      title: "Family Story",
      body_text: [
        "Dedication",
        "For Michael Johnson, with gratitude at retirement. This story honors the years in which responsibility became care and integrity was taught through example.",
        "Thirty-Five Years of Quiet Strength",
        "For thirty-five years, Michael worked to support and protect his family. He rarely spoke about sacrifice; he simply carried it in the choices he made every day.",
        "What He Gave His Family",
        "His family received security, patience, and a standard of integrity that never required a speech. The memory of his steady work is the emotional center of this story.",
        "What His Children Carry Forward",
        "His children carry forward the habit of keeping promises, protecting one another, and doing what is right when nobody is watching.",
        "Closing Letter",
        "Michael, your work mattered, your sacrifices were seen, and your example has already become part of the family."
      ].join("\n")
    });

    expect(pdfText).toContain("Family Story");
    expect(pdfText).toContain("Dedication");
    expect(pdfText).toContain("Thirty-Five Years of Quiet Strength");
    expect(pdfText).toContain("What He Gave His Family");
    expect(pdfText).toContain("Closing Letter");
    expect(pdfText).not.toContain("Official Seal");
    expect(pdfText).not.toContain("Meaning:");
    expect(pdfText).not.toContain("Relationship to family:");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    const pages = pdfText.match(/\/Type \/Page\b/g) ?? [];
    expect(pages).toHaveLength(6);
  });

  it("uses relationship and occasion fields for safe publication fallbacks", async () => {
    const commonFields = [
      "Recipient: Elena Johnson",
      "Relationship: My mother",
      "Occasion: Christmas",
      "Family Values: Love, Kindness, and Strength"
    ];
    const story = await generateTextFor({
      deliverable_code: "family_story_pdf",
      title: "Family Story",
      body_text: ["Family Story", ...commonFields].join("\n")
    });
    const meaning = await generateTextFor({
      deliverable_code: "symbol_explanation_pdf",
      title: "Meaning Behind Your Crest",
      body_text: ["Meaning Behind Your Crest", ...commonFields].join("\n")
    });
    const combined = `${story}\n${meaning}`;

    expect(combined).toContain("Christmas");
    expect(combined).toContain("For the family shaped by her example.");
    expect(combined).not.toContain("his example");
    expect(combined).not.toContain("after retirement");
  });

  it("generates a visual meaning guide without dictionary blocks or story repetition", async () => {
    const pdfText = await generateTextFor({
      deliverable_code: "symbol_explanation_pdf",
      title: "Meaning Behind Your Crest",
      body_text: [
        "The Shield",
        "The shield reflects the protection Michael Johnson gave through years of dependable work. Its strength is calm rather than aggressive: a boundary around the people he loved, built through responsibility, practical care, and the decision to place family security before personal recognition.",
        "The Tree",
        "The tree represents the family life Michael Johnson helped sustain. Its trunk suggests integrity under pressure, while its branches show the people and possibilities that grew from his effort. The image turns thirty-five years of work into something living: shelter, continuity, and a future made steadier by his example.",
        "The Knot",
        "The knot at the roots gives sacrifice a visible form. Its interwoven lines acknowledge that work, duty, love, and family life were never separate for Michael Johnson. He rarely spoke about what he gave up; the knot honors those choices without making them grander than the quiet truth.",
        "The Key and Guiding Star",
        "The key and guiding star speak to what Michael Johnson opened for his children and how he led them. The key suggests opportunity earned through steady labor. The star reflects guidance offered through conduct rather than speeches: a clear example of integrity that remains useful long after retirement.",
        "The Laurel Frame",
        "The laurel frame marks retirement with gratitude, not status. Its branches surround the crest as recognition for endurance, service, and work completed with dignity. For Michael Johnson, it is a quiet thank-you from the family: the years were noticed, the sacrifices mattered, and the example will continue."
      ].join("\n")
    });

    expect(pdfText).toContain("Meaning Behind Your Crest");
    expect(pdfText).toContain("The Shield");
    expect(pdfText).toContain("The Tree");
    expect(pdfText).toContain("The Knot");
    expect(pdfText).toContain("The Key and Guiding Star");
    expect(pdfText).toContain("The Laurel Frame");
    expect(pdfText).not.toContain("Primary Symbol");
    expect(pdfText).not.toContain("Meaning:");
    expect(pdfText).not.toContain("Why chosen:");
    expect(pdfText).not.toContain("Emotional role:");
    expect(pdfText).not.toContain("Official Seal");
    expect(pdfText).not.toMatch(FORBIDDEN_SHARED_LANGUAGE);
    const pages = pdfText.match(/\/Type \/Page\b/g) ?? [];
    expect(pages).toHaveLength(6);
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
