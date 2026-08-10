import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Symbolic Family Crest Meaning & Design | MyKinLegacy",
  description:
    "Explore symbolic family crest meaning and create a modern family emblem from real values, memories, colors, and symbols without claiming official heraldry.",
  path: "/symbolic-family-crest"
});

export default function SymbolicFamilyCrestPage() {
  return (
    <SeoLandingPage
      eyebrow="Symbolic family crest"
      title="A symbolic family crest shaped by values and story"
      description="Build a heritage-inspired collection that explains chosen symbols clearly without claiming official heraldic status."
      highlights={[
        "Values-first symbols",
        "Animal and color meanings",
        "Clear heritage disclaimer"
      ]}
      extraContent={
        <>
          <section className="section">
            <p className="eyebrow">Meaning before decoration</p>
            <h2>A symbolic family crest explains why each element belongs</h2>
            <p className="lead">
              A modern family emblem can express values and memories without pretending to be an
              inherited coat of arms. The design becomes personal when a symbol can be traced to
              evidence the family supplied: a lantern for remembered guidance, a compass for shared
              direction, a tree for continuity, or a mountain for resilience through a specific
              experience.
            </p>
            <p>
              Historical terminology is narrower than everyday usage. Read{" "}
              <Link href="/journal/what-is-a-family-crest">
                what a family crest is and how it differs from a coat of arms
              </Link>{" "}
              before treating any modern artwork as heraldic evidence.
            </p>
          </section>

          <section className="section">
            <p className="eyebrow">Evidence-led design</p>
            <h2>How a family story becomes a modern crest direction</h2>
            <div className="grid">
              <article className="card">
                <h3>Start with lived details</h3>
                <p className="muted">
                  Gather one memory, several values, meaningful places or traditions, and the reason
                  the collection is being created.
                </p>
              </article>
              <article className="card">
                <h3>Select only supported symbols</h3>
                <p className="muted">
                  Animals, plants, colors, objects, and celestial elements are considered only when
                  they support the supplied evidence rather than a generic personality claim.
                </p>
              </article>
              <article className="card">
                <h3>Explain the final choices</h3>
                <p className="muted">
                  Meaning Behind Your Crest records the design basis so the recipient can understand
                  the relationship between family evidence and finished artwork.
                </p>
              </article>
            </div>
          </section>

          <section className="section">
            <p className="eyebrow">Modern, personal, bounded</p>
            <h2>Symbolic meaning is not proof of ancestry or status</h2>
            <p className="lead">
              A symbolic family crest can be meaningful as commissioned personal artwork while
              remaining clear about its limits. It does not establish noble lineage, ownership of
              historic arms, legal heraldic entitlement, or a verified genealogical relationship.
              Supplied family history remains the family&apos;s evidence rather than a claim
              certified by MyKinLegacy.
            </p>
            <p>
              See{" "}
              <Link href="/journal/how-to-create-a-modern-family-crest">
                how to create a modern family crest from a real family story
              </Link>
              , then compare the lantern, compass, tree, mountain, and other evidence-led directions
              in the <Link href="/real-examples">real examples library</Link>.
            </p>
          </section>
        </>
      }
      faq={[
        {
          question: "Why symbolic instead of official?",
          answer:
            "Official arms can involve legal and historical rules; this product is personal symbolism."
        },
        {
          question: "Are symbols explained?",
          answer: "Yes. The collection includes symbolic explanations in PDF deliverables."
        },
        {
          question: "Can I include a motto?",
          answer:
            "Yes. Motto text is handled in supporting files rather than generated inside AI images."
        }
      ]}
    />
  );
}
