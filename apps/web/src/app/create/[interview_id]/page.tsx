import type { Metadata } from "next";

import { InterviewFlow } from "../../../components/interview-flow";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function InterviewPage({ params }: { params: Promise<{ interview_id: string }> }) {
  const { interview_id: interviewId } = await params;
  return (
    <main className="premium-page create-page">
      <InterviewFlow interviewId={interviewId} />
    </main>
  );
}
