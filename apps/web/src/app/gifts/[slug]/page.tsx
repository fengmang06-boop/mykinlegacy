import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FunnelStepTracker } from "../../../components/funnel-tracker";
import { notFound } from "next/navigation";

import { StructuredData } from "../../../components/structured-data";
import {
  getGiftLandingPage,
  giftLandingPages,
  type GiftLandingPageSpec
} from "../../../lib/gift-landing-pages";
import { getShowcaseCollection } from "../../../lib/showcase-collections";
import { publicMetadata, SITE_URL } from "../../../lib/seo";

type GiftLandingPageProps = {
  params: Promise<{ slug: string }>;
};

const collectionContents = [
  [
    "Family Legacy Certificate",
    "The primary frameable keepsake, personalized for the recipient and occasion."
  ],
  ["Final Crest", "One finished symbolic artwork shaped around the family evidence you share."],
  ["Family Story", "A recipient-centered narrative grounded in real memories and lived values."],
  ["Meaning Behind Your Crest", "A visual guide explaining why each earned symbol belongs."],
  ["Private Vault", "Secure digital access to the finished Complete Collection archive."]
] as const;

const christmasCollectionContents = [
  ["Final Crest", "One finished symbolic artwork shaped by the family evidence you share."],
  ["Heritage Certificate", "The keepsake document that introduces the collection and occasion."],
  ["Family Story", "A recipient-centered narrative grounded in real memories and lived values."],
  [
    "Meaning Behind Your Crest",
    "The guide explaining the design basis and why each symbol belongs."
  ],
  [
    "Complete Collection",
    "All finished customer files, privately delivered through the Private Vault."
  ]
] as const;

export function generateStaticParams() {
  return giftLandingPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: GiftLandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getGiftLandingPage(slug);
  if (!page) {
    return {};
  }
  const firstExampleId = page.exampleIds[0];
  const firstExample = firstExampleId ? getShowcaseCollection(firstExampleId) : undefined;
  return publicMetadata({
    title: page.title,
    description: page.description,
    path: `/gifts/${page.slug}`,
    image: firstExample?.crestSrc
  });
}

