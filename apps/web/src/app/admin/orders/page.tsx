import type { Metadata } from "next";
import Link from "next/link";

import { AdminDebugShell, AdminTable, formatDate, StatusPill } from "../_components/admin-debug-shell";
import { getAdminAccess, getRecentOrders } from "../../../lib/admin-debug";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const access = getAdminAccess(params);
  const orders = access.authorized ? await getRecentOrders() : [];

  return (
    <AdminDebugShell access={access} active="orders">
      <div className="journey-card admin-debug-card">
        <p className="eyebrow">Recent orders</p>
        <h2>Orders</h2>
        <p className="notice">
          Read-only view. Customer PII and raw vault tokens are not displayed.
        </p>
        <AdminTable
          columns={[
            "Order",
            "Created",
            "Payment",
            "Order",
            "Fulfillment",
            "Assets",
            "Vault",
            "Total",
            "Status page"
          ]}
          rows={orders.map((order) => [
            order.order_number,
            formatDate(order.created_at),
            <StatusPill key="payment" value={order.payment_status} />,
            <StatusPill key="order" value={order.order_status} />,
            <StatusPill key="fulfillment" value={order.fulfillment_status} />,
            `${order.generated_asset_count || order.asset_count} / ${
              order.expected_asset_count || order.asset_count
            }`,
            <StatusPill key="vault" value={order.download_ready ? "ready" : "not ready"} />,
            order.total,
            <Link key="status" href={`/order-status/${order.order_number}`}>
              Open
            </Link>
          ])}
        />
      </div>
    </AdminDebugShell>
  );
}
