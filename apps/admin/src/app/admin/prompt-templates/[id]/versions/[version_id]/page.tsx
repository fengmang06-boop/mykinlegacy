import { AdminPage, ReasonedAction } from "../../../../../../components/admin-page";

export default async function AdminPromptVersionPage({ params }: { params: Promise<{ id: string; version_id: string }> }) {
  const { id, version_id: versionId } = await params;
  return (
    <AdminPage title={`Prompt Version ${versionId}`} description={`Template ${id}. Active prompt version is read-only.`}>
      <div className="card">
        <p>disclaimer present: true</p>
        <p>image text generation enabled: false</p>
        <p>raw prompt hidden unless role has permission</p>
      </div>
      <ReasonedAction label="Activate prompt version" minimumRole="admin" currentRole="admin" />
    </AdminPage>
  );
}
