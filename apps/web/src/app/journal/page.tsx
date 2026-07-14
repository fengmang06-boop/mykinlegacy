import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { StructuredData } from "../../components/structured-data";
import {
  getJournalVisual,
  journalArticles,
  journalArticleWordCount
} from "../../lib/journal-articles";
import { publicMetadata, SITE_URL } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Keepsake and Gift Guides | MyKinLegacy Journal",
  description:
    "Practical guides to family keepsakes, symbolic crest artwork, retirement gifts, grandparent gifts, and preserving family memories with care.",
  path: "/journal",
  image: getJournalVisual(journalArticles[0]!.heroId).crestSrc
});

export default function JournalPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MyKinLegacy Journal",
    numberOfItems: journalArticles.length,
    itemListElement: journalArticles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: article.title,
      url: `${SITE_URL}/journal/${article.slug}`
    }))
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/journal` }
    ]
  };

  return (
    <main className="premium-page journal-page">
      <StructuredData data={[itemListJsonLd, breadcrumbJsonLd]} />
      <section className="premium-hero journal-hero">
        <div className="section">
          <nav className="seo-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Journal</span>
          </nav>
          <p className="eyebrow">MyKinLegacy Journal</p>
          <h1>Thoughtful guidance for gifts families will keep.</h1>
          <p className="lead">
            Practical, evidence-led guides for choosing a personal gift, gathering family
            memories, understanding symbolic crest artwork, and preserving what matters.
          </p>
        </div>
      </section>

      <section className="premium-section">
        <div className="section journal-grid">
          {journalArticles.map((article) => {
            const visual = getJournalVisual(article.heroId);
            return (
              <article className="journal-card" key={article.slug}>
                <Link className="journal-card-image" href={`/journal/${article.slug}`}>
                  <Image
                    src={visual.crestSrc}
                    alt={article.heroAlt}
                    width={720}
                    height={720}
                    sizes="(max-width: 760px) 92vw, (max-width: 1100px) 46vw, 31vw"
                  />
                </Link>
                <div className="journal-card-body">
                  <p className="eyebrow">Guide · {journalArticleWordCount(article)} words</p>
                  <h2>
                    <Link href={`/journal/${article.slug}`}>{article.title}</Link>
                  </h2>
                  <p>{article.dek}</p>
                  <Link className="journal-read-link" href={`/journal/${article.slug}`}>
                    Read the guide
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section journal-footer-cta">
          <p className="eyebrow">See the finished experience</p>
          <h2>Compare the guidance with real example collections.</h2>
          <p>
            Browse twenty public examples for parents, grandparents, weddings, retirements,
            anniversaries, Christmas, reunions, and other family moments.
          </p>
          <div className="button-row">
            <Link className="button" href="/real-examples">View Real Examples</Link>
            <Link className="secondary-button" href="/create">Create Their Collection</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
