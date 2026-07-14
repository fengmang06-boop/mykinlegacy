import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Privacy Policy | MyKinLegacy",
  description:
    "Privacy policy for MyKinLegacy digital heritage collections, private storage, download vault access, and customer data handling.",
  path: "/privacy"
});

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="MyKinLegacy is private by default. We use customer inputs to create and deliver personalized digital heritage-inspired symbolic designs."
      sections={[
        {
          title: "Data we collect",
          body: "We may collect order details, customer email, guided interview answers, consent records, and operational logs needed to generate and deliver the digital collection."
        },
        {
          title: "Private by default",
          body: "Generated files are stored in private storage and delivered through a token-protected Download Vault. We do not publish collections to a public gallery by default."
        },
        {
          title: "AI provider usage",
          body: "Production providers should only use customer inputs for the current generation unless separate consent allows broader use."
        },
        {
          title: "Download access",
          body: "Download tokens are stored as hashes. Raw tokens are used only for delivery and are not stored in logs."
        },
        {
          title: "Privacy-safe measurement",
          body: "We use Google Analytics 4 to measure aggregate visits and key collection steps. We do not send recipient names, family memories, email addresses, raw order numbers, Vault tokens, or collection contents to Google Analytics, and advertising personalization signals are disabled."
        }
      ]}
    />
  );
}
