import Link from "next/link";

import { BRAND_NAME, PRODUCT_NAME } from "../lib/seo";

export interface SeoLandingPageProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  faq: Array<{ question: string; answer: string }>;
  ctaHref?: string;
  ctaLabel?: string;
}

export function SeoLandingPage({
  eyebrow,
  title,
  description,
  highlights,
  faq,
  ctaHref = "/create",
  ctaLabel = "Begin Your Legacy"
}: SeoLandingPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <div className="section hero-grid">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="hero-rule" aria-hidden="true" />
            <div className="button-row">
              <Link className="button" href={ctaHref}>
                {ctaLabel}
              </Link>
              <Link className="secondary-button" href="/family-legacy-collection">
                View {PRODUCT_NAME}
              </Link>
            </div>
          </div>
          <div className="delivery-mockup" aria-label={`${BRAND_NAME} collection preview`}>
            <article className="mockup-item featured">
              <span className="mini-crest" aria-hidden="true" />
              <strong>Symbolic Crest</strong>
              <span>Three PNG artwork variants</span>
            </article>
            <article className="mockup-item">
              <span className="mini-certificate" aria-hidden="true" />
              <strong>Certificate</strong>
              <span>Printable PDF</span>
            </article>
            <article className="mockup-item">
              <span className="mini-story" aria-hidden="true" />
              <strong>Family Story</strong>
              <span>Private narrative PDF</span>
            </article>
            <article className="mockup-item wide">
              <span className="mini-vault" aria-hidden="true" />
              <div>
                <strong>Download Vault</strong>
                <span>Token-protected private file delivery</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">What makes it meaningful</p>
        <h2>A private symbolic collection shaped by your family details</h2>
        <div className="grid">
          {highlights.map((item) => (
            <article className="card" key={item}>
              <h3>{item}</h3>
              <p className="muted">
                Included as part of a personalized, AI-generated, heritage-inspired digital
                collection for personal use, gifting, and archiving.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="section">
          <p className="eyebrow">Important disclaimer</p>
          <h2>Inspired symbolism, not official heraldic certification</h2>
          <p className="lead">
            {BRAND_NAME} creates personalized AI-generated heritage-inspired symbolic designs. The
            collection is not an official, legally granted, or historically certified coat of arms,
            and it does not verify ancestral rights or heraldic entitlement.
          </p>
        </div>
      </section>

      <section className="section">
        <h2>FAQ</h2>
        <div className="faq-list">
          {faq.map((item) => (
            <div className="faq-row" key={item.question}>
              <span>{item.question}</span>
              <strong>{item.answer}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Start with your family story</h2>
        <p className="lead">
          The guided form captures surname, heritage country, values, symbols, colors, motto, and
          preferred visual style before checkout.
        </p>
        <Link className="button" href={ctaHref}>
          {ctaLabel}
        </Link>
      </section>
    </main>
  );
}
