import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FunnelStepTracker } from "../../components/funnel-tracker";
import { StructuredData } from "../../components/structured-data";
import { publicMetadata, SITE_URL } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Legacy Collection Examples | MyKinLegacy",
  description:
    "Explore clearly labeled illustrative design studies showing how different family evidence can create different symbolic directions.",
  path: "/real-examples",
  image: "/assets/examples-v2/finished/migration-journey-finished-v2.png"
});

const studies = [
  {
    id: "father-retirement",
    type: "Father Retirement",
    title: "A working life, expressed without rank or inherited status",
    shared: "A coastal workshop, forty years of craft, Sunday repairs, and the desks he built for each child.",
    meaning: "Steady care and craftsmanship",
    primary: "Hand plane and open horizon",
    supporting: "Bench, coastline, restrained brass",
    treatment: "Open landscape · oak and navy · asymmetric",
    optional: "No gemstone or celestial element",
    rationale: "The working object leads because it comes directly from the supplied memory; the open horizon marks retirement as a transition.",
    art: "craft",
    tone: "px2-study-oak",
    evidenceRefs: ["coastal workshop", "forty years of craft", "desks built for each child"],
    gemstoneEvidence: "Not requested; no gemstone is included.",
    celestialEvidence: "Not requested; no celestial element is included.",
    artwork: {
      src: "/assets/examples-v2/finished/craftsmanship-retirement-finished-v2.png",
      width: 1536,
      height: 1024,
      alt: "Finished illustrative craftsmanship study with an aged-oak joinery frame, engraved hand plane, workshop horizon, and four crafted family objects",
      assetLayer: "PUBLIC_FINISHED_STUDY",
      silhouette: "architectural horizontal frame",
      background: "warm parchment and aged oak",
      usesShield: false,
      usesTree: false,
      asymmetric: true
    }
  },
  {
    id: "parents-anniversary",
    type: "Parents Anniversary",
    title: "A shared table becomes the center of continuity",
    shared: "Fifty years together, weekly family suppers, two teachers, and a familiar serving bowl.",
    meaning: "Unity through repeated acts of welcome",
    primary: "Shared bowl in a circular composition",
    supporting: "Two chairs, waterline, linen texture",
    treatment: "Medallion · sage and ivory · radial",
    optional: "Pearl accent only when explicitly confirmed",
    rationale: "The composition grows from the family ritual—not from a surname template or a generic symbol of marriage.",
    art: "anniversary",
    tone: "px2-study-sage",
    evidenceRefs: ["fifty years together", "weekly family suppers", "familiar serving bowl"],
    gemstoneEvidence: "Pearl and ruby-like accents are conditional on explicit family confirmation.",
    celestialEvidence: "Not requested; no celestial element is included.",
    artwork: {
      src: "/assets/examples-v2/finished/generations-anniversary-finished-v2.png",
      width: 1024,
      height: 1536,
      alt: "Finished illustrative anniversary study with two bronze botanical forms joining through a shared serving bowl, pearl accents, and restrained ruby inlays",
      assetLayer: "PUBLIC_FINISHED_STUDY",
      silhouette: "open dual botanical form",
      background: "light parchment and restrained wine",
      usesShield: false,
      usesTree: false,
      asymmetric: false
    }
  },
  {
    id: "migration-journey",
    type: "Migration / Journey",
    title: "Two ports and one new home shape an open passage",
    shared: "A restaurant family, two languages kept at home, a travel trunk, and twenty years in a new country.",
    meaning: "Hope carried across distance",
    primary: "Travel route through an architectural arch",
    supporting: "Two port lines, trunk detail, north point",
    treatment: "Layered passage · sea blue and copper · directional",
    optional: "North star only when confirmed by the family",
    rationale: "The route and arch express movement and arrival; no ancestry, nationality, or destiny is inferred beyond what was shared.",
    art: "journey",
    tone: "px2-study-sea",
    evidenceRefs: ["two locations", "travel trunk", "twenty years in a new country"],
    gemstoneEvidence: "Sapphire enamel is a material direction, not a claimed gemstone effect.",
    celestialEvidence: "The guiding star appears only when explicitly confirmed by the family.",
    artwork: {
      src: "/assets/examples-v2/finished/migration-journey-finished-v2.png",
      width: 1254,
      height: 1254,
      alt: "Finished illustrative migration study with an open sapphire medallion, two location markers, a winding path, homeward threshold, and guiding compass star",
      assetLayer: "PUBLIC_FINISHED_STUDY",
      silhouette: "open circular medallion",
      background: "deep sapphire mineral blue",
      usesShield: false,
      usesTree: false,
      asymmetric: true
    }
  },
  {
    id: "birthstone-family",
    type: "Birthstone / Family Members",
    title: "Four confirmed stones map relationships, not predictions",
    shared: "A parent, three adult children, an annual stone-sorting ritual, and four explicitly selected birthstones.",
    meaning: "Distinct people held in one family orbit",
    primary: "Four-point specimen arrangement",
    supporting: "Desert line, matte brass, generous negative space",
    treatment: "Open orbit · sand and gemstone accents · asymmetric",
    optional: "Birthstones are identifiers, never scientific or predictive claims",
    rationale: "Each stone is included only because the family chose it; the composition avoids a generic central jewel or horoscope reading.",
    art: "birthstone",
    tone: "px2-study-jewel",
    evidenceRefs: ["parent and three adult children", "annual stone-sorting ritual", "four explicitly selected birthstones"],
    gemstoneEvidence: "Four stones are included only through explicit family selection and map to four named family members.",
    celestialEvidence: "Not requested; no celestial element is included.",
    artwork: {
      src: "/assets/examples-v2/finished/family-birthstones-finished-v2.png",
      width: 1024,
      height: 1536,
      alt: "Finished illustrative family-members study with four distinct carved stones integrated into one interwoven ivory, rose, pearl, and bronze botanical structure",
      assetLayer: "PUBLIC_FINISHED_STUDY",
      silhouette: "organic interwoven vertical form",
      background: "warm ivory and rose mineral",
      usesShield: false,
      usesTree: false,
      asymmetric: true
    }
  }
] as const;

