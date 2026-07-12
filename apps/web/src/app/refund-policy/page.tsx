import type { Metadata } from "next";

import { PolicyPage } from "../../components/policy-page";
import { publicMetadata } from "../../lib/seo";

export const metadata: Metadata = publicMetadata({
  title: "Refund Policy | MyKinLegacy",
  description:
    "Refund policy for personalized digital MyKinLegacy heritage-inspired collections and download delivery status.",
  path: "/refund-policy"
});

export default function RefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Refund policy"
      title="Refund Policy"
      intro="Founder Edition orders are personalized digital goods. Support reviews cancellation, correction, and refund requests individually under the terms below."
      sections={[
        {
          title: "Before generation",
          body: "If payment is captured but generation has not started, support may review cancellation or refund eligibility."
        },
        {
          title: "After digital delivery",
          body: "Because files are personalized digital goods, refunds after successful generation and vault delivery may be limited unless there is a delivery or technical failure."
        },
        {
          title: "Failed generation",
          body: "If required assets cannot be generated or delivered after retries, support may offer regeneration, replacement files, or refund review."
        },
        {
          title: "Corrections and satisfaction review",
          body: "Incorrect recipient or occasion details, missing files, broken files, and delivery defects are eligible for correction review. Subjective redesign requests are considered individually and do not include unlimited revisions."
        },
        {
          title: "How to request review",
          body: "Contact support with your order number and a clear description of the delivery or quality issue."
        }
      ]}
    />
  );
}
