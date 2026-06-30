import React from "react";

import { AdminPage, PermissionNotice } from "../../../components/admin-page";

export default function AdminSettingsPage() {
  return (
    <AdminPage title="Settings" description="MFA-ready admin settings placeholder. No real production auth provider integration in MVP.">
      <PermissionNotice role="viewer" minimum="admin" />
      <p className="notice">Payment status cannot be manually marked paid. Manifest cannot be manually marked completed.</p>
    </AdminPage>
  );
}
