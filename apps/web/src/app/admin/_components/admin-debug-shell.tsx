import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminAccess } from "../../../lib/admin-debug";

export function AdminDebugShell({
  access,
  active,
  children
}: {
  access: AdminAccess;
  active: "founder-edition" | "orders" | "email-logs" | "download-tokens";
  children: ReactNode;
}) {
  const tokenParam = access.token ? `?token=${encodeURIComponent(access.token)}` : "";
  const links = [
    { key: "founder-edition", label: "Founder Edition", href: `/admin/founder-edition${tokenParam}` },
    { key: "orders", label: "Orders", href: `/admin/orders${tokenParam}` },
    { key: "email-logs", label: "Email Logs", href: `/admin/email-logs${tokenParam}` },
    { key: "download-tokens", label: "Download Tokens", href: `/admin/download-tokens${tokenParam}` }
  ] as const;

  return (
    <main className="premium-page admin-debug-page">
      <section className="premium-hero admin-debug-hero">
        <div className="section">
          <p className="eyebrow">Internal founder debug</p>
          <h1>MyKinLegacy Transaction Monitor</h1>
          <p className="lead">
            Temporary read-only check pages for reviewing orders, log-mode email delivery, and
            token-protected vault readiness.
          </p>
          <nav className="admin-debug-tabs" aria-label="Admin debug navigation">
            {links.map((link) => (
              <Link
                aria-current={active === link.key ? "page" : undefined}
                href={link.href}
                key={link.key}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <section className="premium-section">
        <div className="section">
          {access.authorized ? (
            children
          ) : (
            <div className="journey-card admin-locked-card">
              <p className="eyebrow">Protected</p>
              <h2>Admin debug access is locked</h2>
              <p>
                {access.reason ??
                  "Add the internal admin token to the URL to view this page."}
              </p>
              <p className="notice">
                These pages intentionally do not show raw vault tokens, secrets, or full customer
                PII. They are temporary Founder testing views, not the final admin dashboard.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function AdminTable({
  columns,
  rows
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td data-label={columns[cellIndex]} key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const state =
    normalized.includes("completed") ||
    normalized.includes("paid") ||
    normalized.includes("active") ||
    normalized.includes("sent")
      ? "complete"
      : normalized.includes("failed") || normalized.includes("revoked")
        ? "failed"
        : "pending";

  return (
    <span className="admin-status-pill" data-state={state}>
      {value}
    </span>
  );
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  });
}
