import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("SEO structured-data eligibility round 05", () => {
  it("removes ineligible FAQPage markup while keeping visible FAQ content", async () => {
    const [homepage, giftPage, seoLanding] = await Promise.all([
      readFile(join(__dirname, "app/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "components/seo-landing-page.tsx"), "utf8")
    ]);

    const combined = [homepage, giftPage, seoLanding].join("\n");
    expect(combined).not.toContain('"@type": "FAQPage"');
    expect(homepage).toContain("faq.map");
    expect(giftPage).toContain("page.faq.map");
    expect(seoLanding).toContain("faq.map");
  });

  it("retains eligible page-purpose schema types", async () => {
    const [layout, collection, giftPage, articlePage, examplesPage] = await Promise.all([
      readFile(join(__dirname, "app/layout.tsx"), "utf8"),
      readFile(join(__dirname, "app/family-legacy-collection/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/journal/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/real-examples/page.tsx"), "utf8")
    ]);

    expect(layout).toContain('"@type": "Organization"');
    expect(layout).toContain('"@type": "WebSite"');
    expect(collection).toContain('"@type": "Product"');
    expect(collection).toContain('"@type": "WebPage"');
    expect(giftPage).toContain('"@type": "BreadcrumbList"');
    expect(giftPage).toContain('"@type": "ItemList"');
    expect(articlePage).toContain('"@type": "Article"');
    expect(articlePage).toContain('"@type": "BreadcrumbList"');
    expect(examplesPage).toContain('"@type": "BreadcrumbList"');
  });
});
