import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "./index";

describe("PDF generation foundation", () => {
  it.each([
    ["heritage_certificate_pdf", "Heritage Certificate"],
    ["family_story_pdf", "Family Story"],
    ["symbol_explanation_pdf", "Meaning Behind Your Crest"]
  ] as const)("generates %s with full disclaimer", async (deliverableCode, title) => {
    const dir = await mkdtemp(join(tmpdir(), "ai-heritage-pdf-"));
    const output = await generateHeritagePdf({
      deliverable_code: deliverableCode,
      title,
      house_name: "House Alder",
      body_text: [
        "House Alder is represented through protection, resilience, and gratitude.",
        "The shield represents a stable family frame, the oak represents endurance, and the warm gold palette gives the collection a private archival feeling.",
        "This document is intended to be read as part of a family keepsake collection, with enough substance to preserve meaning rather than act as a placeholder."
      ].join(" ".repeat(2)).repeat(35),
      disclaimer: GLOBAL_PDF_DISCLAIMER,
      output_file_path: join(dir, `${deliverableCode}.pdf`)
    });
    const body = await readFile(output.file_path);

    expect(output.mime_type).toBe("application/pdf");
    expect(output.size_bytes).toBeGreaterThan(10 * 1024);
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    const pdfText = body.toString("latin1");
    expect(pdfText).toContain("pdf_layout_version=premium_v4");
    expect(pdfText).toContain("approved crest artwork");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText).toContain("clean keepsake document");
    expect(pdfText).toContain("Private Legacy Collection");
    expect(body.includes(Buffer.from("%%EOF"))).toBe(true);
    expect(pdfStartXrefValid(body)).toBe(true);
    expect(pdfText).toContain("MyKinLegacy");
    expect(pdfText).toContain("Private Archive");
    expect(pdfText).toContain("Important Note");
    expect(pdfText).toContain("personalized symbolic keepsake");
    expect(pdfText).toContain("certified genealogical");
    expect(pdfText).toContain("record");
    expect(pdfText).not.toMatch(/AI-generated|AI generated|placeholder|internal beta|alpha/i);
    expect(pdfText.indexOf("Important Note")).toBeGreaterThan(pdfText.indexOf(title));
    await rm(dir, { recursive: true, force: true });
  });
});

function pdfStartXrefValid(body: Buffer): boolean {
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/s.exec(body.toString("latin1"));
  if (!match) return false;
  const offset = Number(match[1]);
  return Number.isInteger(offset) && body.subarray(offset, offset + 4).toString("latin1") === "xref";
}
