import type { Metadata } from "next";

import { SeoLandingPage } from "../../components/seo-landing-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Heritage Gift | MyKinLegacy",
  description:
    "Create a meaningful digital heritage gift with symbolic crest artwork, family story PDFs, certificate, and private download vault.",
  path: "/heritage-gift"
});

export default function HeritageGiftPage() {
  return (
    <SeoLandingPage
      eyebrow="Heritage gift"
      title="A meaningful heritage gift for family moments"
      description="Create a personalized digital collection for weddings, anniversaries, holidays, family reunions, and legacy keepsakes."
      highlights={["Gift-ready PDF files", "Symbolic family story", "Secure digital delivery"]}
      faq={[
        {
          question: "Is this a physical gift?",
          answer: "No. The product is delivered digitally through a private Download Vault."
        },
        {
          question: "Can recipients print the files?",
          answer: "Yes. Delivered files are prepared for personal printing and safekeeping."
        },
        {
          question: "Is it private?",
          answer: "Yes. Collections are private by default and not added to a public gallery."
        }
      ]}
    />
  );
}
