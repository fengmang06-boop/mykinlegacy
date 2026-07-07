import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Digital Delivery | MyKinLegacy",
  description:
    "How MyKinLegacy delivers personalized digital heritage-inspired artwork, PDFs, ZIP files, and Download Vault access.",
  path: "/digital-delivery"
});

export default function DigitalDeliveryPage() {
  return (
    <PolicyPage
      eyebrow="Digital delivery"
      title="Digital Delivery"
      intro="MyKinLegacy delivers personalized collections digitally through a secure Download Vault."
      sections={[
        {
          title: "What is delivered",
          body: "The package includes crest-inspired PNG files, transparent artwork, symbolic explanation PDF, certificate PDF, family story PDF, and ZIP package."
        },
        {
          title: "Download Vault",
          body: "Customers receive token-protected vault access. Tokens can expire, be revoked, or be reissued by support after review."
        },
        {
          title: "Email delivery",
          body: "Delivery email contains a vault link, not signed asset URLs. Email logs do not store raw download tokens."
        },
        {
          title: "No shipping",
          body: "This digital delivery does not include printed goods, frames, shipping, customs, or physical fulfillment."
        }
      ]}
    />
  );
}
