import type { Metadata } from "next";

import { CreateStart } from "../../components/create-start";

export const metadata: Metadata = {
  title: "Create a Family Legacy Collection | MyKinLegacy",
  description:
    "Begin the private guided interview for a personalized MyKinLegacy Family Legacy Collection.",
  alternates: { canonical: "https://mykinlegacy.com/create" },
  robots: { index: false, follow: false }
};

export default function CreatePage() {
  return (
    <main className="premium-page create-page">
      <CreateStart />
    </main>
  );
}
