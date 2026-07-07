import Link from "next/link";

import { BRAND_NAME, SUPPORT_EMAIL } from "../lib/seo";

export interface PolicyPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}

export function PolicyPage({ eyebrow, title, intro, sections }: PolicyPageProps) {
  return (
    <main>
      <section className="journey-shell">
        <div className="section">
          <div className="journey-card">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="lead">{intro}</p>
            <p className="notice">
              This page is provided for operational clarity and does not constitute legal advice.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid">
          {sections.map((section) => (
            <article className="card" key={section.title}>
              <h2>{section.title}</h2>
              <p className="muted">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="section">
          <h2>Core service disclaimer</h2>
          <p className="lead">
            {BRAND_NAME} provides personalized heritage-inspired symbolic keepsakes as a digital
            product. It is not an official coat of arms, legal heraldic grant, noble title claim, or
            certified genealogical record.
          </p>
          <p>
            Contact: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <Link className="secondary-button" href="/support">
            Visit Support
          </Link>
        </div>
      </section>
    </main>
  );
}
