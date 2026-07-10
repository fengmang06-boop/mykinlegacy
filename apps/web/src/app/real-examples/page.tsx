import type { Metadata } from "next";
import Link from "next/link";

import { ShowcaseGallery } from "../../components/showcase-gallery";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Real Example Collections | MyKinLegacy",
  description:
    "Browse real example MyKinLegacy family legacy collections for fathers, mothers, grandparents, weddings, retirements, Christmas, and meaningful family gifts.",
  path: "/real-examples"
});

export default function RealExamplesPage() {
  return (
    <main className="premium-page showcase-page">
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
    </main>
  );
}
