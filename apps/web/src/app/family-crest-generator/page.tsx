import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Crest Generator | MyKinLegacy",
  description:
    "Create a private family crest-inspired digital collection with symbolic artwork, story PDFs, and secure vault delivery.",
  path: "/family-crest-generator"
});

export default function FamilyCrestGeneratorPage() {
  return (
    <SeoLandingPage
      eyebrow="Family crest generator"
      title="Create a symbolic family crest-inspired collection"
      description="Use your surname, heritage country, values, colors, animal symbols, motto, and preferred style to create a private digital collection."
      highlights={["Crest-inspired artwork", "Symbol explanations", "Private vault delivery"]}
      faq={[
        {
          question: "Is this an official family crest?",
          answer: "No. It is a personalized symbolic design, not official or legally granted arms."
        },
        {
          question: "What files are delivered?",
          answer: "PNG artwork, PDF explanations, certificate, family story, and a ZIP package."
        },
        {
          question: "Can I use this as a gift?",
          answer: "Yes. It is designed as a meaningful digital heritage-inspired gift."
        }
      ]}
    />
  );
}
