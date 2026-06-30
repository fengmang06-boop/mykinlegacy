import { AdminPage, DetailLink, ReasonedAction } from "../../../../components/admin-page";

export default async function AdminPromptTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage title={`Prompt Template ${id}`} description="Global disclaimer cannot be removed. Image text generation cannot be enabled as MVP default.">
      <p><DetailLink href={`/admin/prompt-templates/${id}/versions/version_01`}>Open active version</DetailLink></p>
      <ReasonedAction label="Create draft version" minimumRole="admin" currentRole="admin" />
    </AdminPage>
  );
}
