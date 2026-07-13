import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = {
  ...publicMetadata({
    title: "AI Family Crest Generator | MyKinLegacy",
    description:
      "Create a private family legacy collection with one final crest, symbolic meaning, story, and secure digital delivery.",
    path: "/ai-family-crest-generator"
  }),
  robots: { index: false, follow: true },
  alternates: { canonical: "https://mykinlegacy.com/symbolic-family-crest" }
};

export default function AiFamilyCrestGeneratorPage() {
  return (
    <SeoLandingPage
      eyebrow="Family legacy collection"
      title="A symbolic final crest for your family story"
      description="MyKinLegacy turns guided family details into a private heritage-inspired digital collection prepared for download, printing, and gifting."
      highlights={["One Final Crest", "Private archive documents", "No public gallery by default"]}
      faq={[
        {
          question: "Does the AI write text inside the crest image?",
          answer: "No. Names and mottos are rendered server-side in PDFs and supporting files."
        },
        {
          question: "Is a real AI provider required for staging?",
          answer: "No. The service creates personalized symbolic artwork from the details you provide."
        },
        {
          question: "Is this historically certified?",
          answer: "No. It is heritage-inspired symbolic artwork for personal use."
        }
      ]}
    />
  );
}
