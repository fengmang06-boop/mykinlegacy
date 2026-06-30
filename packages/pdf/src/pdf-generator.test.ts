import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { GLOBAL_PDF_DISCLAIMER, generateHeritagePdf } from "./index";

describe("PDF generation foundation", () => {
  it.each([
    ["heritage_certificate_pdf", "Heritage Certificate"],
    ["family_story_pdf", "Family Story"],
    ["symbol_explanation_pdf", "Symbol Explanation"]
  ] as const)("generates %s with full disclaimer", async (deliverableCode, title) => {
    const dir = await mkdtemp(join(tmpdir(), "ai-heritage-pdf-"));
    const output = await generateHeritagePdf({
      deliverable_code: deliverableCode,
      title,
      house_name: "House Alder",
      body_text: "A personalized symbolic text for the family.",
      disclaimer: GLOBAL_PDF_DISCLAIMER,
      output_file_path: join(dir, `${deliverableCode}.pdf`)
    });
    const body = await readFile(output.file_path);

    expect(output.mime_type).toBe("application/pdf");
    expect(output.size_bytes).toBeGreaterThan(0);
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    expect(body.includes(Buffer.from(GLOBAL_PDF_DISCLAIMER))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
