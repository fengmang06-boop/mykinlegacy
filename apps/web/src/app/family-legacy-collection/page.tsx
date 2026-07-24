import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import "../collection.css";

import { FunnelStepTracker } from "../../components/funnel-tracker";
import { StructuredData } from "../../components/structured-data";
import { publicMetadata, SITE_URL } from "../../lib/seo";

const assets = "/assets/final-homepage";

export const metadata: Metadata = publicMetadata({
  title: "Personalized Family Legacy Collection | MyKinLegacy",
  description:
    "Turn their real family story into a Final Crest, Heritage Certificate, Family Story, meaning guide, and private digital Complete Collection.",
  path: "/family-legacy-collection",
  image: "/assets/showcase-collections/01-father-retirement/final-crest.png"
});

const deliverables = [
  {
    number: "01",
    name: "Final Crest",
    purpose: "The visual summary of the memories, values, places, and relationships you share.",
    format: "High-resolution digital artwork",
    boundary: "One finished Final Crest—not a set of random variations.",
    image: `${assets}/02_homepage/hero/hero-main-crest.webp`,
    alt: "Approved Final Crest artwork from a MyKinLegacy collection"
  },
  {
    number: "02",
    name: "Heritage Certificate",
    purpose: "A formal collection record designed for personal printing and family presentation.",
    format: "Printable digital certificate",
    boundary: "Printing and framing are arranged separately.",
    image: `${assets}/02_homepage/hero/hero-heritage-certificate.webp`,
    alt: "Approved Heritage Certificate presentation"
  },
  {
    number: "03",
    name: "Family Story",
    purpose: "A written narrative shaped from the people, memories, and meaning behind the gift.",
    format: "Private digital publication",
    boundary: "It does not invent family history or genealogy.",
    image: `${assets}/02_homepage/hero/hero-family-story.webp`,
    alt: "Approved Family Story cover"
  },
  {
    number: "04",
    name: "Meaning Behind Your Crest",
    purpose: "The design basis and symbol rationale that explain why each major element belongs.",
    format: "Private digital meaning guide",
    boundary: "It is not a claim of inherited or official arms.",
    image: `${assets}/02_homepage/hero/hero-symbol-guide.webp`,
    alt: "Approved Meaning Behind Your Crest cover"
  },
  {
    number: "05",
    name: "Complete Collection",
    purpose: "The five-part collection organized for downloading, sharing privately, and keeping.",
    format: "Private Vault delivery",
    boundary: "No physical product is shipped.",
    image: `${assets}/02_homepage/hero/hero-private-vault.webp`,
    alt: "Approved private Vault presentation"
  }
] as const;

const examples = [
  {
    title: "Father Retirement",
    occasion: "Retirement",
    evidence: "Steady work, protection, sacrifice, and integrity",
    meaning: "Responsibility and quiet family protection",
    symbol: "Rooted tree within a classic shield",
    href: "/real-examples/01-father-retirement",
    image: "/assets/showcase-collections/01-father-retirement/final-crest.png"
  },
  {
    title: "Parents Anniversary",
    occasion: "50th anniversary",
    evidence: "Love held through every season of family life",
    meaning: "Unity, continuity, and shared legacy",
    symbol: "Tree, roots, shield, and botanical support",
    href: "/real-examples/20-parents-anniversary",
    image: "/assets/showcase-collections/20-parents-anniversary/final-crest.png"
  },
  {
    title: "Grandfather Legacy",
    occasion: "Legacy gift",
    evidence: "Immigration, resilience, guidance, and a new home",
    meaning: "Hope carried forward across generations",
    symbol: "Lantern within an archival frame",
    href: "/real-examples/06-grandfather-legacy",
    image: "/assets/showcase-collections/06-grandfather-legacy/final-crest.png"
  },
  {
    title: "Wedding Gift",
    occasion: "Wedding",
    evidence: "Two people beginning a shared family future",
    meaning: "Unity, direction, faith, and the road ahead",
    symbol: "Compass and medallion structure",
    href: "/real-examples/03-wedding-gift",
    image: "/assets/showcase-collections/03-wedding-gift/final-crest.png"
  }
] as const;

