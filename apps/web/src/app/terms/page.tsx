import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Terms of Service | MyKinLegacy",
  description:
    "Terms for MyKinLegacy digital delivery, symbolic keepsake preparation, accountless checkout, and customer responsibilities.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms"
      title="Terms of Service"
      intro="These terms describe use of the MyKinLegacy digital heritage collection service."
      sections={[
        {
          title: "Digital product",
          body: "The Family Legacy Collection is a digital product delivered through a private vault. No physical shipping is included."
        },
        {
          title: "Customer inputs",
          body: "Customers are responsible for providing accurate, lawful, and appropriate surname, heritage, value, symbol, color, style, and motto inputs."
        },
        {
          title: "Symbolic nature",
          body: "Delivered designs are personalized, heritage-inspired symbolic keepsakes. They are not official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records."
        },
        {
          title: "Service availability",
          body: "Generation, download links, and email delivery may occasionally require retry or support review."
        }
      ]}
    />
  );
}
