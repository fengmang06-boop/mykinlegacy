import { describe, expect, it } from "vitest";

import {
  getJournalVisual,
  journalArticles,
  journalArticleText,
  journalArticleWordCount,
  type JournalBlock,
  type JournalSegment
} from "./lib/journal-articles";

function linksFrom(segments: JournalSegment[]): string[] {
  return segments
    .filter((segment): segment is { text: string; href: string } => typeof segment !== "string")
    .map((segment) => segment.href);
}

function linksFromBlock(block: JournalBlock): string[] {
  if (block.type === "subheading") {
    return [];
  }
  if (block.type === "paragraph" || block.type === "note" || block.type === "quote") {
    return linksFrom(block.segments);
  }
  if (block.type === "bullets" || block.type === "numbered") {
    return block.items.flatMap(linksFrom);
  }
  return [
    ...block.headers.flatMap(linksFrom),
    ...block.rows.flatMap((row) => row.flatMap(linksFrom))
  ];
}

describe("SEO journal content", () => {
  it("publishes exactly nine substantial, uniquely targeted articles", () => {
    expect(journalArticles).toHaveLength(9);
    expect(new Set(journalArticles.map((article) => article.slug)).size).toBe(9);
    expect(new Set(journalArticles.map((article) => article.targetKeyword)).size).toBe(9);
    expect(new Set(journalArticles.map((article) => article.title)).size).toBe(9);
    expect(new Set(journalArticles.map((article) => article.metaTitle)).size).toBe(9);
    expect(new Set(journalArticles.map((article) => article.description)).size).toBe(9);

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
        ...(section.bullets ?? []).flatMap(linksFrom),
        ...(section.blocks ?? []).flatMap(linksFromBlock)
      ]);
      bodyLinks.push(...(article.intro ?? []).flatMap(linksFromBlock));
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
      "www.loc.gov",
      "time.com",
      "www.timeanddate.com"
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
        for (const block of section.blocks ?? []) {
          if (block.type === "paragraph" || block.type === "note" || block.type === "quote") {
            const normalized = journalBlockText(block).replace(/\s+/g, " ").trim().toLowerCase();
            if (normalized.length >= 100) {
              longParagraphs.push(normalized);
            }
          }
        }
      }
      for (const block of article.intro ?? []) {
        if (block.type === "paragraph" || block.type === "note" || block.type === "quote") {
          const normalized = journalBlockText(block).replace(/\s+/g, " ").trim().toLowerCase();
          if (normalized.length >= 100) {
            longParagraphs.push(normalized);
          }
        }
      }
    }
    expect(new Set(longParagraphs).size).toBe(longParagraphs.length);
  });

  it("locks the CSO-approved Content Batch 02 titles, boundaries, and delivery note", () => {
    const reunion = journalArticles.find((article) => article.slug === "family-reunion-gift-ideas");
    const crest = journalArticles.find(
      (article) => article.slug === "how-to-create-a-modern-family-crest"
    );
    const wedding = journalArticles.find(
      (article) => article.slug === "personalized-wedding-gifts-for-couples"
    );

    expect(reunion?.description).toBe(
      "Explore family reunion gift ideas that preserve shared memories, places, values, and stories—not only the event date or a standard event favor."
    );
    expect(crest?.title).toBe(
      "How to Create a Modern Family Crest Based on Your Real Family Story"
    );
    expect(crest?.dek).toBe(
      "A modern family crest created for personal use is a symbolic artwork, not proof of ancestry, nobility, legal heraldic ownership, or an officially registered coat of arms."
    );
    expect(crest?.sources).toHaveLength(1);
    expect(crest?.sources[0]?.organization).toBe("College of Arms");
    expect(wedding?.title).toBe(
      "Personalized Wedding Gifts for Couples Beginning a Shared Legacy"
    );
    expect(
      wedding?.intro?.some(
        (block) => block.type === "note" && journalBlockText(block).includes("delivered digitally")
      )
    ).toBe(true);
    expect(journalArticleText(wedding!)).toContain(
      "It should not claim inherited arms, genealogy, or official status.[2]"
    );
  });
});

function journalBlockText(block: JournalBlock): string {
  const segmentText = (segments: JournalSegment[]) =>
    segments.map((segment) => (typeof segment === "string" ? segment : segment.text)).join(" ");
  if (block.type === "subheading") {
    return block.text;
  }
  if (block.type === "paragraph" || block.type === "note" || block.type === "quote") {
    return segmentText(block.segments);
  }
  if (block.type === "bullets" || block.type === "numbered") {
    return block.items.map(segmentText).join(" ");
  }
  return [...block.headers, ...block.rows.flat()].map(segmentText).join(" ");
}
