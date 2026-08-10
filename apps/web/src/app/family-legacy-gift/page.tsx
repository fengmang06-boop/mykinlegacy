import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Legacy Gift for Meaningful Moments | MyKinLegacy",
  description:
    "Turn real family memories and values into a digital legacy gift with a Final Crest, Heritage Certificate, Family Story, meaning guide, and Complete Collection.",
  path: "/family-legacy-gift"
});

export default function FamilyLegacyGiftPage() {
  return (
    <SeoLandingPage
      eyebrow="Family legacy gift"
      title="Turn family values into a lasting digital legacy gift"
      description="Capture surname, origins, values, symbols, and motto language in a private Family Legacy Collection."
      trackingSource="family_legacy_gift"
      highlights={["One personalized Final Crest", "Family Story", "Heritage Certificate"]}
      extraContent={
        <>
          <section className="section">
            <p className="eyebrow">Evidence before symbolism</p>
            <h2>A family legacy gift starts with what the recipient actually gave</h2>
            <p className="lead">
              The strongest legacy gifts name a contribution the family has experienced: steady
              protection, patient guidance, a tradition kept alive, a difficult journey, a home
              created, or a value taught through example. Those details give the finished collection
              its emotional weight and prevent it from becoming a generic family emblem.
            </p>
            <p>
              You do not need a complete biography. One specific memory, several lived values, and a
              clear recipient are enough to begin the guided interview. If you are still comparing
              formats, start with these{" "}
              <Link href="/journal/family-legacy-gift-ideas">family legacy gift ideas</Link> and
              decide whether the recipient would most value something to read, display, share, or
              privately archive.
            </p>
          </section>

          <section className="section">
            <p className="eyebrow">Recipient and occasion</p>
            <h2>Make the collection specific enough to belong to one family</h2>
            <div className="grid">
              <article className="card">
                <h3>Recognition for a parent</h3>
                <p className="muted">
                  A <Link href="/gifts/father-retirement">father&apos;s retirement collection</Link>{" "}
                  can recognize what his working years made possible rather than relying on a
                  generic retirement theme.
                </p>
              </article>
              <article className="card">
                <h3>A shared family milestone</h3>
                <p className="muted">
                  An <Link href="/gifts/anniversary">anniversary gift for parents</Link> can center
                  the home, traditions, and relationships two people built together.
                </p>
              </article>
              <article className="card">
                <h3>Continuity across generations</h3>
                <p className="muted">
                  Grandparent and reunion collections can preserve a saying, place, migration
                  memory, or piece of guidance without presenting memory as certified genealogy.
                </p>
              </article>
            </div>
          </section>

          <section className="section">
            <p className="eyebrow">One connected product</p>
            <h2>The Complete Collection is more than a standalone crest</h2>
            <p className="lead">
              Each finished product includes the Final Crest, Heritage Certificate, Family Story,
              Meaning Behind Your Crest, and Complete Collection archive. The artwork provides a
              visual center, but the certificate, story, and meaning guide show who the gift honors
              and why the selected symbols belong.
            </p>
            <p>
              Review <Link href="/real-examples">real family and occasion examples</Link> to see how
              different evidence leads to different designs. Finished files are delivered privately
              and digitally; no physical product is shipped.
            </p>
          </section>
        </>
      }
      faq={[
        {
          question: "Who is this for?",
          answer: "Families looking for a personal, symbolic, digital keepsake or meaningful gift."
        },
        {
          question: "Does it verify genealogy?",
          answer: "No. It is not genealogy verification or heraldic certification."
        },
        {
          question: "Where does the CTA go?",
          answer: "Start with the guided form or review the Family Legacy Collection page."
        }
      ]}
    />
  );
}
