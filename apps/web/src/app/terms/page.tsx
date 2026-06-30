import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Terms of Service | MyKinLegacy",
  description:
    "MVP terms draft for MyKinLegacy digital delivery, AI-generated symbolic designs, accountless checkout, and customer responsibilities.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms"
      title="Terms of Service"
      intro="These MVP terms describe use of the MyKinLegacy digital heritage collection service."
      sections={[
        {
          title: "Digital product",
          body: "The Family Legacy Collection is a digital product delivered through a Download Vault. No physical shipping is included in the MVP product."
        },
        {
          title: "Customer inputs",
          body: "Customers are responsible for providing accurate, lawful, and appropriate surname, heritage, value, symbol, color, style, and motto inputs."
        },
        {
          title: "Symbolic nature",
          body: "Generated designs are personalized, AI-generated, heritage-inspired symbolic designs and are not official, legally granted, or historically certified arms."
        },
        {
          title: "Service availability",
          body: "Generation, download links, and email delivery may occasionally require retry or support review."
        }
      ]}
    />
  );
}
