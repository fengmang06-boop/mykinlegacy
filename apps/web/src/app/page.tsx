import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { FunnelStepTracker } from "../components/funnel-tracker";
import { StructuredData } from "../components/structured-data";
import { TrackedCtaLink } from "../components/tracked-cta-link";
import { publicMetadata } from "../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Personalized Family Gift & Legacy Keepsake | MyKinLegacy",
  description:
    "Create a personalized family gift with one Final Crest, frameable certificate, Family Story, and private legacy collection for someone you love.",
  path: "/"
});

const assets = "/assets/final-homepage";
const examples = "/assets/showcase-collections";

const designStudies = [
  ["Father Retirement", "A working life interpreted through resilience, guidance, and home.", "01-father-retirement", "01-father-retirement"],
  ["Parents Anniversary", "A shared life shaped into symbols of continuity, devotion, and family.", "20-parents-anniversary", "20-parents-anniversary"],
  ["Grandparents", "The stories and values younger generations should still be able to revisit.", "06-grandfather-legacy", "06-grandfather-legacy"],
  ["Wedding", "Two histories meeting in one new family story.", "03-wedding-gift", "03-wedding-gift"],
  ["Family Reunion", "A gathering expressed through belonging, memory, and return.", "11-family-reunion", "11-family-reunion"],
  ["Christmas Family", "Tradition, gratitude, and the stories retold when everyone comes home.", "05-christmas-family", "05-christmas-family"]
] as const;

const faq = [
  ["Is this official heraldry?", "No. It is contemporary symbolic artwork, not inherited arms, official heraldry, or genealogical proof."],
  ["Is anything shipped?", "No. The Founder Edition is a digital collection. Printing and framing are arranged separately."],
  ["How is the collection delivered?", "After Founder review, the finished files are released privately through the Complete Collection vault."],
  ["Will our family details be public?", "No. Customer inputs are private by default and are not displayed publicly."]
] as const;

