import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminEmailLogsPage() {
  return (
    <AdminPage title="Email Logs" description="Recipient email is masked and payloads are sanitized.">
      <DataTable rows={[{ type: "delivery_ready", recipient: "cu***@example.com", provider: "mock", status: "sent", retries: 0 }]} />
    </AdminPage>
  );
}
