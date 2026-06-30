import { AdminPage, DataTable, DetailLink } from "../../../components/admin-page";

export default function AdminAssetsPage() {
  return (
    <AdminPage title="Assets" description="Private assets only. Public URLs are not exposed.">
      <DataTable rows={[{ asset_id: "asset_01", deliverable: "crest_variant_1_png", type: "image", status: "available", size_bytes: 1000 }]} />
      <p><DetailLink href="/admin/assets/asset_01">Open asset_01</DetailLink></p>
    </AdminPage>
  );
}
