import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Symbolic Family Crest | MyKinLegacy",
  description:
    "Create a symbolic family crest-inspired design package based on family values, colors, animals, motto, and heritage style.",
  path: "/symbolic-family-crest"
});

export default function SymbolicFamilyCrestPage() {
  return (
    <SeoLandingPage
      eyebrow="Symbolic family crest"
      title="A symbolic family crest shaped by values and story"
      description="Build a heritage-inspired collection that explains chosen symbols clearly without claiming official heraldic status."
      highlights={["Values-first symbols", "Animal and color meanings", "Clear heritage disclaimer"]}
      faq={[
        {
          question: "Why symbolic instead of official?",
          answer: "Official arms can involve legal and historical rules; this product is personal symbolism."
        },
        {
          question: "Are symbols explained?",
          answer: "Yes. The collection includes symbolic explanations in PDF deliverables."
        },
        {
          question: "Can I include a motto?",
          answer: "Yes. Motto text is handled in supporting files rather than generated inside AI images."
        }
      ]}
    />
  );
}
