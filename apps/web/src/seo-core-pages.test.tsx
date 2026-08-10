import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FamilyLegacyGiftPage, {
  metadata as familyLegacyGiftMetadata
} from "./app/family-legacy-gift/page";
import HeritageGiftPage, { metadata as heritageGiftMetadata } from "./app/heritage-gift/page";
import SymbolicFamilyCrestPage, {
  metadata as symbolicFamilyCrestMetadata
} from "./app/symbolic-family-crest/page";

const testDir = dirname(fileURLToPath(import.meta.url));

function visibleWords(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("SEO core landing pages", () => {
  it.each([
    [
      "heritage gift",
      <HeritageGiftPage />,
      heritageGiftMetadata,
      "Personalized Family Keepsake & Heritage Gift | MyKinLegacy",
      ["/journal/how-to-create-a-family-keepsake", "/gifts/grandparents", "/gifts/family-reunion"]
    ],
    [
      "family legacy gift",
      <FamilyLegacyGiftPage />,
      familyLegacyGiftMetadata,
      "Family Legacy Gift for Meaningful Moments | MyKinLegacy",
      ["/journal/family-legacy-gift-ideas", "/gifts/father-retirement", "/gifts/anniversary"]
    ],
    [
      "symbolic family crest",
      <SymbolicFamilyCrestPage />,
      symbolicFamilyCrestMetadata,
      "Symbolic Family Crest Meaning & Design | MyKinLegacy",
      [
        "/journal/what-is-a-family-crest",
        "/journal/how-to-create-a-modern-family-crest",
        "/real-examples"
      ]
    ]
  ])(
    "gives the %s page unique depth, intent, and internal links",
    (_name, page, metadata, title, links) => {
      const html = renderToStaticMarkup(page);

      expect(metadata.title).toBe(title);
      expect(String(metadata.title).length).toBeLessThanOrEqual(60);
      expect(String(metadata.description).length).toBeGreaterThanOrEqual(120);
      expect(String(metadata.description).length).toBeLessThanOrEqual(160);
      expect(visibleWords(html)).toBeGreaterThanOrEqual(500);
      expect(html.match(/<h1/g) ?? []).toHaveLength(1);
      expect(html).toContain("Heritage Certificate");
      expect(html).toContain("Complete Collection");
      expect(html).toContain("digital");
      expect(html).toContain("official");
      for (const href of links) {
        expect(html).toContain('href="' + href + '"');
      }
    }
  );

  it("uses the approved Heritage Certificate term on every gift landing page", async () => {
    const [giftPageSource, giftSpecsSource] = await Promise.all([
      readFile(join(testDir, "app/gifts/[slug]/page.tsx"), "utf8"),
      readFile(join(testDir, "lib/gift-landing-pages.ts"), "utf8")
    ]);

    expect(giftPageSource).not.toContain("Family Legacy Certificate");
    expect(giftSpecsSource).not.toContain("Family Legacy Certificate");
    expect(giftPageSource).toContain('"Heritage Certificate"');
  });
});