const faqs = [
  [
    "What exactly is included?",
    "One Final Crest, one Heritage Certificate, one Family Story, one Meaning Behind Your Crest, and one Complete Collection delivered through a private Vault."
  ],
  [
    "Is this only a crest image?",
    "No. The crest is the visual center; the written story, certificate, meaning guide, and organized Complete Collection form the full record."
  ],
  [
    "Is anything shipped physically?",
    "No. Delivery is digital. Printing and framing are arranged separately by the customer."
  ],
  [
    "Can we print the files?",
    "Yes. The collection includes files prepared for personal printing. The customer chooses the printer, paper, size, and frame."
  ],
  [
    "How is the design personalized?",
    "The design is shaped from the recipient, occasion, memories, places, values, and traditions you provide. Major symbols must connect back to that evidence."
  ],
  [
    "Is this an official family crest?",
    "No. It is contemporary symbolic artwork, not official or inherited arms."
  ],
  [
    "Do you research genealogy?",
    "No. MyKinLegacy does not certify ancestry or provide genealogical proof."
  ],
  [
    "Can siblings contribute together?",
    "Yes. Adult siblings or relatives can gather memories and details together before one person completes the guided form."
  ],
  [
    "What information should we prepare?",
    "Prepare the recipient and occasion details, memories, meaningful places, values, traditions, and any optional text or photos the guided flow supports."
  ],
  [
    "How is the collection delivered?",
    "After creation and Founder review, the digital collection is released privately through the customer Vault."
  ],
  [
    "How long does creation take?",
    "Founder Edition collections are normally reviewed and delivered within two business days after payment. Clarification or recovery needs can extend that timing."
  ],
  [
    "What happens before final delivery?",
    "The collection is checked through Founder review before release. Support handles delivery defects and correction requests under the published policies."
  ]
] as const;

