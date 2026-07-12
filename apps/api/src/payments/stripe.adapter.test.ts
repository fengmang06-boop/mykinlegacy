import { describe, expect, it } from "vitest";

import {
  MYKINLEGACY_CHECKOUT_BRANDING,
  STRIPE_CHECKOUT_API_VERSION
} from "./stripe.adapter";

describe("Stripe Checkout branding", () => {
  it("uses the supported API version and MyKinLegacy session branding", () => {
    expect(STRIPE_CHECKOUT_API_VERSION).toBe("2026-06-24.dahlia");
    expect(MYKINLEGACY_CHECKOUT_BRANDING).toMatchObject({
      display_name: "MyKinLegacy",
      background_color: "#0B0A08",
      button_color: "#C9A24A",
      icon: { type: "url" }
    });
  });

  it("uses public HTTPS brand assets without secrets", () => {
    expect(MYKINLEGACY_CHECKOUT_BRANDING.icon.url).toMatch(/^https:\/\/mykinlegacy\.com\//);
    expect(MYKINLEGACY_CHECKOUT_BRANDING.icon.url).toMatch(/\.png$/);
    expect(JSON.stringify(MYKINLEGACY_CHECKOUT_BRANDING)).not.toMatch(/sk_|whsec_|token/i);
  });
});
