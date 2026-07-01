import type { Metadata } from "next";

import { AdminDebugShell, AdminTable, formatDate, StatusPill } from "../_components/admin-debug-shell";
import { getAdminAccess, getRecentDownloadTokens } from "../../../lib/admin-debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function AdminDownloadTokensPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const access = getAdminAccess(params);
  const tokens = access.authorized ? await getRecentDownloadTokens() : [];

  return (
    <AdminDebugShell access={access} active="download-tokens">
      <div className="journey-card admin-debug-card">
        <p className="eyebrow">Private vault access</p>
        <h2>Download tokens</h2>
        <p className="notice">
          Only token hash prefixes are shown. Raw vault tokens are never stored or displayed.
        </p>
        <AdminTable
          columns={[
            "Order",
            "Token hash prefix",
            "Status",
            "Created",
            "Expires",
            "Revoked",
            "Assets",
            "Downloads"
          ]}
          rows={tokens.map((token) => [
            token.order_number,
            token.token_hash_prefix,
            <StatusPill key="status" value={token.status} />,
            formatDate(token.created_at),
            formatDate(token.expires_at),
            formatDate(token.revoked_at),
            String(token.asset_count),
            String(token.download_count)
          ])}
        />
      </div>
    </AdminDebugShell>
  );
}
