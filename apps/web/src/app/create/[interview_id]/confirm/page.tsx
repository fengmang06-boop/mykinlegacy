import type { Metadata } from "next";

import { ConfirmFlow } from "../../../../components/confirm-flow";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function ConfirmPage({ params }: { params: Promise<{ interview_id: string }> }) {
  const { interview_id: interviewId } = await params;
  return (
    <main>
      <ConfirmFlow interviewId={interviewId} />
    </main>
  );
}
