import { describe, expect, it } from "vitest";

import {
  getJournalVisual,
  journalArticles,
  journalArticleText,
  journalArticleWordCount,
  type JournalSegment
} from "./lib/journal-articles";

function linksFrom(segments: JournalSegment[]): string[] {
  return segments
    .filter((segment): segment is { text: string; href: string } => typeof segment !== "string")
    .map((segment) => segment.href);
}

describe("SEO Content Batch 01", () => {
  it("publishes exactly five substantial, uniquely targeted articles", () => {
    expect(journalArticles).toHaveLength(5);
    expect(new Set(journalArticles.map((article) => article.slug)).size).toBe(5);
    expect(new Set(journalArticles.map((article) => article.targetKeyword)).size).toBe(5);
    expect(new Set(journalArticles.map((article) => article.title)).size).toBe(5);
    expect(new Set(journalArticles.map((article) => article.metaTitle)).size).toBe(5);
    expect(new Set(journalArticles.map((article) => article.description)).size).toBe(5);

    for (const article of journalArticles) {
      expect(article.metaTitle.length).toBeLessThanOrEqual(60);
      expect(article.description.length).toBeLessThanOrEqual(160);
      expect(article.description.length).toBeGreaterThanOrEqual(120);
      expect(journalArticleWordCount(article)).toBeGreaterThanOrEqual(650);
      expect(article.sections.length).toBeGreaterThanOrEqual(6);
      expect(article.faqs.length).toBeGreaterThanOrEqual(3);
      expect(article.relatedSlugs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses approved showcase visuals with descriptive alt text", () => {
    for (const article of journalArticles) {
      expect(getJournalVisual(article.heroId).crestSrc).toMatch(
        /^\/assets\/showcase-collections\//
      );
      expect(article.heroAlt.length).toBeGreaterThan(35);
      for (const section of article.sections.filter((item) => item.visualId)) {
        expect(getJournalVisual(section.visualId!).crestSrc).toMatch(
          /^\/assets\/showcase-collections\//
        );
        expect(section.visualAlt?.length ?? 0).toBeGreaterThan(35);
        expect(section.visualCaption?.length ?? 0).toBeGreaterThan(35);
      }
    }
  });

  it("gives every article commercial and editorial internal links without orphaning", () => {
    const validSlugs = new Set(journalArticles.map((article) => article.slug));
    for (const article of journalArticles) {
      const bodyLinks = article.sections.flatMap((section) => [
        ...section.paragraphs.flatMap(linksFrom),
        ...(section.bullets ?? []).flatMap(linksFrom)
      ]);
      expect(article.commercialPath.startsWith("/")).toBe(true);
      expect(bodyLinks.some((href) => href.startsWith("/journal/"))).toBe(true);
      expect(bodyLinks.some((href) => href.startsWith("/real-examples"))).toBe(true);
      expect(article.relatedSlugs.every((slug) => validSlugs.has(slug))).toBe(true);
      expect(article.relatedSlugs).not.toContain(article.slug);
    }
  });

  it("uses primary official sources for factual history and preservation claims", () => {
    const allowedSourceHosts = new Set([
      "www.archives.gov",
      "www.college-of-arms.gov.uk",
      "www.loc.gov"
    ]);
    for (const article of journalArticles) {
      for (const source of article.sources) {
        expect(allowedSourceHosts.has(new URL(source.href).hostname)).toBe(true);
      }
    }
    expect(journalArticles.find((article) => article.slug === "what-is-a-family-crest")?.sources)
      .not.toHaveLength(0);
    expect(journalArticles.find((article) => article.slug === "how-to-create-a-family-keepsake")?.sources)
      .not.toHaveLength(0);
  });

  it("contains no prohibited claims, internal language, or exact duplicate long paragraphs", () => {
    const prohibited = [
      /AI-generated/i,
      /ancient bloodline/i,
      /noble lineage/i,
      /royal blood/i,
      /official family crest/i,
      /certifies? (?:your )?ancestry/i,
      /guaranteed to last/i,
      /customer input/i,
      /maps to/i
    ];
    const longParagraphs: string[] = [];

    for (const article of journalArticles) {
      const text = journalArticleText(article);
      for (const pattern of prohibited) {
        expect(text).not.toMatch(pattern);
      }
      for (const section of article.sections) {
        for (const paragraph of section.paragraphs) {
          const normalized = paragraph
            .map((segment) => (typeof segment === "string" ? segment : segment.text))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (normalized.length >= 100) {
            longParagraphs.push(normalized);
          }
        }
      }
    }
    expect(new Set(longParagraphs).size).toBe(longParagraphs.length);
  });
});
