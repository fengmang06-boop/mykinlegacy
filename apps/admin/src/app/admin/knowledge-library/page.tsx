import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminKnowledgeLibraryPage() {
  return (
    <AdminPage title="Knowledge Library" description="MVP allows internal curated and admin-created knowledge only. AI-suggested entries are not auto-approved.">
      <DataTable rows={[{ code: "lion", source: "internal_curated", confidence: "high", reviewed: "true", active: "true" }]} />
    </AdminPage>
  );
}
