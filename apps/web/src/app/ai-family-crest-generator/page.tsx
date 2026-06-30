import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "AI Family Crest Generator | MyKinLegacy",
  description:
    "Generate a private AI family crest-inspired package with crest variants, symbolic meaning, story PDFs, and secure digital delivery.",
  path: "/ai-family-crest-generator"
});

export default function AiFamilyCrestGeneratorPage() {
  return (
    <SeoLandingPage
      eyebrow="AI family crest generator"
      title="AI-generated symbolic crest artwork for your family story"
      description="MyKinLegacy turns guided family details into a private heritage-inspired digital collection prepared for download, printing, and gifting."
      highlights={["AI crest variants", "Server-rendered PDF text", "No public gallery by default"]}
      faq={[
        {
          question: "Does the AI write text inside the crest image?",
          answer: "No. Names and mottos are rendered server-side in PDFs and supporting files."
        },
        {
          question: "Is a real AI provider required for staging?",
          answer: "No. MVP staging uses mock AI; production provider setup is separate."
        },
        {
          question: "Is this historically certified?",
          answer: "No. It is heritage-inspired symbolic artwork for personal use."
        }
      ]}
    />
  );
}
