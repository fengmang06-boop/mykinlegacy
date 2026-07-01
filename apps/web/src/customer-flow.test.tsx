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
import { ApiClient, ApiClientError } from "./lib/api-client";
import { sanitizeAnalyticsPayload } from "./lib/analytics";
import { getSafetyMessage } from "./lib/safety";
import { areRequiredConsentsAccepted } from "./components/checkout-flow";

const testDir = dirname(fileURLToPath(import.meta.url));

describe("customer frontend flow", () => {
  it("landing page renders CTA and disclaimer", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain(
      "A meaningful family keepsake for the parents who already have everything."
    );
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

  it("payment cancel page renders a branded checkout recovery path", async () => {
    const source = await readFile(join(testDir, "app/payment/cancel/page.tsx"), "utf8");

    expect(source).toContain("Payment was cancelled.");
    expect(source).toContain("Return to checkout");
    expect(source).toContain("/checkout/");
  });
});
