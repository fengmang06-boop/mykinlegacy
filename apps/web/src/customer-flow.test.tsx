import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import HomePage from "./app/page";
import { metadata as checkoutMetadata } from "./app/checkout/[order_number]/page";
import { metadata as createMetadata } from "./app/create/page";
import { metadata as downloadMetadata } from "./app/download/[token]/page";
import { metadata as cancelMetadata } from "./app/payment/cancel/page";
import { metadata as successMetadata } from "./app/payment/success/page";
import { ApiClient, ApiClientError, normalizeApiBaseUrl } from "./lib/api-client";
import { sanitizeAnalyticsPayload } from "./lib/analytics";
import { getSafetyMessage } from "./lib/safety";
import { areRequiredConsentsAccepted } from "./components/checkout-flow";
import {
  DownloadVault,
  downloadFileName,
  downloadLabel,
  formatArtifactSizeLabel,
  isPlaceholderAsset
} from "./components/download-vault";
import { PrivateVaultPreview } from "./components/vault-meaning";

const testDir = dirname(fileURLToPath(import.meta.url));

describe("customer frontend flow", () => {
  it("landing page renders CTA and disclaimer", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("A personalized family legacy gift for someone you love.");
    expect(html).toContain("Limited to");
    expect(html).toContain("25 Founder Edition orders");
    expect(html).toContain("Create Your Legacy");
    expect(html).toContain("View Collections");
    expect(html).toContain("not an official coat of arms");
    expect(html).toContain("not a genealogy claim");
  });

  it("product API client fetches product price from API mock", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          product_code: "family_legacy_collection",
          translations: [],
          packages: [{ package_code: "core", price_cents: 4900, currency: "USD", deliverables: [] }]
        },
        error: null,
        request_id: "req",
        correlation_id: "corr"
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const product = await new ApiClient("https://api.example.com/api/v1").getProductDetail(
      "family_legacy_collection"
    );

    expect(product.packages[0]?.price_cents).toBe(4900);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/products/family_legacy_collection",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("product page does not hardcode display price", async () => {
    const source = await readFile(join(testDir, "app/family-legacy-collection/page.tsx"), "utf8");
    expect(source).not.toContain("$49");
    expect(source).not.toContain("price_cents");
  });

  it("confirm flow sends delivery email into order creation payload", async () => {
    const source = await readFile(join(testDir, "components/confirm-flow.tsx"), "utf8");

    expect(source).toContain("customer_email: email");
    expect(source).toContain("Delivery email");
  });

  it("API client sends Idempotency-Key on interview answer submit", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {},
        error: null,
        request_id: "req",
        correlation_id: "corr"
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await new ApiClient("https://api.example.com/api/v1").submitInterviewAnswer("interview_1", {
      step_code: "name_your_house",
      raw_answer: "Alder"
    });

    const calls = fetchMock.mock.calls as unknown as Array<
      [string, { headers?: Record<string, string> }]
    >;
    const init = calls[0]?.[1];
    if (!init) {
      throw new Error("fetch_call_missing");
    }
    expect(init.headers?.["idempotency-key"]).toBeTruthy();
  });

  it("vault download UI uses direct binary URLs and file-type labels", async () => {
    const source = await readFile(join(testDir, "components/download-vault.tsx"), "utf8");
    const api = new ApiClient("/api/v1");

    expect(api.createAssetDownloadUrl("raw token", "asset/id")).toBe(
      "/api/v1/downloads/raw%20token/assets/asset%2Fid/file"
    );
    expect(downloadLabel({ deliverable_code: "crest_variant_1_png", file_ext: "png" })).toBe(
      "Download PNG"
    );
    expect(downloadLabel({ deliverable_code: "family_story_pdf", file_ext: "pdf" })).toBe(
      "Download PDF"
    );
    expect(downloadLabel({ deliverable_code: "download_package_zip", file_ext: "zip" })).toBe(
      "Download ZIP"
    );
    expect(downloadFileName({ friendly_name: "Family Story", file_ext: "pdf" })).toBe(
      "Family-Story.pdf"
    );
    expect(source).toContain("href={downloadUrl(asset)}");
    expect(source).toContain("download={downloadFileName(asset)}");
    expect(source).not.toContain("Open Artifact");
  });

  it("normalizes raw IP API base URL to relative production API path in browser", () => {
    vi.stubGlobal("window", { location: { hostname: "mykinlegacy.com" } });

    expect(normalizeApiBaseUrl("https://216.128.154.152/api/v1")).toBe("/api/v1");
    expect(normalizeApiBaseUrl("/api/v1")).toBe("/api/v1");

    vi.unstubAllGlobals();
  });

  it("safe copy appears for official and protected emblem requests", () => {
    expect(getSafetyMessage("I want an official coat of arms")).toContain("symbolic");
    expect(getSafetyMessage("copy a copyrighted logo")).toContain("symbolic alternative");
  });

  it("checkout requires consent before Stripe session", () => {
    expect(
      areRequiredConsentsAccepted({
        terms_accepted: true,
        privacy_policy_accepted: true,
        heritage_disclaimer_accepted: true,
        ai_generation_consent: true,
        email_delivery_consent: false
      })
    ).toBe(false);
    expect(
      areRequiredConsentsAccepted({
        terms_accepted: true,
        privacy_policy_accepted: true,
        heritage_disclaimer_accepted: true,
        ai_generation_consent: true,
        email_delivery_consent: true
      })
    ).toBe(true);
  });

  it("API client handles ErrorContract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          data: null,
          error: {
            contract_version: "1.1",
            error_code: "download_token_expired",
            user_message: "Expired",
            retryable: false,
            severity: "medium"
          },
          request_id: "req",
          correlation_id: "corr"
        })
      }))
    );

    await expect(
      new ApiClient("https://api.example.com/api/v1").getDownloadVault("token")
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it("analytics helper rejects private fields", () => {
    const payload = sanitizeAnalyticsPayload({
      surname: "Alder",
      raw_prompt: "hidden",
      signed_url: "local-private://hidden",
      product_code: "family_legacy_collection"
    });
    expect(payload).toEqual({ product_code: "family_legacy_collection" });
  });

  it("private pages include noindex", () => {
    expect(createMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(checkoutMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(downloadMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(successMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(cancelMetadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("vault preview renders meaning content without JSON dump", () => {
    const html = renderToStaticMarkup(
      <PrivateVaultPreview
        vaultReady
        meaningProfile={{
          source_level: "customer_informed",
          themes: [
            {
              theme: "Protection",
              confidence: "high",
              evidence: "Family values mention protecting younger generations."
            }
          ],
          symbols: [
            {
              symbol: "Oak",
              meaning: "Strength",
              rationale: "Selected for steady family protection.",
              source: "customer_input"
            }
          ],
          design_rationale: ["Use grounded, protective composition."],
          story_direction: "A story about protection across generations.",
          certificate_direction: "A keepsake certificate centered on family continuity.",
          boundary_statement:
            "MyKinLegacy creates personalized symbolic keepsakes. It does not provide official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records.",
          validation: { valid: true, quality_flags: [], banned_claims_found: [] }
        }}
        collectionContent={{
          house_meaning_summary: "A private symbolic keepsake shaped around protection.",
          symbol_guide: [
            {
              symbol: "Oak",
              meaning: "Strength",
              why_chosen: "Chosen because the family values protection.",
              emotional_relevance: "Oak gives the collection a steady family anchor."
            }
          ],
          family_story: "The family story should remember how protection became a shared value.",
          certificate_text: "Presented as a private symbolic keepsake.",
          collection_letter: "To the family,\n\nThis collection honors what matters.",
          design_basis: "The design uses oak as a protective anchor.",
          boundary_statement:
            "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record."
        }}
      />
    );

    expect(html).toContain("Your Collection At A Glance");
    expect(html).toContain("Your collection was shaped around protection.");
    expect(html).toContain("Your Private Legacy Vault");
    expect(html).toContain("Vault Documents");
    expect(html).toContain("Open / Read");
    expect(html).toContain("Final Downloads");
    expect(html).toContain("Your downloadable artifacts are prepared below");
    expect(html).toContain("complete collection archive");
    expect(html).not.toContain("Files will be prepared next");
    expect(html).not.toContain("Download files will be available in the next delivery step.");
    expect(html).toContain("Heritage Certificate");
    expect(html).toContain("Family Story");
    expect(html).toContain("Meaning Behind Your Crest");
    expect(html).not.toContain("House Meaning Summary");
    expect(html).not.toContain("Collection Letter");
    expect(html).not.toContain("Design Basis");
    expect(html).toContain("Chosen because the family values protection.");
    expect(html).toContain("Oak gives the collection a steady family anchor.");
    expect(html).toContain("Private Vault Includes");
    expect(html).toContain("Important Note");
    expect(html).toContain("personalized symbolic keepsake");
    expect(html).toContain("Oak");
    expect(html).toContain("not an official coat of arms");
    expect(html).not.toContain("Meaning Themes");
    expect(html).not.toContain("The Meaning Behind This Collection");
    expect(html).not.toContain("Symbols Chosen for Your Family");
    expect(html).not.toContain("{&quot;");
    expect(html).not.toContain("raw_token");
  });

  it("vault preview keeps older orders compatible with meaning fallback", () => {
    const html = renderToStaticMarkup(<PrivateVaultPreview vaultReady meaningProfile={null} />);

    expect(html).toContain("Meaning Engine profile not attached");
    expect(html).toContain(
      "This collection was completed before the Meaning Engine profile was generated."
    );
    expect(html).toContain("Private Vault Includes");
  });

  it("vault preview falls back when meaning exists but collection documents are missing", () => {
    const html = renderToStaticMarkup(
      <PrivateVaultPreview
        vaultReady
        meaningProfile={{
          source_level: "customer_informed",
          themes: [{ theme: "Protection", confidence: "high", evidence: "Family value." }],
          symbols: [{ symbol: "Oak", meaning: "Strength", rationale: "Chosen from input." }],
          design_rationale: ["Use grounded composition."],
          story_direction: "A story about protection.",
          certificate_direction: "A certificate with warmth.",
          boundary_statement:
            "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record."
        }}
        collectionContent={null}
      />
    );

    expect(html).toContain("Documents are being prepared");
  });

  it("download vault helpers hide sample placeholder sizes without raw token data", () => {
    expect(isPlaceholderAsset({ size_bytes: 100, status: "available_for_download" })).toBe(true);
    expect(formatArtifactSizeLabel({ size_bytes: 100, status: "available_for_download" })).toBeNull();
    expect(formatArtifactSizeLabel({ size_bytes: 2048, status: "available_for_download" })).toBe("2.0 KB");
  });

  it("download vault shell does not expose the raw token in rendered markup", () => {
    const rawToken = "raw-live-token-should-not-render";
    const html = renderToStaticMarkup(<DownloadVault token={rawToken} />);

    expect(html).toContain("Your Private Legacy Vault Is Ready");
    expect(html).toContain("Your token is never displayed on this page.");
    expect(html).not.toContain(rawToken);
    expect(html).not.toContain("216.128.154.152");
  });

  it("download vault protects long order numbers from ugly hyphen wrapping", async () => {
    const componentSource = await readFile(join(testDir, "components/download-vault.tsx"), "utf8");
    const globalStyles = await readFile(join(testDir, "app/globals.css"), "utf8");

    expect(componentSource).toContain('className="vault-order-number"');
    expect(globalStyles).toContain(".vault-summary .vault-order-number");
    expect(globalStyles).toContain("white-space: nowrap");
    expect(globalStyles).toContain("word-break: normal");
    expect(globalStyles).toContain("overflow-wrap: normal");
  });

  it("order status uses customer-facing delivery status instead of internal fulfillment failure", async () => {
    const componentSource = await readFile(join(testDir, "components/order-status.tsx"), "utf8");
    const stateSource = await readFile(join(testDir, "lib/state.ts"), "utf8");

    expect(componentSource).toContain("customer_delivery_status");
    expect(componentSource).toContain("Collection</h2>");
    expect(componentSource).toContain("The delivery email needs attention");
    expect(componentSource).not.toContain("<h2>Fulfillment</h2>");
    expect(stateSource).toContain("email_delivery_attention");
    expect(stateSource).toContain("your collection is not blocked");
  });

  it("payment cancel page renders a branded checkout recovery path", async () => {
    const source = await readFile(join(testDir, "app/payment/cancel/page.tsx"), "utf8");

    expect(source).toContain("Payment was cancelled.");
    expect(source).toContain("Return to checkout");
    expect(source).toContain("/checkout/");
  });
});
