import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { publicMetadata } from "../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "MyKinLegacy | Meaningful Family Keepsake for Parents",
  description:
    "Create a meaningful family keepsake for parents who already have everything, with a private legacy collection made for gifting and personal keeping.",
  path: "/"
});

const giftMoments = [
  "Father's Day",
  "Mother's Day",
  "Christmas",
  "Retirement",
  "Anniversary",
  "Grandparents",
  "Family Reunion"
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="section hero-grid">
          <div>
            <p className="eyebrow">Meaningful family keepsake</p>
            <h1>A meaningful family keepsake for the parents who already have everything.</h1>
            <p>
              Turn your family's stories, values, and symbols into a private legacy collection your
              parents can keep, share, and pass down.
            </p>
            <div className="hero-rule" aria-hidden="true" />
            <div className="button-row">
              <Link className="button" href="/create">
                Begin Their Legacy
              </Link>
              <Link className="secondary-button" href="/family-legacy-collection">
                View the Collection
              </Link>
            </div>
            <div className="trust-row" aria-label="Collection trust highlights">
              <span>Private by default</span>
              <span>Made for gifting</span>
              <span>Digital delivery</span>
              <span>Personal keeping</span>
            </div>
          </div>
          <div className="delivery-mockup" aria-label="Family keepsake collection preview">
            <article className="mockup-item featured">
              <span className="mini-crest" aria-hidden="true" />
              <strong>Crest Artwork</strong>
              <span>A symbolic family centerpiece</span>
            </article>
            <article className="mockup-item">
              <span className="mini-certificate" aria-hidden="true" />
              <strong>Heritage Certificate</strong>
              <span>A keepsake to print or preserve</span>
            </article>
            <article className="mockup-item">
              <span className="mini-story" aria-hidden="true" />
              <strong>Family Story</strong>
              <span>Words your parents can recognize</span>
            </article>
            <article className="mockup-item">
              <span className="mini-guide" aria-hidden="true" />
              <strong>Symbol Guide</strong>
              <span>Why each symbol belongs</span>
            </article>
            <article className="mockup-item wide">
              <span className="mini-vault" aria-hidden="true" />
              <div>
                <strong>Private Collection Vault</strong>
                <span>Secure access for family safekeeping</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="gift-ideas">
        <p className="eyebrow">Made for meaningful gifting</p>
        <h2>Made for the moments when ordinary gifts are not enough.</h2>
        <p className="lead">
          When parents, grandparents, or the whole family deserve more than another object, create
          something that names what they have carried and what your family wants to keep.
        </p>
        <div className="grid">
          {giftMoments.map((moment) => (
            <div className="card" key={moment}>
              {moment}
            </div>
          ))}
        </div>
      </section>

      <section className="collection-strip">
        <div className="section">
          <p className="eyebrow">What you receive</p>
          <h2>A private family collection made to recognize the people who raised you.</h2>
          <div className="grid">
            {[
              [
                "Crest Artwork",
                "A symbolic centerpiece shaped around family values, story, and belonging.",
                "Artwork",
                "artifact-crest"
              ],
              [
                "Heritage Certificate",
                "A ceremonial keepsake for gifting, printing, or preserving in a family archive.",
                "Keepsake",
                "artifact-certificate"
              ],
              [
                "Family Story",
                "A written reflection that helps parents and relatives feel seen.",
                "Story",
                "artifact-story"
              ],
              [
                "Symbol Guide",
                "A clear explanation of the symbols, colors, and motto chosen for the family.",
                "Meaning",
                "artifact-guide"
              ],
              [
                "Private Collection Vault",
                "A secure private space to receive and keep the finished collection.",
                "Private",
                "artifact-vault"
              ],
              [
                "Recognition Letter",
                "A warm opening note for the parent, grandparent, or family receiving it.",
                "Letter",
                "artifact-package"
              ]
            ].map(([title, copy, format, visualClass]) => (
              <article className="artifact-card" key={title}>
                <span className={`artifact-visual ${visualClass}`} aria-hidden="true" />
                <h3>{title}</h3>
                <p className="muted">{copy}</p>
                <span className="artifact-format">{format}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <p className="eyebrow">How it works</p>
        <h2>From a few family details to a gift-ready private collection</h2>
        <div className="step-flow">
          <div className="card step-card">
            <span className="step-number">1</span>
            <h3>Tell us who this is for</h3>
            <p className="muted">
              Start with the parent, grandparent, couple, or family moment this collection should
              honor.
            </p>
          </div>
          <div className="card step-card">
            <span className="step-number">2</span>
            <h3>Share values and memories</h3>
            <p className="muted">
              Add the values, stories, symbols, and words that should feel recognizable to them.
            </p>
          </div>
          <div className="card step-card">
            <span className="step-number">3</span>
            <h3>Confirm and checkout securely</h3>
            <p className="muted">Review the private collection summary before secure checkout.</p>
          </div>
          <div className="card step-card">
            <span className="step-number">4</span>
            <h3>Receive your private collection</h3>
            <p className="muted">
              Receive the finished collection through a token-protected private vault.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Example collection preview</p>
        <h2>Designed to be opened, read, kept, and shared with family</h2>
        <p className="lead">
          The collection should feel like something your parents can return to, not another ordinary
          gift that gets put away and forgotten.
        </p>
        <div className="preview-grid">
          <article className="mock-crest">
            <span>House Crest</span>
          </article>
          <article className="mock-certificate">
            <span>Heritage Certificate</span>
            <strong>Legacy Family</strong>
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

      <section className="band">
        <div className="section">
          <p className="eyebrow">Trust and clarity</p>
          <h2>Symbolic by design, private by default</h2>
          <p className="lead">
            Your collection is private by default, not published publicly, delivered digitally, and
            made for gifting and personal keeping. It is a symbolic keepsake, not an official coat
            of arms and not a genealogy claim.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="section">
          <h2>Privacy promise</h2>
          <p className="lead">
            Your collection is private by default. Vault access is token-protected, and your
            collection is not published as a public gallery.
          </p>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Collection details</p>
        <h2>Review the collection before you begin</h2>
        <p className="lead">Final package price is loaded from the product API before checkout.</p>
        <Link className="button" href="/family-legacy-collection">
          View the Collection
        </Link>
      </section>

      <section className="section" id="faq">
        <h2>FAQ</h2>
        <div className="faq-list">
          <div className="faq-row">
            <span>Is this digital?</span>
            <strong>Yes. The finished collection is delivered through a private vault.</strong>
          </div>
          <div className="faq-row">
            <span>Is shipping required?</span>
            <strong>No physical shipping is included.</strong>
          </div>
          <div className="faq-row">
            <span>Can I use it as a gift?</span>
            <strong>Yes. It is made for parents, grandparents, and family keeping.</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Disclaimer</h2>
        <p className="lead">
          Your collection is a personalized heritage-inspired symbolic keepsake. It is not an
          official coat of arms, legal heraldry, or a genealogy claim.
        </p>
      </section>
    </main>
  );
}
