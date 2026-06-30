import { AdminPage, ReasonedAction } from "../../../../components/admin-page";

export default async function AdminGenerationJobDetailPage({ params }: { params: Promise<{ job_id: string }> }) {
  const { job_id: jobId } = await params;
  return (
    <AdminPage title={`Generation Job ${jobId}`} description="Raw rendered prompt is hidden from support, finance, and viewer roles.">
      <div className="card"><p>status: failed · max attempts: 3 · linked manifest: manifest_01</p></div>
      <ReasonedAction label="Retry generation job" minimumRole="admin" currentRole="admin" costWarning />
    </AdminPage>
  );
}
