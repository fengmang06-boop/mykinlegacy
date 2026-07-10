import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getShowcaseCollection, showcaseCollections } from "../../../lib/showcase-collections";
import { publicMetadata } from "../../../lib/seo";

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

  return publicMetadata({
    title: `${collection.title} Example Collection | MyKinLegacy`,
    description: `${collection.title}: a MyKinLegacy ${collection.occasion} example collection prepared for ${collection.recipient}.`,
    path: `/real-examples/${collection.id}`
  });
}

export default async function ShowcaseDetailPage({ params }: ShowcaseDetailPageProps) {
  const { id } = await params;
  const collection = getShowcaseCollection(id);

  if (!collection) {
    notFound();
  }

  return (
    <main className="premium-page showcase-page">
      <section className="premium-hero showcase-detail-hero">
        <div className="section showcase-detail-layout">
          <div>
            <Link className="showcase-back-link" href="/real-examples">
              Real Example Collections
            </Link>
            <p className="eyebrow">{collection.occasion}</p>
            <h1>{collection.title}</h1>
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
    </main>
  );
}
