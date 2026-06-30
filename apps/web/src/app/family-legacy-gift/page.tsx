import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Family Legacy Gift | MyKinLegacy",
  description:
    "Design a private family legacy gift with AI-generated symbolic crest artwork, family story, certificate, and digital delivery.",
  path: "/family-legacy-gift"
});

export default function FamilyLegacyGiftPage() {
  return (
    <SeoLandingPage
      eyebrow="Family legacy gift"
      title="Turn family values into a lasting digital legacy gift"
      description="Capture surname, origins, values, symbols, and motto language in a private Family Legacy Collection."
      highlights={["Family values captured", "Legacy story PDF", "Personal symbolic certificate"]}
      faq={[
        {
          question: "Who is this for?",
          answer: "Families looking for a personal, symbolic, digital keepsake or meaningful gift."
        },
        {
          question: "Does it verify genealogy?",
          answer: "No. It is not genealogy verification or heraldic certification."
        },
        {
          question: "Where does the CTA go?",
          answer: "Start with the guided form or review the Family Legacy Collection page."
        }
      ]}
    />
  );
}
