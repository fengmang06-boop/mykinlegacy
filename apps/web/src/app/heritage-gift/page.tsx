import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Personalized Family Keepsake & Heritage Gift | MyKinLegacy",
  description:
    "Create a personalized heritage gift from real memories and values, with a Final Crest, Heritage Certificate, Family Story, meaning guide, and digital delivery.",
  path: "/heritage-gift"
});

export default function HeritageGiftPage() {
  return (
    <SeoLandingPage
      eyebrow="Heritage gift"
      title="A meaningful heritage gift for family moments"
      description="Create a personalized digital collection for weddings, anniversaries, holidays, family reunions, and legacy keepsakes."
      trackingSource="heritage_gift"
      highlights={["Gift-ready PDF files", "Symbolic family story", "Secure digital delivery"]}
      extraContent={
        <>
          <section className="section">
            <p className="eyebrow">What a heritage gift can preserve</p>
            <h2>Begin with a memory the family can recognize</h2>
            <p className="lead">
              A meaningful heritage gift does not need to claim an ancient lineage. It can preserve
              the values, places, traditions, sayings, and acts of care that relatives already know
              to be true. One remembered journey, family gathering, working habit, or piece of
              guidance gives the collection a more honest foundation than a generic surname emblem.
            </p>
            <p>
              MyKinLegacy uses the details you provide as design evidence. A value may suggest a
              symbol, a memory may shape the Family Story, and an occasion may guide the dedication.
              Nothing is treated as verified ancestry unless the family has independently verified
              it. For practical ways to gather source material, read the guide to{" "}
              <Link href="/journal/how-to-create-a-family-keepsake">
                creating a family keepsake
              </Link>
              .
            </p>
          </section>

          <section className="section">
            <p className="eyebrow">Choose for the family moment</p>
            <h2>A custom heritage gift should fit the recipient and occasion</h2>
            <div className="grid">
              <article className="card">
                <h3>For parents and grandparents</h3>
                <p className="muted">
                  Center the guidance, traditions, migration memories, or everyday care that younger
                  generations want to keep. See the dedicated{" "}
                  <Link href="/gifts/grandparents">grandparents gift page</Link>.
                </p>
              </article>
              <article className="card">
                <h3>For a shared milestone</h3>
                <p className="muted">
                  Weddings, anniversaries, Christmas, and{" "}
                  <Link href="/gifts/family-reunion">family reunions</Link> can support one
                  collection made for several relatives to open and preserve together.
                </p>
              </article>
              <article className="card">
                <h3>For a private family archive</h3>
                <p className="muted">
                  Digital delivery makes it possible to keep a master copy, arrange personal
                  printing, and share the finished collection privately without physical shipping.
                </p>
              </article>
            </div>
          </section>

          <section className="section">
            <p className="eyebrow">The finished collection</p>
            <h2>Five deliverables carry the story in different ways</h2>
            <p className="lead">
              The Final Crest makes the family meaning visible. The Heritage Certificate introduces
              the recipient and dedication. The Family Story records the evidence in narrative form,
              while Meaning Behind Your Crest explains the design choices. The Complete Collection
              keeps all finished customer files together in the private digital archive.
            </p>
            <p>
              Compare additional formats in{" "}
              <Link href="/journal/family-legacy-gift-ideas">Family Legacy Gift Ideas</Link>, or{" "}
              <Link href="/real-examples">browse real example collections</Link> before deciding
              whether this approach fits the person you want to honor.
            </p>
          </section>
        </>
      }
      faq={[
        {
          question: "Is this a physical gift?",
          answer: "No. The product is delivered digitally through a private Download Vault."
        },
        {
          question: "Can recipients print the files?",
          answer: "Yes. Delivered files are prepared for personal printing and safekeeping."
        },
        {
          question: "Is it private?",
          answer: "Yes. Collections are private by default and not added to a public gallery."
        }
      ]}
    />
  );
}
