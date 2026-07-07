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
      intro="This refund policy explains how personalized digital goods are reviewed after purchase."
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
          title: "How to request review",
          body: "Contact support with your order number and a clear description of the delivery or quality issue."
        }
      ]}
    />
  );
}