export default function FamilyLegacyCollectionPage() {
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Personalized Family Legacy Collection",
    description:
      "Turn their real family story into a Final Crest, Heritage Certificate, Family Story, meaning guide, and private digital Complete Collection.",
    url: `${SITE_URL}/family-legacy-collection`,
    isPartOf: { "@type": "WebSite", name: "MyKinLegacy", url: SITE_URL }
  };
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "MyKinLegacy Family Legacy Collection",
    description:
      "A personalized digital family keepsake with one Final Crest, Heritage Certificate, Family Story, Meaning Behind Your Crest, Complete Collection, and private Vault delivery.",
    image: `${SITE_URL}${assets}/02_homepage/hero/hero-main-crest.webp`,
    brand: { "@type": "Brand", name: "MyKinLegacy" },
    category: "Personalized digital family gift",
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/create`,
      priceCurrency: "USD",
      price: "49.00",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition"
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Delivery",
        value: "Digital delivery through a private Vault"
      },
      { "@type": "PropertyValue", name: "Review", value: "Founder reviewed before release" },
      { "@type": "PropertyValue", name: "Physical shipping", value: "Not included" }
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

  return (
    <main className="collection-v2">
      <StructuredData data={[webPageJsonLd, productJsonLd, breadcrumbJsonLd]} />
      <FunnelStepTracker
        stepName="collection_page"
        metadata={{ page: "/family-legacy-collection", product_code: "family_legacy_collection" }}
      />

      <section className="cv2-hero" aria-labelledby="collection-title">
        <div className="cv2-shell cv2-hero-grid">
          <div className="cv2-hero-copy">
            <p className="cv2-kicker">A modern family archive · made as a meaningful gift</p>
            <h1 id="collection-title">
              A complete family legacy collection, shaped from their real story.
            </h1>
            <p className="cv2-lead">
              Not just a crest image. One private digital collection turns the memories, values,
              places, and relationships you share into a Final Crest—and the written record behind
              it.
            </p>
            <div className="cv2-trust-line" aria-label="Collection details">
              <strong>USD $49</strong>
              <span>Digital collection</span>
              <span>Founder reviewed</span>
              <span>Private delivery</span>
            </div>
            <div className="cv2-actions">
              <Link className="cv2-button" href="/create">
                Begin Their Legacy
              </Link>
              <Link className="cv2-button cv2-button-secondary" href="/real-examples">
                View Real Examples
              </Link>
            </div>
            <p className="cv2-delivery-note">
              Digital collection. No physical shipping included. Printing and framing arranged
              separately.
            </p>
            <p className="cv2-includes">
              <strong>Includes:</strong> Final Crest · Heritage Certificate · Family Story · Meaning
              Behind Your Crest · Complete Collection
            </p>
          </div>
          <figure
            className="cv2-suite"
            aria-label="The complete five-part Family Legacy Collection"
          >
            <div className="cv2-suite-paper cv2-suite-story">
              <Image
                src={`${assets}/02_homepage/hero/hero-family-story.webp`}
                width={560}
                height={560}
                alt="Approved Family Story cover"
              />
              <span className="cv2-suite-label">Family Story</span>
            </div>
            <div className="cv2-suite-paper cv2-suite-meaning">
              <Image
                src={`${assets}/02_homepage/hero/hero-symbol-guide.webp`}
                width={560}
                height={560}
                alt="Approved Meaning Behind Your Crest cover"
              />
              <span className="cv2-suite-label">Meaning Behind Your Crest</span>
            </div>
            <div className="cv2-suite-paper cv2-suite-certificate">
              <Image
                src={`${assets}/02_homepage/hero/hero-heritage-certificate.webp`}
                width={560}
                height={560}
                alt="Approved Heritage Certificate presentation"
              />
              <span className="cv2-suite-label">Heritage Certificate</span>
            </div>
            <div className="cv2-suite-crest">
              <Image
                src="/assets/showcase-collections/01-father-retirement/final-crest.png"
                width={760}
                height={760}
                alt="Approved Father Retirement Final Crest with a rooted tree"
                priority
              />
            </div>
            <figcaption>
              <strong>The Complete Collection</strong>
              <span>Five connected deliverables · one private Vault</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="cv2-section cv2-ivory" aria-labelledby="not-just-a-crest">
        <div className="cv2-shell cv2-editorial-grid">
          <div>
            <p className="cv2-kicker">The product, clearly</p>
            <h2 id="not-just-a-crest">
              The crest is the visual center. The collection is the complete record.
            </h2>
            <p className="cv2-copy">
              A single emblem can be meaningful, but it cannot explain where the symbols came from
              or preserve the story that made them matter. The five parts work together as one
              private family archive.
            </p>
          </div>
          <ol className="cv2-index-list">
            {deliverables.map((item) => (
              <li key={item.name}>
                <span>{item.number}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.purpose}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cv2-section cv2-evergreen" aria-labelledby="personal-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">Evidence creates the design</p>
          <div className="cv2-section-heading">
            <h2 id="personal-title">Personal because every major choice needs a reason.</h2>
            <p>
              We do not choose symbols at random, paste in a surname, invent family history, or rely
              on one generic template.
            </p>
          </div>
          <ol className="cv2-evidence-flow" aria-label="Evidence to design process">
            {[
              "Family input",
              "Evidence",
              "Meaning",
              "Symbol choice",
              "Composition",
              "Final Crest",
              "Written explanation"
            ].map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
          <div className="cv2-case-basis">
            <Image
              src="/assets/showcase-collections/01-father-retirement/final-crest.png"
              width={760}
              height={760}
              alt="Father Retirement approved Final Crest"
            />
            <div>
              <p className="cv2-kicker">Approved case · Father Retirement</p>
              <h3>Design Basis</h3>
              <p>
                Supplied themes of steady work, protection, sacrifice, and integrity establish the
                emotional center.
              </p>
              <h3>Symbol Rationale</h3>
              <p>
                The rooted tree carries continuity and responsibility; the shield frames protection;
                laurel recognizes a working life without turning it into rank or inherited status.
              </p>
              <Link href="/real-examples/01-father-retirement">Read the complete case →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-paper" aria-labelledby="complete-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">See the complete collection</p>
          <div className="cv2-section-heading">
            <h2 id="complete-title">Five real deliverables. Each has a different job.</h2>
            <p>
              Approved product imagery shows the real structure without exposing private customer
              text or inventing document pages.
            </p>
          </div>
          <div className="cv2-deliverables">
            {deliverables.map((item) => (
              <article key={item.name}>
                <div className="cv2-deliverable-image">
                  <Image src={item.image} width={760} height={560} alt={item.alt} />
                </div>
                <div className="cv2-deliverable-copy">
                  <span>{item.number}</span>
                  <h3>{item.name}</h3>
                  <p>{item.purpose}</p>
                  <dl>
                    <div>
                      <dt>Format</dt>
                      <dd>{item.format}</dd>
                    </div>
                    <div>
                      <dt>Boundary</dt>
                      <dd>{item.boundary}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-ivory" aria-labelledby="examples-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">Real examples · different evidence, different result</p>
          <div className="cv2-section-heading">
            <h2 id="examples-title">See why each design became what it is.</h2>
            <p>
              These examples focus on the reasoning behind the outcome—not a repeated gallery of
              attractive crests.
            </p>
          </div>
          <div className="cv2-examples">
            {examples.map((example) => (
              <article key={example.title}>
                <Image
                  src={example.image}
                  width={640}
                  height={640}
                  alt={`${example.title} approved Final Crest`}
                />
                <div>
                  <p className="cv2-kicker">{example.occasion}</p>
                  <h3>{example.title}</h3>
                  <dl>
                    <div>
                      <dt>Evidence</dt>
                      <dd>{example.evidence}</dd>
                    </div>
                    <div>
                      <dt>Leading meaning</dt>
                      <dd>{example.meaning}</dd>
                    </div>
                    <div>
                      <dt>Primary symbol</dt>
                      <dd>{example.symbol}</dd>
                    </div>
                  </dl>
                  <Link href={example.href}>View the full case →</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-burgundy" aria-labelledby="fit-title">
        <div className="cv2-shell cv2-fit-grid">
          <div>
            <p className="cv2-kicker">Who it is for</p>
            <h2 id="fit-title">
              For the person whose story is harder to honor with another object.
            </h2>
            <div className="cv2-fit-list">
              {[
                "Parents",
                "Grandparents",
                "Father retirement",
                "Anniversary",
                "Wedding",
                "Family reunion",
                "Family who has everything",
                "Long-distance family",
                "Adult siblings giving together"
              ].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
          <aside>
            <p className="cv2-kicker">It may not be the right fit if you need</p>
            <ul>
              <li>an instant, automatically generated image</li>
              <li>a physically shipped product</li>
              <li>official heraldry or genealogical proof</li>
              <li>a low-cost bulk favor or promotional item</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="cv2-section cv2-paper" aria-labelledby="process-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">How the collection is created</p>
          <h2 id="process-title">From what your family knows to a collection they can keep.</h2>
          <ol className="cv2-process">
            {[
              "Tell us who it is for",
              "Share memories, places, and values",
              "Evidence is interpreted",
              "The collection is created",
              "Founder review",
              "Private Vault delivery"
            ].map((x, i) => (
              <li key={x}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h3>{x}</h3>
              </li>
            ))}
          </ol>
          <div className="cv2-prepare">
            <h3>What to prepare</h3>
            <p>
              Recipient details · Occasion · Memories · Meaningful places · Values · Traditions ·
              Optional photos or written material when supported by the guided flow
            </p>
            <p>
              Founder Edition collections are normally reviewed and delivered within two business
              days after payment. Clarification or recovery needs can extend that timing.
            </p>
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-evergreen" aria-labelledby="delivery-title">
        <div className="cv2-shell cv2-delivery-grid">
          <div>
            <p className="cv2-kicker">Digital delivery experience</p>
            <h2 id="delivery-title">
              Private delivery built for families who may not live in one place.
            </h2>
            <p>
              The Complete Collection is released through a private Vault. Download the files,
              preserve backups, share private copies with family, and choose your own printing or
              framing approach.
            </p>
            <div className="cv2-actions">
              <Link className="cv2-text-link" href="/digital-delivery">
                Digital delivery policy →
              </Link>
              <Link className="cv2-text-link" href="/support">
                Support →
              </Link>
            </div>
          </div>
          <div className="cv2-vault-card">
            <Image
              src={`${assets}/04_homepage/features/feature-private-vault.webp`}
              width={760}
              height={520}
              alt="Approved private Vault presentation"
            />
            <ul>
              <li>Digital files for download and private archiving</li>
              <li>No international shipping dependency</li>
              <li>Personal printing choices stay with the family</li>
              <li>Customer-managed backups are recommended</li>
              <li>Printing, framing, and physical fulfillment are separate</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-ivory" aria-labelledby="trust-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">Trust and boundaries</p>
          <h2 id="trust-title">Clear about what the collection is—and what it is not.</h2>
          <div className="cv2-trust-grid">
            {[
              ["Founder reviewed", "Each Founder Edition is reviewed before private release."],
              [
                "Private by default",
                "Inputs and finished private files are not placed in a public gallery."
              ],
              [
                "Contemporary symbolism",
                "The artwork is newly created symbolic design, not inherited or official arms."
              ],
              [
                "No genealogy claim",
                "MyKinLegacy does not certify ancestry or genealogical proof."
              ],
              [
                "Secure delivery",
                "Access is provided through the customer’s private delivery flow."
              ],
              [
                "Clear support",
                "Delivery defects and correction requests follow the published support and refund policies."
              ]
            ].map(([title, copy]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className="cv2-policy-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/digital-delivery">Digital Delivery</Link>
            <Link href="/refund-policy">Refund Policy</Link>
            <Link href="/support">Support</Link>
            <Link href="/disclaimer">Disclaimer</Link>
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-price-section" aria-labelledby="price-title">
        <div className="cv2-shell cv2-price-card">
          <div>
            <p className="cv2-kicker">Founder Edition</p>
            <h2 id="price-title">One complete, Founder-reviewed family archive.</h2>
            <p className="cv2-price">USD $49</p>
            <p>One-time payment · Digital delivery · Private Vault · No physical shipping</p>
          </div>
          <div>
            <ul>
              {deliverables.map((x) => (
                <li key={x.name}>{x.name}</li>
              ))}
            </ul>
            <p>Printing and framing arranged separately.</p>
            <div className="cv2-actions">
              <Link className="cv2-button" href="/create">
                Begin Their Legacy
              </Link>
              <Link className="cv2-button cv2-button-secondary" href="/real-examples">
                View Real Examples
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="cv2-section cv2-paper" id="collection-faq" aria-labelledby="faq-title">
        <div className="cv2-shell cv2-faq-layout">
          <div>
            <p className="cv2-kicker">Questions before you begin</p>
            <h2 id="faq-title">Family Legacy Collection FAQ</h2>
            <p>Plain answers about the product, personalization, delivery, and boundaries.</p>
          </div>
          <div className="cv2-faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="cv2-final" aria-labelledby="final-title">
        <div className="cv2-shell">
          <p className="cv2-kicker">A gift they can recognize themselves in</p>
          <h2 id="final-title">Give their story a form the whole family can keep.</h2>
          <p>USD $49 · Digital delivery · Founder reviewed</p>
          <div className="cv2-actions">
            <Link className="cv2-button" href="/create">
              Begin Their Legacy
            </Link>
            <Link className="cv2-button cv2-button-secondary" href="/real-examples">
              View Real Examples
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
