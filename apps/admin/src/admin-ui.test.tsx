import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DashboardPage from "./app/admin/dashboard/page";
import SettingsPage from "./app/admin/settings/page";
import AssetDetailPage from "./app/admin/assets/[asset_id]/page";
import { ReasonedAction } from "./components/admin-page";
import { assertNoUnsafeAdminText, canMutate } from "./lib/rbac";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "app");

describe("admin UI operations pages", () => {
  it("required admin UI pages exist", async () => {
    const pagePaths = [
      "admin/login/page.tsx",
      "admin/dashboard/page.tsx",
      "admin/orders/page.tsx",
      "admin/orders/[order_id]/page.tsx",
      "admin/generation-jobs/page.tsx",
      "admin/generation-jobs/[job_id]/page.tsx",
      "admin/manifests/[manifest_id]/page.tsx",
      "admin/assets/page.tsx",
      "admin/assets/[asset_id]/page.tsx",
      "admin/download-tokens/page.tsx",
      "admin/email-logs/page.tsx",
      "admin/prompt-templates/page.tsx",
      "admin/prompt-templates/[id]/page.tsx",
      "admin/prompt-templates/[id]/versions/[version_id]/page.tsx",
      "admin/knowledge-library/page.tsx",
      "admin/audit-logs/page.tsx",
      "admin/system-health/page.tsx",
      "admin/settings/page.tsx"
    ];

    await Promise.all(pagePaths.map((pagePath) => access(join(appDir, pagePath))));
  });

  it("dashboard page renders basic structure", () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Failed jobs");
  });

  it("admin UI hides or disables mutation buttons for insufficient role", () => {
    expect(canMutate("viewer", "admin")).toBe(false);
    const html = renderToStaticMarkup(
      <ReasonedAction label="Retry generation job" minimumRole="admin" currentRole="viewer" />
    );
    expect(html).toContain("Permission required");
    expect(html).toContain("disabled");
  });

  it("settings page shows guardrails", () => {
    const html = renderToStaticMarkup(<SettingsPage />);
    expect(html).toContain("Payment status cannot be manually marked paid");
    expect(html).toContain("Manifest cannot be manually marked completed");
  });

  it("asset detail does not display raw token, public URL, or full storage key marker", async () => {
    const html = renderToStaticMarkup(
      await AssetDetailPage({ params: Promise.resolve({ asset_id: "asset_01" }) })
    );
    expect(assertNoUnsafeAdminText(html)).toBe(true);
    expect(html).toContain("orders/***/asset_01.png");
  });
});