function FinishedStudyArtwork({
  study,
  compact = false,
  priority = false
}: {
  study: (typeof studies)[number];
  compact?: boolean;
  priority?: boolean;
}) {
  return (
    <div
      className={`px2-finished-study px2-finished-${study.art} ${compact ? "px2-finished-study-compact" : ""}`}
      data-asset-layer={study.artwork.assetLayer}
    >
      <Image
        src={study.artwork.src}
        width={study.artwork.width}
        height={study.artwork.height}
        alt={study.artwork.alt}
        sizes={compact ? "(max-width: 600px) 42vw, 220px" : "(max-width: 900px) 82vw, 520px"}
        priority={priority}
      />
    </div>
  );
}

const comparison = [
  ["Silhouette", "Open landscape", "Circular medallion", "Architectural passage", "Open orbit"],
  ["Primary evidence", "Craft object", "Family ritual", "Migration route", "Confirmed stones"],
  ["Composition", "Asymmetric horizon", "Radial table", "Layered direction", "Distributed cluster"],
  ["Material", "Oak + brass", "Linen + silver", "Map paper + copper", "Stone + matte brass"],
  ["Emotional tone", "Grounded", "Warm", "Hopeful", "Luminous"]
] as const;

export default function ExamplesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Examples", item: `${SITE_URL}/real-examples` }
    ]
  };

  return (
    <main className="phase2-page px2-examples">
      <StructuredData data={breadcrumbJsonLd} />
      <FunnelStepTracker stepName="real_examples" metadata={{ page: "/real-examples" }} />

      <section className="px2-examples-hero">
        <div className="px2-shell px2-examples-hero-grid">
          <div>
            <p className="px2-kicker">Examples · truthfully labeled</p>
            <h1>No two family stories should look the same.</h1>
            <p className="px2-lede">
              These are illustrative design studies—not customer stories. They show how people,
              memories, places, materials, and explicitly chosen symbols can lead to distinct
              Family Legacy Collection directions.
            </p>
            <div className="px2-actions">
              <Link className="px2-button" href="/create">Begin Their Legacy</Link>
              <Link className="px2-button px2-button-secondary" href="/family-legacy-collection">See the Complete Collection</Link>
            </div>
          </div>
          <div className="px2-hero-directions" aria-label="Three illustrative design directions">
            <figure className="px2-featured-art">
              <FinishedStudyArtwork study={studies[2]} priority />
              <figcaption><span>Illustrative Design Study</span><strong>Migration / Journey</strong><small>Sapphire · open passage · not a real customer case</small></figcaption>
            </figure>
            <div className="px2-hero-previews">
              <figure><FinishedStudyArtwork study={studies[3]} compact /><figcaption>Family Members / Birthstones</figcaption></figure>
              <figure><FinishedStudyArtwork study={studies[0]} compact /><figcaption>Craftsmanship / Retirement</figcaption></figure>
            </div>
            <p className="px2-synthetic-note">
              A fictional design study created to demonstrate how different family information may lead to different symbolic directions.
            </p>
          </div>
        </div>
      </section>

      <section className="px2-section px2-paper">
        <div className="px2-shell px2-evidence-intro">
          <div>
            <p className="px2-kicker">Evidence before ornament</p>
            <h2>The story controls the composition.</h2>
          </div>
          <p>
            A major element needs a traceable family detail or an explicit preference. Gemstones,
            celestial references, and faith symbols stay out unless the family requests them.
            Founder review checks the final direction before delivery.
          </p>
          <ol>
            <li><span>01</span>What was shared</li>
            <li><span>02</span>Dominant meaning</li>
            <li><span>03</span>Symbol language</li>
            <li><span>04</span>Composition</li>
            <li><span>05</span>Founder review</li>
          </ol>
        </div>
      </section>

      <section className="px2-section px2-ivory" aria-labelledby="study-grid-title">
        <div className="px2-shell">
          <div className="px2-heading">
            <p className="px2-kicker">Four different directions</p>
            <h2 id="study-grid-title">Not one badge with four names.</h2>
            <p>Each study changes silhouette, hierarchy, material, palette, density, and emotional tone.</p>
          </div>
          <div className="px2-study-grid">
            {studies.map((study, index) => (
              <article className={`px2-study ${study.tone}`} key={study.id}>
                <div className="px2-study-image">
                  <FinishedStudyArtwork study={study} />
                </div>
                <div className="px2-study-copy">
                  <p className="px2-truth-label">Illustrative Design Study · 0{index + 1}</p>
                  <h3>{study.type}</h3>
                  <strong>{study.title}</strong>
                  <dl>
                    <div><dt>What was shared</dt><dd>{study.shared}</dd></div>
                    <div><dt>Dominant meaning</dt><dd>{study.meaning}</dd></div>
                    <div><dt>Primary symbol</dt><dd>{study.primary}</dd></div>
                    <div><dt>Supporting language</dt><dd>{study.supporting}</dd></div>
                    <div><dt>Material and color</dt><dd>{study.treatment}</dd></div>
                    <div><dt>Optional element</dt><dd>{study.optional}</dd></div>
                  </dl>
                  <div className="px2-rationale"><span>Symbol rationale</span><p>{study.rationale}</p></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px2-section px2-forest">
        <div className="px2-shell">
          <div className="px2-heading">
            <p className="px2-kicker">Compare the directions</p>
            <h2>Difference is structural—not a color swap.</h2>
          </div>
          <div className="px2-comparison" role="table" aria-label="Comparison of four illustrative design directions">
            {comparison.map((row) => (
              <div role="row" key={row[0]}>
                {row.map((cell, index) => <span role={index === 0 ? "rowheader" : "cell"} key={cell}>{cell}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px2-section px2-paper">
        <div className="px2-shell px2-related-collection">
          <div>
            <p className="px2-kicker">The direction continues beyond the artwork</p>
            <h2>Every study belongs to a five-part collection.</h2>
            <p>
              The Final Crest is paired with a Heritage Certificate, Family Story, Meaning Behind
              Your Crest, and organized Complete Collection. Private Vault is the delivery method,
              not a sixth deliverable.
            </p>
          </div>
          <div className="px2-document-row" aria-label="Related Collection pieces">
            <div><span>Heritage Certificate</span></div>
            <div><span>Family Story</span></div>
            <div><span>Meaning Behind Your Crest</span></div>
          </div>
        </div>
      </section>

      <section className="px2-final">
        <div className="px2-shell">
          <p className="px2-kicker">Your evidence sets the direction</p>
          <h2>Begin a collection no surname template could produce.</h2>
          <p>USD $49 · Founder reviewed · Private digital delivery · No physical shipping</p>
          <div className="px2-actions">
            <Link className="px2-button" href="/create">Begin Their Legacy</Link>
            <Link className="px2-button px2-button-secondary-light" href="/family-legacy-collection">What You Receive</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
