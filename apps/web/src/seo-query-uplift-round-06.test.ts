import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("SEO internal-link reachability round 06", () => {
  it("links the Journal hub to all three core commercial SEO pages", async () => {
    const journal = await readFile(join(__dirname, "app/journal/page.tsx"), "utf8");

    expect(journal).toContain('href="/heritage-gift"');
    expect(journal).toContain('href="/family-legacy-gift"');
    expect(journal).toContain('href="/family-crest-generator"');
    expect(journal).toContain("personalized heritage gift guide");
    expect(journal).toContain("family legacy gift experience");
    expect(journal).toContain("symbolic family crest generator");
  });

  it("does not replace the existing Examples and Create conversion paths", async () => {
    const journal = await readFile(join(__dirname, "app/journal/page.tsx"), "utf8");

    expect(journal).toContain('href="/real-examples"');
    expect(journal).toContain('href="/create"');
    expect(journal).toContain('trackingSource="journal_landing_examples"');
    expect(journal).toContain('trackingSource="journal_landing_create"');
  });
});
