import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mykinlegacy.com"),
  title: "MyKinLegacy Admin",
  description: "Admin operations MVP for MyKinLegacy.",
  robots: { index: false, follow: false },
  openGraph: null
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <h2>MyKinLegacy Admin</h2>
            <Link href="/admin/dashboard">Dashboard</Link>
            <Link href="/admin/orders">Orders</Link>
            <Link href="/admin/generation-jobs">Generation Jobs</Link>
            <Link href="/admin/assets">Assets</Link>
            <Link href="/admin/download-tokens">Download Tokens</Link>
            <Link href="/admin/email-logs">Email Logs</Link>
            <Link href="/admin/prompt-templates">Prompt Templates</Link>
            <Link href="/admin/knowledge-library">Knowledge Library</Link>
            <Link href="/admin/audit-logs">Audit Logs</Link>
            <Link href="/admin/system-health">System Health</Link>
            <Link href="/admin/settings">Settings</Link>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
