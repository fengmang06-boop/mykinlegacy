import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ga4EventFor } from "./lib/analytics";
import { getGiftLandingPage } from "./lib/gift-landing-pages";
import { getJournalArticle, journalArticles, journalArticleText } from "./lib/journal-articles";

describe("SEO existing-query uplift round 03", () => {
  it("adds observed Christmas queries without changing the approved title or H1", () => {
    const christmas = getGiftLandingPage("christmas-family");

    expect(christmas?.title).toBe(
      "Personalized Christmas Gift for the Whole Family | MyKinLegacy"
    );
    expect(christmas?.h1).toBe("A Christmas Gift the Whole Family Can Open and Keep Together");
    expect(christmas?.primaryKeyword).toBe("personalized Christmas gifts for family");
    expect(christmas?.faq.some((item) => item.question.includes("whole family"))).toBe(true);
    expect(christmas?.faq.some((item) => item.question.includes("family name"))).toBe(true);
    expect(journalArticles.some((article) => article.slug.includes("christmas"))).toBe(false);
  });

  it("strengthens contextual links to Christmas without creating a duplicate article", () => {
    const legacyIdeas = getJournalArticle("family-legacy-gift-ideas");
    const grandparentIdeas = getJournalArticle("personalized-gifts-for-grandparents");

    expect(JSON.stringify(legacyIdeas)).toContain('"href":"/gifts/christmas-family"');
    expect(JSON.stringify(grandparentIdeas)).toContain('"href":"/gifts/christmas-family"');
    expect(journalArticleText(legacyIdeas!)).toContain(
      "personalized Christmas gift for the whole family"
    );
  });

  it("closes the grandparents guide-to-product loop", () => {
    const gift = getGiftLandingPage("grandparents");
    const guide = getJournalArticle("personalized-gifts-for-grandparents");

    expect(gift?.guidePath).toBe("/journal/personalized-gifts-for-grandparents");
    expect(guide?.commercialPath).toBe("/gifts/grandparents");
  });

  it("maps privacy-safe journal views and internal CTA destinations to GA4", () => {
    expect(
      ga4EventFor("funnel_step_viewed", { step_name: "journal_landing" })
    ).toEqual({ name: "journal_view", params: {} });
    expect(
      ga4EventFor("funnel_step_viewed", {
        step_name: "journal_article",
        article_slug: "family-legacy-gift-ideas"
      })
    ).toEqual({
      name: "journal_article_view",
      params: { article_slug: "family-legacy-gift-ideas" }
    });
    expect(
      ga4EventFor("landing_cta_clicked", {
        source: "journal_article_commercial",
        destination: "/family-legacy-gift"
      })
    ).toEqual({
      name: "landing_cta_clicked",
      params: {
        source: "journal_article_commercial",
        destination: "/family-legacy-gift"
      }
    });
    expect(
      ga4EventFor("landing_cta_clicked", {
        source: "journal_article_commercial",
        destination: "https://untrusted.example/path"
      })
    ).toEqual({
      name: "landing_cta_clicked",
      params: { source: "journal_article_commercial" }
    });
  });

  it("uses tracked CTA links on organic landing surfaces", async () => {
    const [giftPage, journalPage, articlePage, seoLanding] = await Promise.all([
      readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/journal/page.tsx"), "utf8"),
      readFile(join(__dirname, "app/journal/[slug]/page.tsx"), "utf8"),
      readFile(join(__dirname, "components/seo-landing-page.tsx"), "utf8")
    ]);

    expect(giftPage.match(/<TrackedCtaLink/g)).toHaveLength(2);
    expect(giftPage).toContain("gift_${page.slug}_hero_create");
    expect(giftPage).toContain("gift_${page.slug}_final_create");
    expect(journalPage).toContain('stepName="journal_landing"');
    expect(articlePage).toContain('stepName="journal_article"');
    expect(articlePage).toContain('trackingSource="journal_article_commercial"');
    expect(seoLanding.match(/<TrackedCtaLink/g)).toHaveLength(2);
  });
});
