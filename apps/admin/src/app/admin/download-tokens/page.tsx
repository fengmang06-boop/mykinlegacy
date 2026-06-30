import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminDownloadTokensPage() {
  return (
    <AdminPage title="Download Tokens" description="Raw tokens are never displayed. Only partial token hash is shown.">
      <DataTable rows={[{ token_id: "download_token_01", hash: "abcd...7890", status: "active", downloads: "0/20", linked_assets: 3 }]} />
    </AdminPage>
  );
}
