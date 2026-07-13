import type { Metadata } from "next";
import Link from "next/link";

import { FunnelStepTracker } from "../../components/funnel-tracker";
import { ShowcaseGallery } from "../../components/showcase-gallery";
import { StructuredData } from "../../components/structured-data";
import { showcaseCollections } from "../../lib/showcase-collections";
import { publicMetadata, SITE_URL } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Real Example Collections | MyKinLegacy",
  description:
    "Browse real example MyKinLegacy family legacy collections for fathers, mothers, grandparents, weddings, retirements, Christmas, and meaningful family gifts.",
  path: "/real-examples",
  image: showcaseCollections[0]?.crestSrc
});

export default function RealExamplesPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MyKinLegacy Real Example Collections",
    numberOfItems: showcaseCollections.length,
    itemListElement: showcaseCollections.map((collection, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/real-examples/${collection.id}`,
      name: collection.title,
      image: `${SITE_URL}${collection.crestSrc}`
    }))
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
      }
    ]
  };

  return (
    <main className="premium-page showcase-page">
      <StructuredData data={[itemListJsonLd, breadcrumbJsonLd]} />
      <FunnelStepTracker stepName="real_examples" metadata={{ page: "/real-examples" }} />
      <section className="premium-hero showcase-hero">
        <div className="section">
          <p className="eyebrow">Real Example Collections</p>
          <h1>See how a family legacy gift can feel personal.</h1>
          <p className="lead">
            Browse twenty example collections made from real gift occasions: parents,
            grandparents, weddings, retirements, Christmas, memorials, reunions, and new family
            chapters.
          </p>
          <div className="button-row">
            <Link className="button" href="/create">
              Create Their Collection
            </Link>
            <Link className="secondary-button" href="/family-legacy-collection">
              What You Receive
            </Link>
          </div>
        </div>
      </section>

      <section className="premium-section">
        <div className="section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Browse by recipient or occasion</p>
              <h2>Twenty gift-ready examples.</h2>
            </div>
            <p className="muted">
              Each card shows the occasion, final crest artwork, a short story preview, and a link
              to view the collection example.
            </p>
          </div>
          <ShowcaseGallery />
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section">
          <p className="eyebrow">Shop by family moment</p>
          <h2>Find examples and guidance for the occasion you are honoring.</h2>
          <div className="gift-related-links">
            <Link href="/gifts/father-retirement">Retirement gift for father</Link>
            <Link href="/gifts/fathers-day">Father&apos;s Day gift</Link>
            <Link href="/gifts/mother-birthday">Birthday gift for mother</Link>
            <Link href="/gifts/grandparents">Gifts for grandparents</Link>
            <Link href="/gifts/wedding">Wedding legacy gift</Link>
            <Link href="/gifts/anniversary">Anniversary keepsake</Link>
            <Link href="/gifts/christmas-family">Christmas family gift</Link>
            <Link href="/gifts/family-reunion">Family reunion gift</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
