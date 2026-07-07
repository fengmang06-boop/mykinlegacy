import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { FunnelStepTracker } from "../components/funnel-tracker";
import { publicMetadata } from "../lib/seo";

const finalHomepageAsset = "/assets/final-homepage";

export const metadata: Metadata = publicMetadata({
  title: "MyKinLegacy | Meaningful Family Keepsake for Parents",
  description:
    "Create a meaningful family keepsake for parents who already have everything, with a private legacy collection made for gifting and personal keeping.",
  path: "/"
});

const heroArtifacts = [
  [
    "House Identity",
    "A private interpretation of what your family stands for.",
    `${finalHomepageAsset}/02_homepage/hero/hero-house-identity.webp`
  ],
  [
    "Private Archive Certificate",
    "A clean keepsake document for gifting, printing, and keeping.",
    `${finalHomepageAsset}/02_homepage/hero/hero-heritage-certificate.webp`
  ],
  [
    "Private Vault",
    "A secure space to receive and preserve the finished collection.",
    `${finalHomepageAsset}/02_homepage/hero/hero-private-vault.webp`
  ]
] as const;

const occasions = [
  [
    "Father's Day",
    "For the father who never asks for much.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-fathers-day.webp`
  ],
  [
    "Birthday",
    "For a gift that says more than another object.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-birthday.webp`
  ],
  [
    "Anniversary",
    "For honoring the family two people built together.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-anniversary.webp`
  ],
  [
    "Christmas",
    "For the family moment everyone remembers.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-christmas.webp`
  ],
  [
    "Retirement",
    "For a life of work, care, and quiet legacy.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-retirement.webp`
  ],
  [
    "Thanksgiving",
    "For gathering around the story that holds everyone.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-thanksgiving.webp`
  ],
  [
    "New Baby",
    "For welcoming a child into a living family story.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-new-baby.webp`
  ],
  [
    "Graduation",
    "For sending someone forward with roots.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-graduation.webp`
  ]
] as const;

const receives = [
  [
    "House Identity",
    "The emotional center of the collection: values, story, tone, and symbolic direction.",
    `${finalHomepageAsset}/04_homepage/features/feature-house-identity.webp`
  ],
  [
    "Private Archive Certificate",
    "A clean keepsake document designed for personal keeping and gifting.",
    `${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`
  ],
  [
    "Family Story",
    "A warm narrative that helps parents feel recognized instead of merely represented.",
    `${finalHomepageAsset}/04_homepage/features/feature-family-story.webp`
  ],
  [
    "Symbol Guide",
    "A clear explanation of why each symbol belongs in the collection.",
    `${finalHomepageAsset}/04_homepage/features/feature-symbol-guide.webp`
  ],
  [
    "Private Collection Vault",
    "A protected delivery space for receiving and preserving the finished collection.",
    `${finalHomepageAsset}/04_homepage/features/feature-private-vault.webp`
  ],
  [
    "Recognition Cards",
    "Small shareable moments that make the collection easier to show family.",
    `${finalHomepageAsset}/04_homepage/features/feature-recognition-cards.webp`
  ]
] as const;

const steps = [
  [
    "1",
    "Tell Us",
    "Share who the collection is for and what your family wants remembered.",
    `${finalHomepageAsset}/05_homepage/steps/step-01-tell-us.webp`
  ],
  [
    "2",
    "We Create",
    "We shape values, culture, symbols, and story into a private collection.",
    `${finalHomepageAsset}/05_homepage/steps/step-02-we-create.webp`
  ],
  [
    "3",
    "Review",
    "See the direction before the collection becomes final.",
    `${finalHomepageAsset}/05_homepage/steps/step-03-review.webp`
  ],
  [
    "4",
    "Finalize",
    "The symbolic artwork and written artifacts are prepared for keeping.",
    `${finalHomepageAsset}/05_homepage/steps/step-04-finalize.webp`
  ],
  [
    "5",
    "Receive",
    "Your collection is delivered through a private vault.",
    `${finalHomepageAsset}/05_homepage/steps/step-05-receive.webp`
  ]
] as const;

const generationCards = [
  [
    "Crafted with meaning",
    "Every artifact should explain why it belongs, not simply look decorative.",
    `${finalHomepageAsset}/06_homepage/generations/generations-crafted-with-meaning.webp`
  ],
  [
    "A legacy that lives on",
    "Made for parents, children, and grandchildren to revisit over time.",
    `${finalHomepageAsset}/06_homepage/generations/generations-a-legacy-that-lives-on.webp`
  ],
  [
    "Our story",
    "A collection that gives the family language for what it has carried.",
    `${finalHomepageAsset}/06_homepage/generations/generations-our-story.webp`
  ],
  [
    "A collection that lasts",
    "Private, gift-ready, and designed to feel worth preserving.",
    `${finalHomepageAsset}/06_homepage/generations/generations-a-collection-that-lasts.webp`
  ]
] as const;

