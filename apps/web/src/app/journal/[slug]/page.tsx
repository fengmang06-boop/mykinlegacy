import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { StructuredData } from "../../../components/structured-data";
import {
  getJournalArticle,
  getJournalVisual,
  journalArticles,
  journalArticleWordCount,
  type JournalBlock,
  type JournalSegment
} from "../../../lib/journal-articles";
import { absoluteUrl, BRAND_NAME, publicMetadata, SITE_URL } from "../../../lib/seo";

type JournalArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return journalArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: JournalArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getJournalArticle(slug);
  if (!article) {
    return publicMetadata({
      title: "Journal | MyKinLegacy",
      description: "Family gift and keepsake guidance from MyKinLegacy.",
      path: "/journal"
    });
  }

  const visual = getJournalVisual(article.heroId);
  const base = publicMetadata({
    title: article.metaTitle,
    description: article.description,
    path: `/journal/${article.slug}`,
    image: visual.crestSrc
  });

  return {
    ...base,
    openGraph: {
      title: article.metaTitle,
      description: article.description,
      url: `${SITE_URL}/journal/${article.slug}`,
      siteName: BRAND_NAME,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
      images: [{ url: absoluteUrl(visual.crestSrc), alt: article.heroAlt }]
    }
  };
}

function RichText({ segments }: Readonly<{ segments: JournalSegment[] }>) {
  return segments.map((segment, index): ReactNode => {
    if (typeof segment === "string") {
      return segment;
    }
    if (segment.href.startsWith("/")) {
      return (
        <Link href={segment.href} key={`${segment.href}-${index}`}>
          {segment.text}
        </Link>
      );
    }
    return (
      <a
        href={segment.href}
        key={`${segment.href}-${index}`}
        rel="noreferrer"
        target="_blank"
      >
        {segment.text}
      </a>
    );
  });
}

