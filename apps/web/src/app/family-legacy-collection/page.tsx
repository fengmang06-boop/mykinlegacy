import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FunnelStepTracker } from "../../components/funnel-tracker";
import { ProductDetails } from "../../components/product-details";
import { StructuredData } from "../../components/structured-data";
import { publicMetadata, SITE_URL } from "../../lib/seo";

const finalHomepageAsset = "/assets/final-homepage";

export const metadata: Metadata = publicMetadata({
  title: "Personalized Family Legacy Collection Gift | MyKinLegacy",
  description:
    "Give one personalized Final Crest, frameable certificate, Family Story, and illustrated meaning guide in a private digital Family Legacy Collection.",
  path: "/family-legacy-collection",
  image: `${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`
});

const collectionFaq = [
  {
    question: "How is my collection created?",
    answer: "From your guided interview and confirmed order details."
  },
  {
    question: "Can I print the certificate and artwork?",
    answer: "Yes. The collection is prepared for personal printing, gifting, and keeping."
  },
  {
    question: "Can I give this to a family member?",
    answer: "Yes. It is a gift-ready digital collection reviewed before private delivery."
  }
] as const;

export default function FamilyLegacyCollectionPage() {
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "MyKinLegacy Family Legacy Collection",
    description:
      "A personalized digital family keepsake with one Final Crest, frameable Family Legacy Certificate, Family Story, Meaning Behind Your Crest, and private vault delivery.",
    image: `${SITE_URL}${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`,
    brand: { "@type": "Brand", name: "MyKinLegacy" },
    category: "Personalized digital family gift",
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/create`,
      priceCurrency: "USD",
      price: "49.00",
      availability: "https://schema.org/LimitedAvailability",
      itemCondition: "https://schema.org/NewCondition"
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Delivery", value: "Digital delivery" },
      { "@type": "PropertyValue", name: "Review", value: "Founder reviewed before release" }
    ]
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Family Legacy Collection",
        item: `${SITE_URL}/family-legacy-collection`
      }
    ]
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: collectionFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <main className="premium-page collection-page">
      <StructuredData data={[productJsonLd, breadcrumbJsonLd, faqJsonLd]} />
      <FunnelStepTracker
        stepName="collection_page"
        metadata={{ page: "/family-legacy-collection", product_code: "family_legacy_collection" }}
      />
      <section className="premium-hero product-hero">
        <div className="section product-layout">
          <div
            className="premium-artifact-board product-mockup product-collection-showcase"
            aria-label="Collection artifact preview"
          >
            <article className="product-artifact-featured">
              <Image
                src={`${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`}
                width={760}
                height={520}
                alt="Frameable personalized Family Legacy Certificate preview"
                priority
              />
              <div>
                <span>Primary frameable keepsake</span>
                <strong>Family Legacy Certificate</strong>
              </div>
            </article>
            <article className="product-artifact-card">
              <Image
                src={`${finalHomepageAsset}/02_homepage/hero/hero-main-crest.webp`}
                width={280}
                height={190}
                alt="Personalized Final Crest artwork preview"
              />
              <strong>Final Crest</strong>
              <span>Standalone artwork</span>
            </article>
            <article className="product-artifact-card">
              <Image
                src={`${finalHomepageAsset}/04_homepage/features/feature-family-story.webp`}
                width={280}
                height={190}
                alt=""
                aria-hidden="true"
              />
              <strong>Family Story</strong>
              <span>Meaningful family narrative</span>
            </article>
            <article className="product-artifact-card">
              <Image
                src={`${finalHomepageAsset}/04_homepage/features/feature-symbol-guide.webp`}
                width={280}
                height={190}
                alt=""
                aria-hidden="true"
              />
              <strong>Meaning Behind Your Crest</strong>
              <span>Why this crest was created</span>
            </article>
            <article className="product-artifact-card product-artifact-wide">
              <Image
                src={`${finalHomepageAsset}/04_homepage/features/feature-private-vault.webp`}
                width={420}
                height={230}
                alt=""
                aria-hidden="true"
              />
              <div>
                <strong>Private Collection Vault</strong>
                <span>Secure access for family keeping</span>
              </div>
            </article>
          </div>
          <div className="product-panel">
            <p className="eyebrow">Founder Edition · Limited Early Access</p>
            <h1>Family Legacy Collection</h1>
            <p className="lead">
              The Family Legacy Collection is a private digital keepsake designed for parents,
              grandparents, and families who deserve something more meaningful than another ordinary
              gift.
            </p>
            <p className="notice">
              Limited to the first 25 orders. Personalized digital delivery only, normally within
              two business days after Founder review.
            </p>
            <ProductDetails />
          </div>
        </div>
      </section>

      <section className="premium-section trust-strip">
        <div className="section trust-strip-grid">
          <article>
            <h3>Secure & Private</h3>
            <p>Your information and collection stay protected.</p>
          </article>
          <article>
            <h3>Private by Default</h3>
            <p>Your collection is not published to a public gallery.</p>
          </article>
          <article>
            <h3>Digital Delivery</h3>
            <p>Founder reviewed and delivered through your private vault. No physical shipping.</p>
          </article>
          <article>
            <h3>Clear Boundaries</h3>
            <p>A symbolic keepsake, not official arms and not a genealogy claim.</p>
          </article>
        </div>
      </section>

      <section className="section premium-section">
        <p className="eyebrow">Preview your legacy</p>
        <h2>A collection your parents can open, read, keep, and share.</h2>
        <p className="lead">
          The collection is digital, private by default, and prepared for meaningful gifting. It
          gives family stories, symbols, and values a form your parents can return to.
        </p>
        <div className="preview-grid">
          <article className="mock-certificate artifact-preview-card">
            <Image
              src={`${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`}
              width={460}
              height={320}
              alt=""
              aria-hidden="true"
            />
            <span>Family Legacy Certificate</span>
            <strong>Primary frameable keepsake</strong>
          </article>
          <article className="mock-crest artifact-preview-card">
            <Image
              src={`${finalHomepageAsset}/04_homepage/features/feature-house-identity.webp`}
              width={460}
              height={320}
              alt=""
              aria-hidden="true"
            />
            <span>Final Crest</span>
            <strong>Standalone artwork</strong>
          </article>
          <article className="mock-page artifact-preview-card">
            <Image
              src={`${finalHomepageAsset}/04_homepage/features/feature-family-story.webp`}
              width={460}
              height={320}
              alt=""
              aria-hidden="true"
            />
            <span>Family Story</span>
            <strong>Written to feel recognized</strong>
          </article>
          <article className="mock-vault artifact-preview-card">
            <Image
              src={`${finalHomepageAsset}/09_extras/extra-private-archive-wide.webp`}
              width={460}
              height={320}
              alt=""
              aria-hidden="true"
            />
            <span>Private Vault</span>
            <strong>Collection ready</strong>
          </article>
        </div>
      </section>

      <section className="section premium-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-list">
          {collectionFaq.map((item) => (
            <div className="faq-row" key={item.question}>
              <span>{item.question}</span>
              <strong>{item.answer}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section premium-section">
        <p className="eyebrow">Find the right family moment</p>
        <h2>Explore meaningful gift ideas and real collections.</h2>
        <div className="gift-related-links">
          <Link href="/gifts/father-retirement">Retirement gift for father</Link>
          <Link href="/gifts/grandparents">Personalized gifts for grandparents</Link>
          <Link href="/gifts/wedding">Wedding legacy gift</Link>
          <Link href="/gifts/anniversary">Anniversary gift for parents</Link>
          <Link href="/real-examples">Browse all real example collections</Link>
        </div>
      </section>

      <section className="section premium-section premium-disclaimer">
        <h2>Disclaimer</h2>
        <p className="lead">
          Your collection is a personalized heritage-inspired symbolic keepsake. It is private by
          default, not public, not an official coat of arms, and not a genealogy claim.
        </p>
      </section>
    </main>
  );
}
