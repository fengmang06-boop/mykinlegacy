import type { Metadata } from "next";

import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Support | MyKinLegacy",
  description:
    "Get help with MyKinLegacy digital delivery, private vault access, collection preparation, artifact access, and refund review.",
  path: "/support"
});

export default function SupportPage() {
  return (
    <main>
      <section className="journey-shell">
        <div className="section">
          <div className="journey-card">
            <p className="eyebrow">Vault support</p>
            <h1>Customer support for your Family Legacy Collection</h1>
            <p className="lead">
              Help for private vault access, delivery email, collection preparation, missing
              artifacts, and digital keepsake questions.
            </p>
            <div className="grid">
              <div className="card">
                <h2>Vault link expired</h2>
                <p className="muted">
                  Contact support with your order number so we can review access.
                </p>
              </div>
              <div className="card">
                <h2>Email not received</h2>
                <p className="muted">
                  Check spam first, then contact support for a safe resend review.
                </p>
              </div>
              <div className="card">
                <h2>Artifact missing</h2>
                <p className="muted">
                  Contact support with your order number and the artifact you expected to receive.
                </p>
              </div>
              <div className="card">
                <h2>Collection delayed</h2>
                <p className="muted">
                  Some collections take longer. We can check stuck orders manually.
                </p>
              </div>
              <div className="card">
                <h2>Refund note</h2>
                <p className="muted">
                  This is a digital product; refund review depends on delivery state.
                </p>
              </div>
              <div className="card">
                <h2>Arms clarification</h2>
                <p className="muted">
                  We create personalized symbolic keepsakes, not official arms and not genealogy
                  claims.
                </p>
              </div>
            </div>
            <p className="notice">Contact support: support@mykinlegacy.com</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>FAQ</h2>
        <div className="faq-list">
          <div className="faq-row">
            <span>Can support reissue a private vault link?</span>
            <strong>Support can review expired or missing access and reissue when appropriate.</strong>
          </div>
          <div className="faq-row">
            <span>Can support mark an order paid?</span>
            <strong>No. Payment status must come from verified payment events.</strong>
          </div>
          <div className="faq-row">
            <span>Can support certify a coat of arms?</span>
            <strong>No. MyKinLegacy creates symbolic keepsakes, not official arms.</strong>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section">
          <h2>Disclaimer</h2>
          <p className="lead">
            MyKinLegacy creates personalized heritage-inspired symbolic keepsakes for gifting and
            personal keeping. The service does not provide official arms or genealogy claims.
          </p>
        </div>
      </section>
    </main>
  );
}
