import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StructuredData } from "../../../components/structured-data";
import { getShowcaseCollection, showcaseCollections } from "../../../lib/showcase-collections";
import { getShowcaseSeoDetail } from "../../../lib/showcase-seo";
import { publicMetadata, SITE_URL } from "../../../lib/seo";

type ShowcaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return showcaseCollections.map((collection) => ({ id: collection.id }));
}

export async function generateMetadata({
  params
}: ShowcaseDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = getShowcaseCollection(id);

  if (!collection) {
    return publicMetadata({
      title: "Example Collection | MyKinLegacy",
      description: "View a MyKinLegacy real example collection.",
      path: "/real-examples"
    });
  }

  const seo = getShowcaseSeoDetail(collection.id);

  return publicMetadata({
    title: seo.seoTitle,
    description: seo.seoDescription,
    path: `/real-examples/${collection.id}`,
    image: collection.crestSrc
  });
}

export default async function ShowcaseDetailPage({ params }: ShowcaseDetailPageProps) {
  const { id } = await params;
  const collection = getShowcaseCollection(id);

  if (!collection) {
    notFound();
  }

  const seo = getShowcaseSeoDetail(collection.id);
  const relatedCollections = seo.relatedIds
    .map((relatedId) => getShowcaseCollection(relatedId))
    .filter((relatedCollection) => Boolean(relatedCollection));
  const pageUrl = `${SITE_URL}/real-examples/${collection.id}`;
  const visualArtworkJsonLd = {
    "@context": "https://schema.org",
    "@type": ["CreativeWork", "VisualArtwork"],
    name: collection.title,
    description: seo.seoDescription,
    url: pageUrl,
    image: `${SITE_URL}${collection.crestSrc}`,
    creator: { "@type": "Organization", name: "MyKinLegacy", url: SITE_URL },
    about: [collection.occasion, collection.recipient, ...collection.tags],
    isPartOf: {
      "@type": "CollectionPage",
      name: "MyKinLegacy Real Example Collections",
      url: `${SITE_URL}/real-examples`
    }
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Real Example Collections",
        item: `${SITE_URL}/real-examples`
      },
      { "@type": "ListItem", position: 3, name: collection.title, item: pageUrl }
    ]
  };

  return (
    <main className="premium-page showcase-page">
      <StructuredData data={[visualArtworkJsonLd, breadcrumbJsonLd]} />
      <section className="premium-hero showcase-detail-hero">
        <div className="section showcase-detail-layout">
          <div>
            <nav className="seo-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/real-examples">Real Examples</Link>
            </nav>
            <p className="eyebrow">{collection.occasion}</p>
            <h1>{seo.h1}</h1>
            <p className="lead">{collection.storyPreview}</p>
            <div className="showcase-tag-row">
              {collection.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="button-row">
              <Link className="button" href="/create">
                Create Their Collection
              </Link>
              <Link className="secondary-button" href="/real-examples">
                Browse More Examples
              </Link>
            </div>
          </div>
          <figure className="showcase-detail-crest">
            <Image
              src={collection.crestSrc}
              alt={`${collection.title} final crest artwork`}
              width={900}
              height={900}
              priority
            />
            <figcaption>Final Crest Artwork</figcaption>
          </figure>
        </div>
      </section>

      <section className="premium-section">
        <div className="section showcase-detail-panels">
          <article className="showcase-detail-panel">
            <p className="eyebrow">Certificate preview</p>
            <h2>Prepared for {collection.recipient}</h2>
            <p>
              A private family legacy collection created for {collection.occasion.toLowerCase()}:
              ceremonial, personal, and made for keeping.
            </p>
          </article>
          <article className="showcase-detail-panel">
            <p className="eyebrow">Story preview</p>
            <h2>Why this family moment matters</h2>
            <p>{collection.storyPreview}</p>
          </article>
          <article className="showcase-detail-panel">
            <p className="eyebrow">Meaning preview</p>
            <h2>Why this crest was created</h2>
            <p>{collection.meaningPreview}</p>
          </article>
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section showcase-evidence-grid">
          <article>
            <p className="eyebrow">Why a buyer chooses this</p>
            <h2>A gift shaped around a real family need.</h2>
            <p>{seo.buyerNeed}</p>
            <p>{seo.recipientDetail}</p>
          </article>
          <article>
            <p className="eyebrow">Personalization evidence</p>
            <h2>What makes this collection distinct</h2>
            <ul>
              {seo.personalizationFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              This example is a symbolic keepsake, not an official coat of arms, legal heraldic
              grant, noble title claim, or certified genealogical record.
            </p>
          </article>
        </div>
      </section>

      <section className="premium-section">
        <div className="section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Related collections</p>
              <h2>Compare how different evidence changes the design.</h2>
            </div>
            <Link className="showcase-card-link" href={seo.giftPath}>
              Explore {seo.giftLabel}
            </Link>
          </div>
          <div className="related-showcase-grid">
            {relatedCollections.map((relatedCollection) =>
              relatedCollection ? (
                <article key={relatedCollection.id}>
                  <Link href={`/real-examples/${relatedCollection.id}`}>
                    <Image
                      src={relatedCollection.crestSrc}
                      alt={`${relatedCollection.title} final crest artwork example`}
                      width={640}
                      height={640}
                      sizes="(max-width: 700px) 92vw, 30vw"
                    />
                  </Link>
                  <div>
                    <p className="eyebrow">{relatedCollection.occasion}</p>
                    <h3>{relatedCollection.title}</h3>
                    <Link href={`/real-examples/${relatedCollection.id}`}>View Collection</Link>
                  </div>
                </article>
              ) : null
            )}
          </div>
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section showcase-final-cta">
          <p className="eyebrow">Create a collection grounded in your own evidence</p>
          <h2>Your recipient, occasion, memories, and values should change the result.</h2>
          <p>
            Begin the guided interview, or review what is included in the Family Legacy
            Collection before checkout.
          </p>
          <div className="button-row">
            <Link className="button" href="/create">Create Their Collection</Link>
            <Link className="secondary-button" href="/family-legacy-collection">What You Receive</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
