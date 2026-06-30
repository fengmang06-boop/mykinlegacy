import { AdminPage, DataTable, DetailLink } from "../../../components/admin-page";

export default function AdminPromptTemplatesPage() {
  return (
    <AdminPage title="Prompt Templates" description="Active versions cannot be edited. Draft versions require validation before activation.">
      <DataTable rows={[{ id: "prompt_01", code: "crest_image", active_version: "version_01", locale: "en" }]} />
      <p><DetailLink href="/admin/prompt-templates/prompt_01">Open prompt_01</DetailLink></p>
    </AdminPage>
  );
}
