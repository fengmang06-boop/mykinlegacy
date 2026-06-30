import { AdminPage, DataTable, DetailLink } from "../../../components/admin-page";

export default function AdminOrdersPage() {
  return (
    <AdminPage title="Orders" description="Masked order list. Customer email is masked by default.">
      <DataTable rows={[{ order_id: "order_01", order_number: "AHL-20260629-DEMO", email: "cu***@example.com", payment: "unpaid", fulfillment: "not_started" }]} />
      <p><DetailLink href="/admin/orders/order_01">Open order_01</DetailLink></p>
    </AdminPage>
  );
}
