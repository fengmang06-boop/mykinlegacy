import { AdminPage, ReasonedAction } from "../../../../components/admin-page";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ order_id: string }> }) {
  const { order_id: orderId } = await params;
  return (
    <AdminPage title={`Order ${orderId}`} description="Order detail hides raw tokens, raw prompts, public URLs, and full private HouseDNA by default.">
      <div className="grid">
        <div className="card"><h2>Status</h2><p>pending_payment / unpaid / not_started</p></div>
        <div className="card"><h2>Customer</h2><p>cu***@example.com</p></div>
        <div className="card"><h2>Package</h2><p>family_legacy_collection / core</p></div>
      </div>
      <div className="grid">
        <ReasonedAction label="Resend delivery email" minimumRole="support" currentRole="support" />
        <ReasonedAction label="Create download token" minimumRole="support" currentRole="support" />
      </div>
    </AdminPage>
  );
}
