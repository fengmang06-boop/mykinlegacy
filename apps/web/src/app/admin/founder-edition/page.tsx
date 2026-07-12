import type { Metadata } from "next";

import { AdminDebugShell, StatusPill } from "../_components/admin-debug-shell";
import { getAdminAccess, getFounderEditionDashboard } from "../../../lib/admin-debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function FounderEditionAdminPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const access = getAdminAccess(params);
  const dashboard = access.authorized ? await getFounderEditionDashboard() : null;

  return (
    <AdminDebugShell access={access} active="founder-edition">
      {dashboard ? (
        <div className="journey-card admin-debug-card">
          <p className="eyebrow">Controlled public launch</p>
          <h2>Founder Edition operations</h2>
          <p className="notice">
            Aggregate operating data only. Customer email, vault tokens, and personal answers are not shown.
          </p>
          <div className="admin-debug-summary">
            <span>Checkout: <StatusPill value={dashboard.checkout_enabled ? "enabled" : "paused"} /></span>
            <span>Founder review: <StatusPill value={dashboard.review_required ? "required" : "disabled"} /></span>
            <span>Paid orders: {dashboard.paid_orders} / {dashboard.order_limit}</span>
            <span>Remaining slots: {dashboard.remaining_slots}</span>
            <span>Tracked visitors: {dashboard.tracked_visitors}</span>
            <span>Examples visits: {dashboard.real_examples_visits}</span>
            <span>Questionnaire starts: {dashboard.questionnaire_starts}</span>
            <span>Checkout starts: {dashboard.checkout_starts}</span>
            <span>Successful deliveries: {dashboard.successful_deliveries}</span>
            <span>Vault opens: {dashboard.vault_opens}</span>
            <span>Downloads: {dashboard.downloads}</span>
            <span>Refunds: {dashboard.refunds}</span>
            <span>Pending Founder reviews: {dashboard.pending_founder_reviews}</span>
            <span>P0 issues: {dashboard.p0_issues}</span>
          </div>
        </div>
      ) : null}
    </AdminDebugShell>
  );
}
