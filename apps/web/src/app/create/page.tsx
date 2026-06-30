import type { Metadata } from "next";

import { CreateStart } from "../../components/create-start";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default function CreatePage() {
  return (
    <main className="premium-page create-page">
      <CreateStart />
    </main>
  );
}
