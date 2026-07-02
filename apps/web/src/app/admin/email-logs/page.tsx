import type { Metadata } from "next";

import { AdminDebugShell, AdminTable, formatDate, StatusPill } from "../_components/admin-debug-shell";
import { emailProviderSummary, getAdminAccess, getRecentEmailLogs } from "../../../lib/admin-debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function AdminEmailLogsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const access = getAdminAccess(params);
  const logs = access.authorized ? await getRecentEmailLogs() : [];
  const emailMode = emailProviderSummary();

  return (
    <AdminDebugShell access={access} active="email-logs">
      <div className="journey-card admin-debug-card">
        <p className="eyebrow">Transactional delivery</p>
        <h2>Email logs</h2>
        <div className="admin-debug-summary">
          <span>Current email provider: {emailMode.provider}</span>
          <span>
            External email sending: {emailMode.externalSendingEnabled ? "enabled" : "disabled"}
          </span>
          <span>Delivery test mode: {emailMode.testMode ? "enabled" : "disabled"}</span>
          <span>
            Test recipient: {emailMode.testRecipientConfigured ? "configured" : "not configured"}
          </span>
        </div>
        <p className="notice">
          EMAIL_PROVIDER=log/mock means delivery is recorded for testing and no external email is
          sent. Real email requires EMAIL_PROVIDER=resend, RESEND_API_KEY, and a verified
          sender/domain.
        </p>
        <AdminTable
          columns={[
            "Order",
            "Provider",
            "Status",
            "Recipient",
            "Routing",
            "Subject",
            "Created",
            "Sent",
            "Vault metadata",
            "Error"
          ]}
          rows={logs.map((log) => [
            log.order_number,
            log.provider,
            <StatusPill key="status" value={log.status} />,
            log.recipient_masked,
            [
              `test=${log.delivery_test_mode ? "true" : "false"}`,
              `source=${log.recipient_source}`,
              `intended=${log.intended_recipient_masked}`,
              `actual=${log.actual_recipient_masked}`
            ].join("; "),
            log.subject,
            formatDate(log.created_at),
            formatDate(log.sent_at),
            log.delivery_metadata,
            log.error_message ?? "-"
          ])}
        />
      </div>
    </AdminDebugShell>
  );
}
