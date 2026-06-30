import React from "react";

import { AdminPage, ReasonedAction } from "../../../../components/admin-page";

export default async function AdminAssetDetailPage({ params }: { params: Promise<{ asset_id: string }> }) {
  const { asset_id: assetId } = await params;
  return (
    <AdminPage title={`Asset ${assetId}`} description="Storage key is masked. Preview uses a short-lived signed URL and writes audit log.">
      <div className="card"><p>file: crest-variant-1.png · masked key: orders/***/asset_01.png · no public URL</p></div>
      <div className="grid">
        <ReasonedAction label="Create preview URL" minimumRole="support" currentRole="support" />
        <ReasonedAction label="Revoke asset" minimumRole="admin" currentRole="admin" destructive />
      </div>
    </AdminPage>
  );
}