export default async function GiftLandingPage({ params }: GiftLandingPageProps) {
  const { slug } = await params;
  const page = getGiftLandingPage(slug);
  if (!page) {
    notFound();
  }

  const examples = page.exampleIds.map((id) => getShowcaseCollection(id)).filter(Boolean);
  const isChristmas = page.slug === "christmas-family";
  const displayedExamples = isChristmas ? examples.slice(0, 1) : examples;
  const displayedCollectionContents = isChristmas
    ? christmasCollectionContents
    : collectionContents;
  const relatedPages = page.relatedSlugs
    .map((relatedSlug) => getGiftLandingPage(relatedSlug))
    .filter((relatedPage): relatedPage is GiftLandingPageSpec => Boolean(relatedPage));
  const pageUrl = `${SITE_URL}/gifts/${page.slug}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Gift Ideas", item: `${SITE_URL}/#gift-ideas` },
      { "@type": "ListItem", position: 3, name: page.eyebrow, item: pageUrl }
    ]
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Examples for ${page.eyebrow}`,
    itemListElement: displayedExamples.map((example, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/real-examples/${example?.id}`,
      name: example?.title
    }))
  };

  return (
    <main className={`premium-page gift-landing-page${isChristmas ? " christmas-gift-page" : ""}`}>
      <FunnelStepTracker
        stepName="gift_landing"
        metadata={{ page: `/gifts/${page.slug}`, gift_slug: page.slug }}
      />
      <StructuredData
        data={
          isChristmas
            ? [breadcrumbJsonLd, itemListJsonLd]
            : [breadcrumbJsonLd, faqJsonLd, itemListJsonLd]
        }
      />
      <section className="premium-hero gift-landing-hero">
        <div className="section gift-landing-hero-grid">
          <div>
            <nav className="seo-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>{isChristmas ? "Christmas Gifts" : page.eyebrow}</span>
            </nav>
            <p className="eyebrow">{page.eyebrow}</p>
            <h1>{page.h1}</h1>
            <p className="lead">{page.lead}</p>
            {isChristmas ? (
              <>
                <p className="christmas-hero-proof" aria-label="Collection details">
                  <span>One shared gift</span>
                  <i aria-hidden="true">·</i>
                  <span>Digital delivery</span>
                  <b className="christmas-trust-break" aria-hidden="true" />
                  <i aria-hidden="true">·</i>
                  <span>Founder reviewed</span>
                  <i aria-hidden="true">·</i>
                  <span>USD $49</span>
                </p>
                <p className="christmas-hero-includes">
                  Includes the Final Crest, Heritage Certificate, Family Story, Meaning Behind Your
                  Crest, and private Complete Collection.
                </p>
              </>
            ) : null}
            <div className="button-row">
              <Link className="button" href="/create">
                Create Their Collection
              </Link>
              <Link
                className="secondary-button"
                href={isChristmas ? "/real-examples/05-christmas-family" : "/real-examples"}
              >
                {isChristmas ? "View the Christmas Example" : "See Real Examples"}
              </Link>
            </div>
          </div>
          {examples[0] ? (
            <figure className="gift-hero-artwork">
              <Image
                src={examples[0].crestSrc}
                alt={`${examples[0].title} personalized final crest example`}
                width={900}
                height={900}
                priority
                sizes="(max-width: 900px) 92vw, 44vw"
              />
              <figcaption>
                <strong>{examples[0].title} example</strong>
                {isChristmas ? (
                  <span>
                    Mountain, path, and laurel express gathering, continuity, and gratitude.
                  </span>
                ) : null}
              </figcaption>
            </figure>
          ) : null}
        </div>
      </section>

      <section className="premium-section">
        <div className="section gift-copy-grid">
          <article>
            <p className="eyebrow">The gift problem</p>
            <h2>{page.buyerProblemTitle}</h2>
            <p className="lead">{page.buyerProblem}</p>
          </article>
          <aside className="gift-recipient-note">
            <h2>Who this gift is for</h2>
            <p>{page.recipientFit}</p>
          </aside>
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section">
          <p className="eyebrow">
            {isChristmas ? "The Complete Collection" : "What the recipient receives"}
          </p>
          <h2>
            {isChristmas
              ? "Five finished deliverables, designed to belong together."
              : "One finished Family Legacy Collection."}
          </h2>
          {isChristmas && examples[0] ? (
            <div className="christmas-suite" aria-label="Complete Collection deliverables">
              <div className="christmas-suite-crest">
                <Image
                  src={examples[0].crestSrc}
                  alt="Christmas Family Final Crest from the real example collection"
                  width={720}
                  height={720}
                  sizes="(max-width: 700px) 80vw, 34vw"
                />
              </div>
              <div className="christmas-suite-documents" aria-hidden="true">
                <div>
                  <span>Heritage Certificate</span>
                </div>
                <div>
                  <span>Family Story</span>
                </div>
                <div>
                  <span>Meaning Behind Your Crest</span>
                </div>
              </div>
            </div>
          ) : null}
          <div className="gift-content-list">
            {displayedCollectionContents.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-section">
        <div className="section">
          <p className="eyebrow">How it becomes personal</p>
          <h2>
            {isChristmas
              ? "From a Christmas memory to a family symbol."
              : "The visible details come from the evidence you provide."}
          </h2>
          {isChristmas ? (
            <ol className="christmas-evidence-chain" aria-label="Personalization evidence chain">
              <li>Christmas memory</li>
              <li>Family meaning</li>
              <li>Chosen symbol</li>
              <li>Final Crest</li>
              <li>Story and meaning guide</li>
            </ol>
          ) : null}
          <div className="gift-personalization-grid">
            {page.personalization.map((item) => (
              <article key={item}>
                <span aria-hidden="true">+</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
          <p className="gift-boundary-note">
            MyKinLegacy interprets the family details you share. It does not invent ancestry or sell
            an official coat of arms, legal heraldic grant, noble title, or certified genealogical
            record.
          </p>
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">
                {isChristmas ? "Real Christmas example" : "Related real collections"}
              </p>
              <h2>
                {isChristmas
                  ? "See how shared traditions become one family keepsake."
                  : "See how different evidence changes the result."}
              </h2>
            </div>
            <Link className="showcase-card-link" href="/real-examples">
              Browse all 20 examples
            </Link>
          </div>
          {isChristmas ? (
            <p className="christmas-example-intro">
              This real example begins with the family&apos;s gathering, gratitude, traditions, and
              retold stories. Mountain, path, and laurel were selected to express continuity and
              shared meaning—not to imply official heraldry or invented history.
            </p>
          ) : null}
          <div className={`gift-example-grid${isChristmas ? " christmas-example-grid" : ""}`}>
            {displayedExamples.map((example) =>
              example ? (
                <article key={example.id}>
                  <Link href={`/real-examples/${example.id}`}>
                    <Image
                      src={example.crestSrc}
                      alt={`${example.title} final crest artwork example`}
                      width={720}
                      height={720}
                      sizes="(max-width: 700px) 92vw, 30vw"
                    />
                  </Link>
                  <div>
                    <p className="eyebrow">{example.occasion}</p>
                    <h3>{example.title}</h3>
                    <p>{example.storyPreview}</p>
                    <Link href={`/real-examples/${example.id}`}>View this collection</Link>
                  </div>
                </article>
              ) : null
            )}
          </div>
        </div>
      </section>

      <section className="premium-section">
        <div className="section gift-delivery-grid">
          <article>
            <p className="eyebrow">Delivery expectations</p>
            <h2>Personalized, reviewed, and privately delivered.</h2>
            <p>{page.deliveryNote}</p>
            <p>
              See the <Link href="/digital-delivery">digital delivery policy</Link>,{" "}
              <Link href="/refund-policy">refund policy</Link>, and{" "}
              <Link href="/disclaimer">heraldry disclaimer</Link> before ordering.
            </p>
          </article>
          <article>
            <p className="eyebrow">Founder Edition</p>
            <h2>USD $49</h2>
            <p>
              Limited Early Access includes Founder review before the delivery email and private
              vault are released.
            </p>
            <Link className="button" href="/create">
              Begin Their Legacy
            </Link>
          </article>
        </div>
      </section>

      <section className="premium-section gift-section-ivory">
        <div className="section">
          <h2>Questions about this gift</h2>
          <div className="faq-list">
            {page.faq.map((item) => (
              <div className="faq-row" key={item.question}>
                <span>{item.question}</span>
                <strong>{item.answer}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-section">
        <div className="section">
          <p className="eyebrow">More meaningful gift ideas</p>
          <div className="gift-related-links">
            {relatedPages.map((relatedPage) => (
              <Link href={`/gifts/${relatedPage.slug}`} key={relatedPage.slug}>
                {relatedPage.eyebrow}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