export default function HomePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  };

  return (
    <main className="home-v2">
      <StructuredData data={faqJsonLd} />
      <FunnelStepTracker stepName="landing_page" metadata={{ page: "/" }} />

      <section className="hv2-hero">
        <div className="hv2-shell hv2-hero-grid">
          <div className="hv2-hero-copy">
            <p className="hv2-kicker">A personalized digital Family Legacy Collection</p>
            <h1>Their story.<br />Made visible.</h1>
            <p className="hv2-lede">
              MyKinLegacy turns a family&apos;s real stories, values, people, places, and milestones
              into a personalized digital Family Legacy Collection.
            </p>
            <div className="hv2-offer-line" aria-label="Collection details">
              <strong>USD $49</strong><span>Digital collection</span><span>Founder reviewed</span><span>Private delivery</span>
            </div>
            <div className="hv2-actions">
              <TrackedCtaLink className="hv2-button hv2-primary" href="/create" trackingSource="homepage_hero">Begin Their Legacy</TrackedCtaLink>
              <Link className="hv2-button hv2-secondary" href="/real-examples">View Examples</Link>
            </div>
            <p className="hv2-disclosure">Digital collection. No physical shipping included.</p>
          </div>
          <div className="hv2-hero-product">
            <div className="hv2-hero-suite" aria-label="The complete Family Legacy Collection">
              <figure className="hv2-suite-item hv2-suite-certificate">
                <Image src={`${assets}/02_homepage/hero/hero-heritage-certificate.webp`} width={560} height={560} sizes="(max-width: 640px) 52vw, (max-width: 1000px) 44vw, 27vw" priority alt="Full Heritage Certificate presentation" />
                <figcaption>Heritage Certificate</figcaption>
              </figure>
              <div className="hv2-suite-supporting">
                <figure className="hv2-suite-item"><Image src={`${assets}/02_homepage/hero/hero-family-story.webp`} width={560} height={560} sizes="(max-width: 640px) 32vw, (max-width: 1000px) 25vw, 14vw" alt="Full Family Story cover" /><figcaption>Family Story</figcaption></figure>
                <figure className="hv2-suite-item"><Image src={`${assets}/02_homepage/hero/hero-symbol-guide.webp`} width={560} height={560} sizes="(max-width: 640px) 32vw, (max-width: 1000px) 25vw, 14vw" alt="Full Meaning Behind Your Crest cover" /><figcaption>Meaning Behind Your Crest</figcaption></figure>
                <figure className="hv2-suite-item hv2-suite-crest"><Image src="/review/official-asset-recovery/images/05a-compass-journey-medallion.png" width={900} height={900} sizes="(max-width: 640px) 25vw, (max-width: 1000px) 20vw, 11vw" alt="Illustrative journey Final Crest direction" /><figcaption>Final Crest</figcaption></figure>
              </div>
            </div>
            <div className="hv2-product-caption">
              <span>Inside the Complete Collection</span>
              <strong>Final Crest · Heritage Certificate · Family Story · Meaning Behind Your Crest · Complete Collection</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-recognition">
        <div className="hv2-shell">
          <div className="hv2-heading">
            <p className="hv2-kicker">Recognition, not another object</p>
            <h2>Ordinary gifts show what you bought.<br />A legacy collection shows what they meant.</h2>
          </div>
          <div className="hv2-editorial-scenes">
            {designStudies.slice(0, 3).map(([title, text, id, href], index) => (
              <Link className={`hv2-scene ${index === 0 ? "hv2-scene-main" : ""}`} href={`/real-examples/${href}`} key={id}>
                <Image src={`${examples}/${id}/final-crest.png`} width={700} height={700} sizes={index === 0 ? "(max-width: 800px) 90vw, 48vw" : "(max-width: 800px) 90vw, 24vw"} alt={`${title} illustrative Final Crest direction`} />
                <div><span>0{index + 1} · Illustrative Design Study</span><h3>{title}</h3><p>{text}</p><strong>View the design study →</strong></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-collection" id="collection">
        <div className="hv2-shell hv2-collection-grid">
          <div className="hv2-collection-visual">
            <Image src={`${assets}/04_homepage/features/feature-heritage-certificate.webp`} width={760} height={760} sizes="(max-width: 800px) 76vw, 37vw" alt="Heritage Certificate from the Complete Collection" />
            <Image src={`${assets}/04_homepage/features/feature-family-story.webp`} width={520} height={520} sizes="(max-width: 800px) 44vw, 22vw" alt="Family Story publication" />
            <Image src={`${assets}/04_homepage/features/feature-symbol-guide.webp`} width={520} height={520} sizes="(max-width: 800px) 44vw, 22vw" alt="Meaning Behind Your Crest publication" />
          </div>
          <div>
            <p className="hv2-kicker">The Complete Collection</p>
            <h2>More than a Crest. A finished family archive.</h2>
            <p className="hv2-intro">USD $49 includes five connected artifacts, each carrying a different part of the meaning.</p>
            <ol className="hv2-artifact-list">
              <li><b>01</b><div><h3>Final Crest</h3><p>The finished symbolic artwork that brings the family evidence together.</p></div></li>
              <li><b>02</b><div><h3>Heritage Certificate</h3><p>A frameable presentation of the recipient, dedication, and Final Crest.</p></div></li>
              <li><b>03</b><div><h3>Family Story</h3><p>A written narrative that recognizes the life and relationships behind the gift.</p></div></li>
              <li><b>04</b><div><h3>Meaning Behind Your Crest</h3><p>The explanation of why each major symbol belongs.</p></div></li>
              <li><b>05</b><div><h3>Complete Collection</h3><p>The private archive that keeps every finished file together.</p></div></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-evidence">
        <div className="hv2-shell">
          <div className="hv2-heading hv2-heading-narrow">
            <p className="hv2-kicker">Evidence creates the design</p>
            <h2>Every major symbol begins with something the family actually shared.</h2>
            <p>We do not randomly choose icons, add only a surname, or invent family history.</p>
          </div>
          <div className="hv2-evidence-flow">
            <div className="hv2-evidence-notes">
              <article><span>Family detail</span><strong>“He always found the way home, and helped everyone else do the same.”</strong></article>
              <article><span>Meaning</span><strong>Guidance · resilience · belonging</strong></article>
              <article><span>Symbol choice</span><strong>Compass · mountain path · rooted tree</strong></article>
            </div>
            <div className="hv2-evidence-crest">
              <Image src={`${examples}/01-father-retirement/final-crest.png`} width={720} height={720} sizes="(max-width: 800px) 70vw, 30vw" alt="Illustrative Father Retirement Final Crest showing evidence-led symbols" />
            </div>
            <div className="hv2-evidence-output">
              <article><b>Design Basis</b><p>The family inputs that anchor the visual direction.</p></article>
              <article><b>Symbol Rationale</b><p>The reason each selected symbol belongs.</p></article>
              <article><b>Family Story</b><p>The human meaning carried in written form.</p></article>
              <article><b>Meaning Behind Your Crest</b><p>A clear guide to reading the finished artwork.</p></article>
            </div>
          </div>
          <p className="hv2-boundary">This is contemporary symbolic artwork, not inherited arms, official heraldry, or genealogical proof.</p>
        </div>
      </section>

      <section className="hv2-section hv2-examples" id="examples">
        <div className="hv2-shell">
          <div className="hv2-heading hv2-heading-row">
            <div><p className="hv2-kicker">Illustrative design studies</p><h2>Different evidence. Distinctly different collections.</h2></div>
            <Link href="/real-examples">View All Examples →</Link>
          </div>
          <div className="hv2-example-grid">
            {designStudies.map(([title, text, id, href], index) => (
              <Link className={index === 0 ? "hv2-example-featured" : ""} href={`/real-examples/${href}`} key={id}>
                <Image src={`${examples}/${id}/final-crest.png`} width={760} height={760} sizes={index === 0 ? "(max-width: 760px) 90vw, 42vw" : "(max-width: 760px) 90vw, 23vw"} alt={`${title} illustrative collection direction`} />
                <div><h3>{title}</h3><p>{text}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-moments" id="gift-ideas">
        <div className="hv2-shell">
          <div className="hv2-heading"><p className="hv2-kicker">Made for meaningful moments</p><h2>Choose the relationship. We help reveal the meaning.</h2></div>
          <div className="hv2-moment-list">
            <Link href="/gifts/anniversary"><span>01</span><div><h3>Parents Anniversary</h3><p>How do you honor the family two people built over a lifetime?</p></div><b>For shared devotion and continuity →</b></Link>
            <Link href="/gifts/father-retirement"><span>02</span><div><h3>Retirement for Father</h3><p>What gift can recognize both his work and what he gave the family?</p></div><b>For guidance, resilience, and legacy →</b></Link>
            <Link href="/gifts/grandparents"><span>03</span><div><h3>Grandparents</h3><p>How do you preserve the stories everyone assumes they will remember?</p></div><b>For memory, wisdom, and belonging →</b></Link>
            <Link href="/gifts/wedding"><span>04</span><div><h3>Wedding</h3><p>What marks the beginning of a family without becoming another décor gift?</p></div><b>For two stories becoming one →</b></Link>
          </div>
          <p className="hv2-more-moments">Also made for <Link href="/gifts/family-reunion">Family Reunions</Link>, <Link href="/gifts/christmas-family">Christmas</Link>, <Link href="/real-examples/12-memorial">Memorials</Link>, and <Link href="/real-examples/17-adoption-day">New Families</Link>.</p>
        </div>
      </section>

      <section className="hv2-section hv2-process" id="how-it-works">
        <div className="hv2-shell">
          <div className="hv2-heading hv2-heading-narrow"><p className="hv2-kicker">How it works</p><h2>From the details you know to a collection they can keep.</h2><p>You provide the recipient, occasion, memories, values, and meaningful details. We handle the interpretation and presentation.</p></div>
          <ol className="hv2-journey">
            <li><span>01</span><h3>Tell us their story</h3><p>Share the people, moments, values, and details that matter.</p></li>
            <li><span>02</span><h3>We interpret the evidence</h3><p>Meaning becomes a coherent visual and written direction.</p></li>
            <li><span>03</span><h3>The collection is created</h3><p>The Crest and supporting documents are prepared together.</p></li>
            <li><span>04</span><h3>We build the composition</h3><p>Evidence, hierarchy, material, and tone become one coherent direction.</p></li>
            <li><span>05</span><h3>You review</h3><p>You can confirm the direction before the collection is finalized.</p></li>
            <li><span>06</span><h3>We refine and deliver</h3><p>Founder review precedes private delivery of the digital Complete Collection.</p></li>
          </ol>
        </div>
      </section>

      <section className="hv2-section hv2-trust" id="faq">
        <div className="hv2-shell hv2-trust-grid">
          <div><p className="hv2-kicker">Private by default</p><h2>Your family story belongs to your family.</h2><p>Inputs remain private, every Founder Edition receives review before release, and delivery happens digitally through a secure private vault.</p>
            <div className="hv2-trust-links"><Link href="/privacy">Privacy</Link><Link href="/digital-delivery">Digital Delivery</Link><Link href="/refund-policy">Refund Policy</Link><Link href="/support">Support</Link><Link href="/disclaimer">Disclaimer</Link></div>
          </div>
          <div className="hv2-faq">
            {faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="hv2-final">
        <div className="hv2-shell hv2-final-inner">
          <p className="hv2-kicker">A gift made from what matters</p>
          <h2>Give them a collection only their family could inspire.</h2>
          <p>One Founder-reviewed digital Family Legacy Collection · USD $49 · Private delivery</p>
          <div className="hv2-actions"><TrackedCtaLink className="hv2-button hv2-primary" href="/create" trackingSource="homepage_final_cta">Begin Their Legacy</TrackedCtaLink><Link className="hv2-button hv2-secondary" href="/real-examples">View Examples</Link></div>
          <small>No physical shipping included. Printing and framing are arranged separately.</small>
        </div>
      </section>
    </main>
  );
}
