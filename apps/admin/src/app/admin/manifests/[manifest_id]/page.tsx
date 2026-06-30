import { AdminPage, ReasonedAction } from "../../../../components/admin-page";

export default async function AdminManifestPage({ params }: { params: Promise<{ manifest_id: string }> }) {
  const { manifest_id: manifestId } = await params;
  return (
    <AdminPage title={`Manifest ${manifestId}`} description="Manifest completion cannot be manually marked completed. Retry failed assets first.">
      <div className="card"><p>missing required assets: download_package_zip · ZIP readiness: blocked</p></div>
      <ReasonedAction label="Retry failed assets" minimumRole="admin" currentRole="admin" costWarning />
    </AdminPage>
  );
}
