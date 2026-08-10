import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getGiftLandingPage } from "./lib/gift-landing-pages";
import { getJournalArticle, journalArticleText } from "./lib/journal-articles";

describe("SEO existing-query uplift round 02", () => {
  it("gives the legacy gift guide ownership of the observed ideas query", () => {
    const article = getJournalArticle("family-legacy-gift-ideas");

    expect(article?.targetKeyword).toBe("legacy gift ideas");
    expect(article?.metaTitle).toContain("Legacy Gift Ideas");
    expect(article?.updatedAt).toBe("2026-08-11");
    expect(article?.commercialPath).toBe("/family-legacy-gift");
    expect(
      article?.sections.some((section) => section.heading.includes("11 legacy gift ideas"))
    ).toBe(true);
    expect(journalArticleText(article!)).toContain(
      "The best legacy gift ideas preserve something only this family can recognize."
    );
  });

  it("answers modern family crest ideas without creating a competing URL", () => {
    const article = getJournalArticle("how-to-create-a-modern-family-crest");
    const ideas = article?.sections.find(
      (section) => section.id === "modern-family-crest-ideas-by-leading-meaning"
    );
    const bullets = ideas?.blocks?.find((block) => block.type === "bullets");

    expect(article?.targetKeyword).toBe("modern family crest ideas");
    expect(article?.metaTitle).toBe("Modern Family Crest Ideas: An Evidence-Led Guide");
    expect(article?.updatedAt).toBe("2026-08-11");
    expect(ideas?.heading).toContain("modern family crest ideas");
    expect(bullets?.type === "bullets" ? bullets.items : []).toHaveLength(6);
    expect(article?.commercialPath).toBe("/symbolic-family-crest");
  });

  it("connects the family reunion product page to its informational guide", () => {
    const gift = getGiftLandingPage("family-reunion");
    const guide = getJournalArticle("family-reunion-gift-ideas");

    expect(gift?.primaryKeyword).toBe("personalized family reunion gifts");
    expect(gift?.title).toContain("Personalized Family Reunion Gifts");
    expect(gift?.guidePath).toBe("/journal/family-reunion-gift-ideas");
    expect(gift?.deliveryNote).toContain("Nothing is physically shipped");
    expect(gift?.faq.some((item) => item.question.includes("physical product"))).toBe(true);
    expect(guide?.commercialPath).toBe("/gifts/family-reunion");
  });

  it.each([
    [
      "father retirement",
      "father-retirement",
      "retirement-gift-for-father",
      "personalized retirement gift for father",
      "retirement gift ideas for father"
    ],
    [
      "parents anniversary",
      "anniversary",
      "personalized-anniversary-gifts-for-parents",
      "personalized anniversary gift for parents",
      "anniversary gift ideas for parents"
    ]
  ])(
    "separates transactional and informational ownership for %s",
    (_name, giftSlug, articleSlug, giftKeyword, articleKeyword) => {
      const gift = getGiftLandingPage(giftSlug);
      const article = getJournalArticle(articleSlug);

      expect(gift?.primaryKeyword).toBe(giftKeyword);
      expect(article?.targetKeyword).toBe(articleKeyword);
      expect(gift?.primaryKeyword).not.toBe(article?.targetKeyword);
      expect(gift?.guidePath).toBe(`/journal/${articleSlug}`);
      expect(article?.commercialPath).toBe(`/gifts/${giftSlug}`);
    }
  );

  it("keeps Complete Collection as the deliverable and Private Vault as delivery", async () => {
    const source = await readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8");

    expect(source).toContain('["Complete Collection", "All finished files');
    expect(source).not.toContain('["Private Vault",');
    expect(source).toContain("through the Private Vault");
  });
});
