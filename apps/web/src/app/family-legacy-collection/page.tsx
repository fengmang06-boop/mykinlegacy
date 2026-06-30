import type { Metadata } from "next";

import { ProductDetails } from "../../components/product-details";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Legacy Collection | MyKinLegacy",
  description:
    "Review the MyKinLegacy Family Legacy Collection, a meaningful private digital keepsake for parents, grandparents, and families who deserve more than an ordinary gift.",
  path: "/family-legacy-collection"
});

export default function FamilyLegacyCollectionPage() {
  return (
    <main className="premium-page collection-page">
      <section className="premium-hero product-hero">
        <div className="section product-layout">
          <div
            className="premium-artifact-board product-mockup"
            aria-label="Collection artifact preview"
          >
            <article className="mockup-item featured">
              <span className="mini-crest" aria-hidden="true" />
              <strong>Crest Artwork</strong>
              <span>Symbolic family centerpiece</span>
            </article>
            <article className="mockup-item">
              <span className="mini-certificate" aria-hidden="true" />
              <strong>Heritage Certificate</strong>
              <span>Personal keepsake</span>
            </article>
            <article className="mockup-item">
              <span className="mini-story" aria-hidden="true" />
              <strong>Family Story</strong>
              <span>Meaningful family narrative</span>
            </article>
            <article className="mockup-item">
              <span className="mini-guide" aria-hidden="true" />
              <strong>Symbol Guide</strong>
              <span>Meaning notes</span>
            </article>
            <article className="mockup-item wide">
              <span className="mini-vault" aria-hidden="true" />
              <div>
                <strong>Private Collection Vault</strong>
                <span>Secure access for family keeping</span>
              </div>
            </article>
          </div>
          <div className="product-panel">
            <p className="eyebrow">Meaningful family keepsake</p>
            <h1>Family Legacy Collection</h1>
            <p className="lead">
              The Family Legacy Collection is a private digital keepsake designed for parents,
              grandparents, and families who deserve something more meaningful than another ordinary
              gift.
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
            <p>Delivered through your private vault for gifting and personal keeping.</p>
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
          <article className="mock-crest">
            <span>Crest Artwork</span>
          </article>
          <article className="mock-certificate">
            <span>Heritage Certificate</span>
            <strong>Personal keepsake</strong>
          </article>
          <article className="mock-page">
            <span>Family Story</span>
            <p />
            <p />
            <p />
          </article>
          <article className="mock-vault">
            <span>Private Vault</span>
            <strong>Collection ready</strong>
          </article>
        </div>
      </section>

      <section className="section premium-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-list">
          <div className="faq-row">
            <span>How is my collection created?</span>
            <strong>From your guided interview and confirmed order details.</strong>
          </div>
          <div className="faq-row">
            <span>Can I print the certificate and artwork?</span>
            <strong>Yes, the collection is prepared for personal gifting and keeping.</strong>
          </div>
          <div className="faq-row">
            <span>Can I gift this to a family member?</span>
            <strong>Yes, it is a gift-ready digital collection.</strong>
          </div>
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
