import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Heritage Design Disclaimer | MyKinLegacy",
  description:
    "MyKinLegacy creates personalized AI-generated heritage-inspired symbolic designs, not official or legally granted coats of arms.",
  path: "/disclaimer"
});

export default function DisclaimerPage() {
  return (
    <PolicyPage
      eyebrow="Disclaimer"
      title="Heritage Design Disclaimer"
      intro="MyKinLegacy focuses on personal symbolism, storytelling, and digital design delivery."
      sections={[
        {
          title: "Not official arms",
          body: "The service does not grant, register, certify, or verify official coats of arms, family crests, heraldic rights, noble status, or ancestral entitlement."
        },
        {
          title: "AI-generated design",
          body: "Artwork, story, and explanations are generated from customer inputs and curated rules as heritage-inspired symbolic creative output."
        },
        {
          title: "Historical limits",
          body: "Any heritage or symbolism language is interpretive and should not be treated as genealogical proof or historical certification."
        },
        {
          title: "Personal use",
          body: "Delivered files are intended for personal gifting, printing, family archiving, and private display."
        }
      ]}
    />
  );
}
