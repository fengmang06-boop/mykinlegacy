import { AdminPage, DataTable } from "../../../components/admin-page";

export default function AdminSystemHealthPage() {
  return (
    <AdminPage title="System Health" description="Provider mode and infrastructure checks. Redis depth is placeholder when Redis is unavailable.">
      <DataTable rows={[
        { check: "api", status: "ok" },
        { check: "worker_registered_queues", status: "15 known queues" },
        { check: "db_connection", status: "placeholder" },
        { check: "redis_connection", status: "placeholder" },
        { check: "email_provider_mode", status: "mock" },
        { check: "storage_provider_mode", status: "local_private" }
      ]} />
    </AdminPage>
  );
}
