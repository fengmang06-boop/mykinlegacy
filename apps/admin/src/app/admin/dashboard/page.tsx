import React from "react";

import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminDashboardPage() {
  return (
    <AdminPage title="Dashboard" description="Operational summary for stuck orders, failed jobs, delivery failures, and provider placeholders.">
      <div className="grid">
        <div className="card"><h2>Paid stuck &gt; 30m</h2><p>0</p></div>
        <div className="card"><h2>Failed jobs</h2><p>0</p></div>
        <div className="card"><h2>DLQ count</h2><p>0</p></div>
        <div className="card"><h2>Email failures</h2><p>0</p></div>
      </div>
      <DataTable rows={[{ metric: "orders_completed_today", value: 0 }, { metric: "revenue_today_cents", value: 0 }]} />
    </AdminPage>
  );
}
