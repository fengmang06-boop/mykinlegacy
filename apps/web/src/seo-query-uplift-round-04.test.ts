import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "./app/sitemap";
import { journalArticles } from "./lib/journal-articles";

describe("SEO existing-query uplift round 04", () => {
  it("keeps sitemap modification dates stable and evidence based", () => {
    const first = sitemap();
    const second = sitemap();

    expect(first).toEqual(second);
    expect(first).toHaveLength(51);

    const homepage = first.find((entry) => entry.url === "https://mykinlegacy.com");
    expect(homepage?.lastModified).toBeUndefined();

    for (const article of journalArticles) {
      const entry = first.find(
        (item) => item.url === `https://mykinlegacy.com/journal/${article.slug}`
      );
      expect(entry?.lastModified).toBe(article.updatedAt);
    }
  });

  it("presents all five deliverables and keeps Private Vault as delivery method", async () => {
    const source = await readFile(join(__dirname, "components/seo-landing-page.tsx"), "utf8");

    for (const deliverable of [
      "Final Crest",
      "Heritage Certificate",
      "Family Story",
      "Meaning Behind Your Crest",
      "Complete Collection"
    ]) {
      expect(source).toContain(`<strong>${deliverable}</strong>`);
    }

    expect(source).toContain("Private Vault digital delivery");
    expect(source).not.toContain("<strong>Private Vault</strong>");
  });
});
