import { AlertTriangle, CheckCircle2, Database, ShieldCheck } from "lucide-react";
import { checkEtsyEnv } from "@/lib/integrations/etsy/env-check";
import { fetchConnectedShop } from "@/lib/integrations/etsy/client";
import { getEtsySyncStatus } from "@/lib/integrations/etsy/sync-read-only";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

function status(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "None";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "None" : date.toLocaleString();
}

export default async function EtsyConnectionPage() {
  const env = checkEtsyEnv();
  const syncStatus = await getEtsySyncStatus();
  let connectedShop: { userId: string; shopId: string; shopName: string } | null = syncStatus.shop?.etsyShopId
    ? { userId: process.env.ETSY_USER_ID ?? "Unknown", shopId: syncStatus.shop.etsyShopId, shopName: syncStatus.shop.name }
    : null;
  let connectedShopError: string | null = null;

  if (env.readyForReadOnlySync) {
    try {
      connectedShop = await fetchConnectedShop();
    } catch (error) {
      connectedShopError = error instanceof Error ? error.message : String(error);
    }
  }

  const connected = Boolean(connectedShop);
  const lastSync = syncStatus.lastSync;
  const warnings = [...env.warnings, ...(connectedShopError ? [connectedShopError] : [])];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Etsy Dashboard</h1>
          <p>Read-only Etsy Open API v3 sync for local analytics. Etsy listings and orders are never modified.</p>
        </div>
        <div className="button-row">
          <SyncButton disabled={!env.readyForReadOnlySync} />
          <a className="button secondary" href="/api/etsy/status">
            Status JSON
          </a>
        </div>
      </div>

      <section className="grid metrics">
        <div className="metric">
          <span>Connection</span>
          <strong className={connected ? "ok-text" : "warn-text"}>{connected ? "Connected" : "Not connected"}</strong>
        </div>
        <div className="metric">
          <span>Listings</span>
          <strong>{syncStatus.counts.listings}</strong>
        </div>
        <div className="metric">
          <span>Recent Orders</span>
          <strong>{syncStatus.counts.receipts}</strong>
        </div>
        <div className="metric">
          <span>Transactions</span>
          <strong>{syncStatus.counts.transactions}</strong>
        </div>
      </section>

      <section className="grid metrics" style={{ marginTop: 16 }}>
        <div className="metric">
          <span>Images</span>
          <strong>{syncStatus.counts.images}</strong>
        </div>
        <div className="metric">
          <span>Inventory Records</span>
          <strong>{syncStatus.counts.inventory}</strong>
        </div>
        <div className="metric">
          <span>Last Sync</span>
          <strong className="compact-value">{formatDate(lastSync?.finishedAt)}</strong>
        </div>
        <div className="metric">
          <span>Sync Status</span>
          <strong className="compact-value">{lastSync?.status ?? syncStatus.state?.status ?? "Not run"}</strong>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Connected Shop</h2>
          <div className="connection-line">
            {connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <strong>{connectedShop?.shopName ?? "No Etsy shop connected"}</strong>
          </div>
          <div className="detail-grid">
            <p><span className="label">Shop ID</span><br />{connectedShop?.shopId ?? "None"}</p>
            <p><span className="label">User ID</span><br />{connectedShop?.userId ?? "None"}</p>
            <p><span className="label">API Mode</span><br />{env.apiMode}</p>
            <p><span className="label">Token Exists</span><br />{status(env.tokenPresent)}</p>
          </div>
        </div>

        <div className="panel">
          <h2>Read-only Guard</h2>
          <div className="row-head">
            <span><ShieldCheck size={16} /> Etsy Write Protection</span>
            <strong>{env.readOnlySafetyEnabled ? "Enabled" : "Disabled"}</strong>
          </div>
          <p className="muted">Sync uses Etsy GET endpoints only. Local database writes are allowed; Etsy shop writes are blocked.</p>
          <div className="row-head">
            <span><Database size={16} /> Local Database</span>
            <strong>{syncStatus.counts.listings + syncStatus.counts.receipts + syncStatus.counts.transactions} records</strong>
          </div>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Latest Sync</h2>
          <div className="detail-grid">
            <p><span className="label">Listings Pulled</span><br />{lastSync?.listingsPulled ?? 0}</p>
            <p><span className="label">Images Pulled</span><br />{lastSync?.imagesPulled ?? 0}</p>
            <p><span className="label">Inventory Pulled</span><br />{lastSync?.inventoryPulled ?? 0}</p>
            <p><span className="label">Receipts Pulled</span><br />{lastSync?.receiptsPulled ?? 0}</p>
            <p><span className="label">Transactions Pulled</span><br />{lastSync?.transactionsPulled ?? 0}</p>
            <p><span className="label">Finished</span><br />{formatDate(lastSync?.finishedAt)}</p>
          </div>
          <p className="muted">{lastSync?.message ?? "No Etsy sync has run yet."}</p>
        </div>

        <div className="panel">
          <h2>Sync Errors</h2>
          <pre>{lastSync?.errors ?? syncStatus.state?.error ?? "No Etsy API sync errors recorded."}</pre>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Missing Fields</h2>
          <div className="chips">
            {env.missingFields.length ? env.missingFields.map((field) => <span className="chip" key={field}>{field}</span>) : <span className="chip">none</span>}
          </div>
        </div>
        <div className="panel">
          <h2>Warnings</h2>
          <div className="list">
            {warnings.length ? warnings.map((warning) => <p className="muted" key={warning}>{warning}</p>) : <p className="muted">No warnings.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
