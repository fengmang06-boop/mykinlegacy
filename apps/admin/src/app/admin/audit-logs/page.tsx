import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminAuditLogsPage() {
  return (
    <AdminPage title="Audit Logs" description="Admin mutations and private preview actions write audit records. Logs avoid PII and raw secrets.">
      <DataTable rows={[{ action: "admin_login", actor: "admin_01", entity: "admin_session", reason: "login" }]} />
    </AdminPage>
  );
}