function HomeAsset({
  className,
  src,
  size = 96
}: Readonly<{
  className?: string;
  src: string;
  size?: number;
}>) {
  return (
    <Image
      className={className}
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

export default function HomePage() {
  return (
    <main className="home-premium">
      <FunnelStepTracker stepName="landing_page" metadata={{ page: "/" }} />
      <section className="home-hero">
        <div className="home-shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Private family legacy collection</p>
            <h1>A meaningful family keepsake for the parents who already have everything.</h1>
            <p className="home-hero-subtext">
              Turn your family&apos;s values, culture, and symbols into a private legacy collection
              your parents can enjoy, share, and pass down.
            </p>
            <div className="home-cta-row">
              <Link className="home-button home-button-primary" href="/create">
                Create Your Legacy
              </Link>
              <Link className="home-button home-button-secondary" href="/family-legacy-collection">
                View Collections
              </Link>
            </div>
            <div className="home-hero-trust" aria-label="Trust highlights">
              <span>Private by default</span>
              <span>Symbolic keepsake</span>
              <span>Gift-ready collection</span>
            </div>
          </div>

          <div className="home-artifact-board" aria-label="Legacy collection preview">
            <div className="home-board-header">
              <HomeAsset src={`${finalHomepageAsset}/01_brand/logo-mark.webp`} size={96} />
              <div>
                <strong>Family Legacy Collection</strong>
                <span>Private vault preview</span>
              </div>
            </div>
            <div className="home-hero-main-visual">
              <Image
                src={`${finalHomepageAsset}/02_homepage/hero/hero-main-crest.webp`}
                width={900}
                height={620}
                alt=""
                aria-hidden="true"
                priority
              />
              <div className="home-hero-visual-caption">
                <span>Private collection display</span>
                <strong>Identity, story, archive document, and vault in one keepsake.</strong>
              </div>
            </div>
            <div className="home-artifact-grid">
              {heroArtifacts.map(([title, description, icon]) => (
                <article className="home-artifact-tile" key={title}>
                  <HomeAsset className="home-card-visual" src={icon} size={220} />
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section" id="gift-ideas">
        <div className="home-shell">
          <div className="home-section-heading">
            <p className="home-eyebrow">Perfect for</p>
            <h2>Made for the moments when ordinary gifts are not enough.</h2>
            <p>
              When the person receiving it already has the practical things, give them something
              that recognizes who they are to the family.
            </p>
          </div>
          <div className="home-card-grid home-occasion-grid">
            {occasions.map(([title, description, icon]) => (
              <article className="home-card home-occasion-card" key={title}>
                <HomeAsset className="home-card-visual" src={icon} size={220} />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section-ivory">
        <div className="home-shell">
          <div className="home-section-heading">
            <p className="home-eyebrow">What you receive</p>
            <h2>A private collection of artifacts designed to feel recognized, not generated.</h2>
            <p>
              The collection is built around identity, story, symbols, and preservation, so it feels
              like something a family can open together and keep.
            </p>
          </div>
          <div className="home-card-grid">
            {receives.map(([title, description, icon]) => (
              <article className="home-card home-receive-card" key={title}>
                <HomeAsset className="home-card-visual" src={icon} size={260} />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="home-shell">
          <div className="home-section-heading">
            <p className="home-eyebrow">How it works</p>
            <h2>A clear path from family details to a private legacy collection.</h2>
          </div>
          <div className="home-step-line">
            {steps.map(([number, title, description, icon]) => (
              <article className="home-step" key={title}>
                <span>{number}</span>
                <HomeAsset className="home-card-visual" src={icon} size={220} />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-generations">
        <div className="home-shell home-generations-grid">
          <div className="home-section-heading">
            <p className="home-eyebrow">Designed for generations</p>
            <h2>Built to be opened now, understood later, and preserved for years.</h2>
            <p>
              A meaningful keepsake should become more valuable as the family changes, gathers,
              remembers, and passes stories forward.
            </p>
          </div>
          <div className="home-generation-stack">
            {generationCards.map(([title, description, icon]) => (
              <article className="home-generation-card" key={title}>
                <HomeAsset className="home-card-visual" src={icon} size={260} />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-shell home-trust-grid">
          <article className="home-trust-block">
            <HomeAsset
              className="home-card-visual"
              src={`${finalHomepageAsset}/07_homepage/trust/trust-symbolic-by-design.webp`}
              size={300}
            />
            <p className="home-eyebrow">Trust and clarity</p>
            <h2>Symbolic by design, private by default.</h2>
            <p>
              Your collection is made as a personal symbolic keepsake. It is not published publicly,
              not an official coat of arms, and not a genealogy claim.
            </p>
          </article>
          <article className="home-trust-block">
            <HomeAsset
              className="home-card-visual"
              src={`${finalHomepageAsset}/07_homepage/trust/trust-privacy-promise.webp`}
              size={300}
            />
            <p className="home-eyebrow">Privacy promise</p>
            <h2>Your family story belongs to your family.</h2>
            <p>
              The collection is delivered through a private vault experience and designed for
              personal keeping, family sharing, and trusted gifting.
            </p>
          </article>
        </div>
      </section>

      <section className="home-final-cta">
        <div className="home-shell home-final-inner">
          <p className="home-eyebrow">Begin with confidence</p>
          <h2>Begin a Legacy Worth Keeping</h2>
          <p>Your satisfaction is our promise. Love it, or we&apos;ll make it right.</p>
          <Link className="home-button home-button-primary" href="/create">
            Start Your Legacy Journey
          </Link>
        </div>
      </section>

      <section className="home-section home-faq" id="faq">
        <div className="home-shell">
          <h2>FAQ</h2>
          <div className="home-faq-list">
            <div>
              <span>Is this an official coat of arms?</span>
              <strong>No. It is a personalized heritage-inspired symbolic keepsake.</strong>
            </div>
            <div>
              <span>Is the collection private?</span>
              <strong>Yes. It is private by default and made for personal family keeping.</strong>
            </div>
            <div>
              <span>Can I give it as a gift?</span>
              <strong>
                Yes. It is designed for parents, grandparents, and meaningful family moments.
              </strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
