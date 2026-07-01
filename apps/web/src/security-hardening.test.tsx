import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => {
  const font = ({ variable = "" }: { variable?: string } = {}) => ({
    className: variable.replace("--", ""),
    variable
  });

  return {
    Cinzel: font,
    Cormorant_Garamond: font,
    Inter: font
  };
});

import { metadata as rootMetadata } from "./app/layout";
import robots from "./app/robots";
import sitemap from "./app/sitemap";
import { metadata as checkoutMetadata } from "./app/checkout/[order_number]/page";
import { metadata as createMetadata } from "./app/create/page";
import { metadata as createInterviewMetadata } from "./app/create/[interview_id]/page";
import { metadata as confirmMetadata } from "./app/create/[interview_id]/confirm/page";
import { metadata as downloadMetadata } from "./app/download/[token]/page";
import { metadata as orderStatusMetadata } from "./app/order-status/[order_number]/page";
import { metadata as paymentCancelMetadata } from "./app/payment/cancel/page";
import { metadata as paymentSuccessMetadata } from "./app/payment/success/page";
import { sanitizeAnalyticsPayload } from "./lib/analytics";

const appRoot = join(__dirname, "..");

describe("customer frontend security hardening", () => {
  it("keeps all private customer routes noindex", () => {
    for (const metadata of [
      createMetadata,
      createInterviewMetadata,
      confirmMetadata,
      checkoutMetadata,
      paymentSuccessMetadata,
      paymentCancelMetadata,
      orderStatusMetadata,
      downloadMetadata
    ]) {
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
    }
  });

  it("keeps public pages indexable in sitemap only", () => {
    const entries = sitemap().map((entry) => entry.url);
    expect(entries).toEqual([
      "https://mykinlegacy.com",
      "https://mykinlegacy.com/family-legacy-collection",
      "https://mykinlegacy.com/family-crest-generator",
      "https://mykinlegacy.com/ai-family-crest-generator",
      "https://mykinlegacy.com/heritage-gift",
      "https://mykinlegacy.com/family-legacy-gift",
      "https://mykinlegacy.com/symbolic-family-crest",
      "https://mykinlegacy.com/support",
      "https://mykinlegacy.com/privacy",
      "https://mykinlegacy.com/terms",
      "https://mykinlegacy.com/refund-policy",
      "https://mykinlegacy.com/digital-delivery",
      "https://mykinlegacy.com/disclaimer"
    ]);
    expect(entries.join(" ")).not.toContain("/create");
    expect(entries.join(" ")).not.toContain("/checkout");
    expect(entries.join(" ")).not.toContain("/download");
  });

  it("disallows private routes in robots.txt contract", () => {
    const contract = robots();
    const disallow = contract.rules && !Array.isArray(contract.rules) ? contract.rules.disallow : [];
    expect(disallow).toEqual(
      expect.arrayContaining(["/create", "/checkout", "/payment", "/order-status", "/download", "/admin"])
    );
    expect(contract.sitemap).toBe("https://mykinlegacy.com/sitemap.xml");
    expect(contract.host).toBe("https://mykinlegacy.com");
  });

  it("uses MyKinLegacy public brand metadata", () => {
    expect(rootMetadata.title).toBe("MyKinLegacy | Family Legacy Collection");
    expect(JSON.stringify(rootMetadata)).toContain("https://mykinlegacy.com");
  });

  it("does not persist download tokens or signed URLs in customer components", async () => {
    const productionSources = await readProductionSources(__dirname);
    for (const [file, source] of productionSources) {
      const normalizedFile = file.replaceAll("\\", "/");
      if (!normalizedFile.includes("/app/") && !normalizedFile.includes("/components/")) {
        continue;
      }
      if (
        normalizedFile.endsWith("lib/api-client.ts") ||
        normalizedFile.endsWith("lib/analytics.ts") ||
        normalizedFile.endsWith("components/download-vault.tsx")
      ) {
        continue;
      }
      expect(source).not.toMatch(/signed_url|storage_key|storage_bucket|rendered_prompt|raw_prompt/i);
    }

    const downloadVault = await readFile(join(__dirname, "components/download-vault.tsx"), "utf8");
    expect(downloadVault).not.toMatch(/localStorage|sessionStorage/i);
    expect(downloadVault).not.toMatch(/trackEvent\([^)]*signed_url/is);
  });

  it("analytics helper rejects private and provider fields", () => {
    const payload = sanitizeAnalyticsPayload({
      surname: "Alder",
      family_story: "private story",
      raw_prompt: "hidden",
      rendered_prompt: "hidden",
      signed_url: "local-private://hidden",
      storage_key: "orders/private/file.png",
      storage_bucket: "private",
      provider: "openai",
      api_key: "secret",
      customer_email: "customer@example.com",
      product_code: "family_legacy_collection"
    });

    expect(payload).toEqual({ product_code: "family_legacy_collection" });
  });

  it("adds baseline security headers to the Next.js config", async () => {
    const config = await readFile(join(appRoot, "next.config.mjs"), "utf8");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("Permissions-Policy");
  });
});

async function readProductionSources(dir: string): Promise<Array<[string, string]>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: Array<[string, string]> = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readProductionSources(absolute)));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) {
      continue;
    }
    files.push([absolute, await readFile(absolute, "utf8")]);
  }
  return files;
}
