import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "./app/sitemap";
import { giftLandingPages } from "./lib/gift-landing-pages";
import { journalArticles } from "./lib/journal-articles";
import { showcaseCollections } from "./lib/showcase-collections";
import { showcaseSeoDetails } from "./lib/showcase-seo";

describe("SEO foundation", () => {
  it("defines eight substantial and distinct gift landing pages", () => {
    expect(giftLandingPages).toHaveLength(8);
    expect(new Set(giftLandingPages.map((page) => page.slug)).size).toBe(8);
    expect(new Set(giftLandingPages.map((page) => page.title)).size).toBe(8);
    expect(new Set(giftLandingPages.map((page) => page.description)).size).toBe(8);

    for (const page of giftLandingPages) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(160);
      expect(page.lead.length).toBeGreaterThan(120);
      expect(page.buyerProblem.length).toBeGreaterThan(120);
      expect(page.personalization.length).toBeGreaterThanOrEqual(4);
      expect(page.exampleIds.length).toBeGreaterThanOrEqual(3);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.relatedSlugs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives all twenty examples unique metadata and valid related links", () => {
    const ids = new Set(showcaseCollections.map((collection) => collection.id));
    const giftPaths = new Set(giftLandingPages.map((page) => `/gifts/${page.slug}`));
    expect(Object.keys(showcaseSeoDetails).sort()).toEqual([...ids].sort());
    expect(new Set(Object.values(showcaseSeoDetails).map((item) => item.seoTitle)).size).toBe(20);
    expect(new Set(Object.values(showcaseSeoDetails).map((item) => item.seoDescription)).size).toBe(20);
    expect(new Set(Object.values(showcaseSeoDetails).map((item) => item.h1)).size).toBe(20);

    for (const detail of Object.values(showcaseSeoDetails)) {
      expect(detail.seoTitle.length).toBeLessThanOrEqual(60);
      expect(detail.seoDescription.length).toBeLessThanOrEqual(160);
      expect(detail.seoDescription.length).toBeGreaterThan(110);
      expect(detail.relatedIds).toHaveLength(3);
      expect(detail.relatedIds.every((id) => ids.has(id))).toBe(true);
      expect(giftPaths.has(detail.giftPath)).toBe(true);
    }
  });

  it("publishes all commercial pages while excluding private and review routes", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toHaveLength(51);
    expect(urls.filter((url) => url.includes("/gifts/"))).toHaveLength(8);
    expect(urls.filter((url) => url.includes("/real-examples/"))).toHaveLength(20);
    expect(urls.filter((url) => url.includes("/journal/"))).toHaveLength(9);
    expect(urls).toContain("https://mykinlegacy.com/journal");
    expect(urls).toEqual(
      expect.arrayContaining(
        journalArticles.map((article) => `https://mykinlegacy.com/journal/${article.slug}`)
      )
    );
    expect(urls.some((url) => url.includes("/create"))).toBe(false);
    expect(urls.some((url) => url.includes("/review"))).toBe(false);
  });

  it("keeps structured data truthful and free of ratings or official-claim markup", async () => {
    const sources = await Promise.all([
      readFile(join(__dirname, "app/family-legacy-collection/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/real-examples/[id]/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/journal/[slug]/page.tsx"), "utf8")
    ]);
    const combined = sources.join("\n");
    expect(combined).toContain('"@type": "Product"');
    expect(combined).toContain('"@type": "FAQPage"');
    expect(combined).toContain('"@type": "BreadcrumbList"');
    expect(combined).not.toMatch(/aggregateRating|reviewCount|ratingValue/);
    expect(combined).not.toMatch(/"@type":\s*"CoatOfArms"/);
  });
});
