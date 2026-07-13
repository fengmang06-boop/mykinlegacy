import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { FunnelStepTracker } from "../components/funnel-tracker";
import { StructuredData } from "../components/structured-data";
import { publicMetadata } from "../lib/seo";

const finalHomepageAsset = "/assets/final-homepage";

export const metadata: Metadata = publicMetadata({
  title: "Personalized Family Gift & Legacy Keepsake | MyKinLegacy",
  description:
    "Create a personalized family gift with one Final Crest, frameable certificate, Family Story, and private legacy collection for someone you love.",
  path: "/"
});

const heroArtifacts = [
  [
    "Family Legacy Certificate",
    "The primary frameable keepsake, personalized for the person you want to honor.",
    `${finalHomepageAsset}/02_homepage/hero/hero-heritage-certificate.webp`
  ],
  [
    "Final Crest",
    "The finished crest artwork presented on the certificate and provided on its own.",
    `${finalHomepageAsset}/02_homepage/hero/hero-house-identity.webp`
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
    `${finalHomepageAsset}/03_homepage/occasions/occasion-fathers-day.webp`,
    "/gifts/fathers-day"
  ],
  [
    "Birthday",
    "For a gift that says more than another object.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-birthday.webp`,
    "/gifts/mother-birthday"
  ],
  [
    "Anniversary",
    "For honoring the family two people built together.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-anniversary.webp`,
    "/gifts/anniversary"
  ],
  [
    "Christmas",
    "For the family moment everyone remembers.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-christmas.webp`,
    "/gifts/christmas-family"
  ],
  [
    "Retirement",
    "For a life of work, care, and quiet legacy.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-retirement.webp`,
    "/gifts/father-retirement"
  ],
  [
    "Thanksgiving",
    "For gathering around the story that holds everyone.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-thanksgiving.webp`,
    "/gifts/family-reunion"
  ],
  [
    "New Baby",
    "For welcoming a child into a living family story.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-new-baby.webp`,
    "/real-examples/10-new-baby"
  ],
  [
    "Graduation",
    "For sending someone forward with roots.",
    `${finalHomepageAsset}/03_homepage/occasions/occasion-graduation.webp`,
    "/real-examples/08-graduation"
  ]
] as const;

const homeFaq = [
  ["Is this an official coat of arms?", "No. It is a personalized heritage-inspired symbolic keepsake."],
  ["Is the collection private?", "Yes. It is private by default and made for personal family keeping."],
  [
    "Can I give it as a gift?",
    "Yes. It is designed for parents, grandparents, and meaningful family moments."
  ],
  [
    "When will it be delivered?",
    "Founder Edition collections are normally reviewed and delivered within two business days after payment."
  ],
  ["Is anything shipped?", "No. This is a personalized digital collection with no physical delivery."]
] as const;

const receives = [
  [
    "Family Legacy Certificate",
    "The primary frameable keepsake, created for personal presentation, printing, and gifting.",
    `${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`
  ],
  [
    "Final Crest",
    "One finished crest artwork shaped around the recipient, occasion, and family meaning.",
    `${finalHomepageAsset}/04_homepage/features/feature-house-identity.webp`
  ],
  [
    "Family Story",
    "A warm narrative that helps parents feel recognized instead of merely represented.",
    `${finalHomepageAsset}/04_homepage/features/feature-family-story.webp`
  ],
  [
    "Meaning Behind Your Crest",
    "A clear explanation of why this crest was created for the family.",
    `${finalHomepageAsset}/04_homepage/features/feature-symbol-guide.webp`
  ],
  [
    "Private Collection Vault",
    "A protected delivery space for receiving the finished collection.",
    `${finalHomepageAsset}/04_homepage/features/feature-private-vault.webp`
  ],
  [
    "Complete Collection",
    "A single archive containing the finished crest and keepsake documents in reading order.",
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
    "We shape values, culture, symbols, and story into one private digital collection.",
    `${finalHomepageAsset}/05_homepage/steps/step-02-we-create.webp`
  ],
  [
    "3",
    "Founder Review",
    "Each Early Access collection is checked before its private delivery is released.",
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
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  };

  return (
    <main className="home-premium">
      <StructuredData data={faqJsonLd} />
      <FunnelStepTracker stepName="landing_page" metadata={{ page: "/" }} />
      <section className="home-hero">
        <div className="home-shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Founder Edition · Limited Early Access</p>
            <h1>A personalized family legacy gift for someone you love.</h1>
            <p className="home-hero-subtext">
              One frameable Family Legacy Certificate, its Final Crest, two supporting
              publications, and a Complete Collection archive, prepared from the family details
              you share and reviewed before delivery. Limited to the first 25 Founder Edition
              orders.
            </p>
            <div className="home-cta-row">
              <Link className="home-button home-button-primary" href="/create">
                Create Your Legacy
              </Link>
              <Link className="home-button home-button-secondary" href="/family-legacy-collection">
                View Collections
              </Link>
              <Link className="home-button home-button-secondary" href="/real-examples">
                See Real Examples
              </Link>
            </div>
            <div className="home-hero-trust" aria-label="Trust highlights">
              <span>Private by default</span>
              <span>Symbolic keepsake</span>
              <span>Founder reviewed</span>
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
                alt="Personalized Family Legacy Collection with a final crest and keepsake documents"
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
            {occasions.map(([title, description, icon, href]) => (
              <Link className="home-card home-occasion-card" href={href} key={title}>
                <HomeAsset className="home-card-visual" src={icon} size={220} />
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
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
          <p>
            Founder Edition is a personalized digital collection, normally delivered within two
            business days after payment and review. Support will review delivery defects,
            incorrect recipient details, and refund eligibility under our published policy.
          </p>
          <Link className="home-button home-button-primary" href="/create">
            Start Your Legacy Journey
          </Link>
        </div>
      </section>

      <section className="home-section home-faq" id="faq">
        <div className="home-shell">
          <h2>FAQ</h2>
          <div className="home-faq-list">
            {homeFaq.map(([question, answer]) => (
              <div key={question}>
                <span>{question}</span>
                <strong>{answer}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
