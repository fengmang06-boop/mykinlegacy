import { AdminPage, DataTable, DetailLink } from "../../../components/admin-page";

export default function AdminGenerationJobsPage() {
  return (
    <AdminPage title="Generation Jobs" description="Queue and retry overview. Provider details are summarized.">
      <DataTable rows={[{ job_id: "job_01", queue: "ai-image-generation", status: "failed", retry_count: 1, error_code: "provider_timeout" }]} />
      <p><DetailLink href="/admin/generation-jobs/job_01">Open job_01</DetailLink></p>
    </AdminPage>
  );
}