function JournalBlocks({ blocks }: Readonly<{ blocks: JournalBlock[] }>) {
  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "paragraph") {
      return <p key={key}><RichText segments={block.segments} /></p>;
    }
    if (block.type === "subheading") {
      return <h3 key={key}>{block.text}</h3>;
    }
    if (block.type === "note" || block.type === "quote") {
      return (
        <blockquote className={`journal-${block.type}`} key={key}>
          <RichText segments={block.segments} />
        </blockquote>
      );
    }
    if (block.type === "bullets" || block.type === "numbered") {
      const List = block.type === "numbered" ? "ol" : "ul";
      return (
        <List key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}><RichText segments={item} /></li>
          ))}
        </List>
      );
    }
    return (
      <div className="journal-table-wrap" key={key}>
        <table>
          <thead>
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th key={`${key}-h-${headerIndex}`} scope="col">
                  <RichText segments={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${key}-r-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${key}-r-${rowIndex}-c-${cellIndex}`}>
                    <RichText segments={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });
}

export default async function JournalArticlePage({ params }: JournalArticlePageProps) {
  const { slug } = await params;
  const article = getJournalArticle(slug);
  if (!article) {
    notFound();
  }

  const hero = getJournalVisual(article.heroId);
  const pageUrl = `${SITE_URL}/journal/${article.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: [absoluteUrl(hero.crestSrc)],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: pageUrl,
    author: { "@type": "Organization", name: article.author, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/assets/final-homepage/01_brand/logo-mark.webp")
      }
    }
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/journal` },
      { "@type": "ListItem", position: 3, name: article.title, item: pageUrl }
    ]
  };

  return (
    <main className="premium-page journal-article-page">
      <StructuredData data={[articleJsonLd, breadcrumbJsonLd]} />
      <section className="premium-hero journal-article-hero">
        <div className="section journal-hero-grid">
          <div>
            <nav className="seo-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/journal">Journal</Link>
            </nav>
            <p className="eyebrow">MyKinLegacy Journal</p>
            <h1>{article.title}</h1>
            <p className="lead">{article.dek}</p>
            <div className="journal-byline">
              <span>By {article.author}</span>
              <span>Published {formatDate(article.publishedAt)}</span>
              <span>Updated {formatDate(article.updatedAt)}</span>
              <span>{journalArticleWordCount(article)} words</span>
            </div>
          </div>
          <figure className="journal-hero-image">
            <Image
              src={hero.crestSrc}
              alt={article.heroAlt}
              width={900}
              height={900}
              priority
              sizes="(max-width: 900px) 92vw, 42vw"
            />
            <figcaption>{hero.title} example · Final Crest Artwork</figcaption>
          </figure>
        </div>
      </section>

      <section className="premium-section journal-reading-section">
        <article className="section journal-reading-layout">
          <aside className="journal-toc" aria-label="On this page">
            <p className="eyebrow">On this page</p>
            <ol>
              {article.sections.map((section) => (
                <li key={section.id}><a href={`#${section.id}`}>{section.heading}</a></li>
              ))}
            </ol>
          </aside>

          <div className="journal-prose">
            {article.intro ? (
              <div className="journal-introduction">
                <JournalBlocks blocks={article.intro} />
              </div>
            ) : null}
            {article.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-p-${index}`}><RichText segments={paragraph} /></p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((item, index) => (
                      <li key={`${section.id}-li-${index}`}><RichText segments={item} /></li>
                    ))}
                  </ul>
                ) : null}
                {section.blocks ? <JournalBlocks blocks={section.blocks} /> : null}
                {section.visualId ? (
                  <ArticleVisual
                    id={section.visualId}
                    alt={section.visualAlt ?? "MyKinLegacy example collection artwork"}
                    caption={section.visualCaption ?? "MyKinLegacy example collection"}
                  />
                ) : null}
              </section>
            ))}

            {article.faqs.length > 0 ? (
              <section className="journal-faq" id="questions">
                <p className="eyebrow">Buyer questions</p>
                <h2>Frequently asked questions</h2>
                {article.faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3>{faq.question}</h3>
                    <p><RichText segments={faq.answer} /></p>
                  </div>
                ))}
              </section>
            ) : null}

            {article.sources.length > 0 ? (
              <section className="journal-sources" id="sources">
                <p className="eyebrow">Sources</p>
                <h2>References used for factual guidance</h2>
                <ul>
                  {article.sources.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} rel="noreferrer" target="_blank">
                        {source.name}
                      </a>{" "}
                      <span>— {source.organization}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </article>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section journal-commercial-cta">
          <p className="eyebrow">A gift shaped by real family evidence</p>
          <h2>{article.commercialLabel}</h2>
          <p>
            MyKinLegacy creates personalized symbolic keepsakes, not official coats of arms,
            certified genealogy, or claims of noble or ancestral status.
          </p>
          <div className="button-row">
            <Link className="button" href={article.commercialPath}>{article.commercialLabel}</Link>
            <Link className="secondary-button" href="/real-examples">View Real Examples</Link>
          </div>
        </div>
      </section>

      <section className="premium-section">
        <div className="section journal-related">
          <p className="eyebrow">Continue reading</p>
          <h2>Related guides</h2>
          <div>
            {article.relatedSlugs.map((relatedSlug) => {
              const related = getJournalArticle(relatedSlug);
              return related ? (
                <Link href={`/journal/${related.slug}`} key={related.slug}>
                  <span>{related.title}</span>
                  <small>{related.dek}</small>
                </Link>
              ) : null;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function ArticleVisual({ id, alt, caption }: Readonly<{ id: string; alt: string; caption: string }>) {
  const visual = getJournalVisual(id);
  return (
    <figure className="journal-inline-visual">
      <Image
        src={visual.crestSrc}
        alt={alt}
        width={760}
        height={760}
        sizes="(max-width: 760px) 92vw, 700px"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}
