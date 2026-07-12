import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

export const STRIPE_CHECKOUT_API_VERSION = "2026-06-24.dahlia" as const;

export const MYKINLEGACY_CHECKOUT_BRANDING = {
  display_name: "MyKinLegacy",
  background_color: "#0B0A08",
  button_color: "#C9A24A",
  border_style: "rounded",
  font_family: "lora",
  logo: {
    type: "url",
    url: "https://mykinlegacy.com/assets/final-homepage/01_brand/stripe-logo.png"
  },
  icon: {
    type: "url",
    url: "https://mykinlegacy.com/assets/final-homepage/01_brand/stripe-icon.png"
  }
} satisfies Stripe.Checkout.SessionCreateParams.BrandingSettings;

export interface CreateCheckoutSessionInput {
  orderNumber: string;
  amountCents: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  expiresAt: Date;
}

@Injectable()
export class StripeAdapter {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_replace_me", {
      apiVersion: STRIPE_CHECKOUT_API_VERSION
    });
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.orderNumber,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      branding_settings: MYKINLEGACY_CHECKOUT_BRANDING,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: {
              name: input.productName
            }
          }
        }
      ]
    });

    return {
      id: session.id,
      url: session.url ?? "",
      expiresAt: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000)
    };
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_replace_me"
    );
  }
}
