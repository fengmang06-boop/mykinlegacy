import type { Metadata } from "next";
import Link from "next/link";

import { AdminDebugShell, AdminTable, formatDate, StatusPill } from "../_components/admin-debug-shell";
import { getAdminAccess, getRecentOrders } from "../../../lib/admin-debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
      <div className="journey-card admin-debug-card">
        <p className="eyebrow">Meaning Engine</p>
        <h2>Meaning Basis</h2>
        <p className="notice">
          Safe read-only summary. Customer PII, raw vault tokens, and secrets are not displayed.
        </p>
        <div className="admin-meaning-grid">
          {orders
            .filter((order) => order.meaning_profile)
            .slice(0, 6)
            .map((order) => {
              const meaning = order.meaning_profile;
              if (!meaning) return null;
              return (
                <article className="admin-meaning-card" key={order.order_id}>
                  <div>
                    <p className="eyebrow">{order.order_number}</p>
                    <h3>{meaning.source_level}</h3>
                    <StatusPill value={meaning.validation_valid ? "valid" : "review"} />
                  </div>
                  <div>
                    <strong>Themes</strong>
                    <p>
                      {meaning.themes
                        .map((theme) => `${theme.theme} (${theme.confidence})`)
                        .join(", ") || "No themes attached"}
                    </p>
                  </div>
                  <div>
                    <strong>Symbols</strong>
                    <p>
                      {meaning.symbols
                        .map((symbol) => `${symbol.symbol}: ${symbol.meaning}`)
                        .join("; ") || "No symbols attached"}
                    </p>
                  </div>
                  <div>
                    <strong>Story direction</strong>
                    <p>{meaning.story_direction || "Not attached yet."}</p>
                  </div>
                  <div>
                    <strong>Boundary</strong>
                    <p>{meaning.boundary_statement || "Missing boundary statement."}</p>
                  </div>
                  {meaning.quality_flags.length > 0 ? (
                    <div>
                      <strong>Quality flags</strong>
                      <p>{meaning.quality_flags.join(", ")}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          {orders.every((order) => !order.meaning_profile) ? (
            <p className="notice">
              No Meaning Engine profile is attached yet. Older orders remain readable and will show
              this empty state.
            </p>
          ) : null}
        </div>
      </div>
    </AdminDebugShell>
  );
}
