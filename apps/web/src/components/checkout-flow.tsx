"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { ApiClient, type OrderStatus, type ProductDetail } from "../lib/api-client";
import { trackEvent, trackFunnelStepViewed } from "../lib/analytics";
import { formatMoneyFromCents } from "../lib/format";

const finalHomepageAsset = "/assets/final-homepage";

export const REQUIRED_CONSENTS = [
  "terms_accepted",
  "privacy_policy_accepted",
  "heritage_disclaimer_accepted",
  "ai_generation_consent",
  "email_delivery_consent"
] as const;

const consentLabels: Record<(typeof REQUIRED_CONSENTS)[number], string> = {
  terms_accepted: "I accept the terms for this digital keepsake.",
  privacy_policy_accepted: "I understand the collection is private by default.",
  heritage_disclaimer_accepted:
    "I understand this is symbolic, not official arms and not a genealogy claim.",
  ai_generation_consent: "I consent to personalized digital preparation of this collection.",
  email_delivery_consent: "I agree to receive collection delivery updates by email."
};

const collectionArtifacts = [
  "Private family collection",
  "Recognition letter",
  "Symbolic crest artwork",
  "Heritage certificate",
  "Family story",
  "Symbol guide",
  "Secure private vault"
];

const founderDemoProduct: ProductDetail = {
  product_code: "family_legacy_collection",
  translations: [
    {
      locale: "en-US",
      name: "Family Legacy Collection",
      short_description: "A private digital keepsake for parents who already have everything."
    }
  ],
  packages: [
    {
      package_code: "family_legacy_collection_core",
      price_cents: 6900,
      currency: "USD",
      deliverables: [
        {
          deliverable_code: "heritage_certificate_pdf",
          deliverable_type: "pdf",
          format: "pdf",
          quantity: 1,
          required: true
        },
        {
          deliverable_code: "family_story_pdf",
          deliverable_type: "pdf",
          format: "pdf",
          quantity: 1,
          required: true
        },
        {
          deliverable_code: "symbol_explanation_pdf",
          deliverable_type: "pdf",
          format: "pdf",
          quantity: 1,
          required: true
        },
        {
          deliverable_code: "download_package_zip",
          deliverable_type: "archive",
          format: "zip",
          quantity: 1,
          required: true
        }
      ]
    }
  ]
};

function createFounderDemoOrderStatus(orderNumber: string): OrderStatus {
  return {
    order_number: orderNumber,
    order_status: "draft",
    payment_status: "unpaid",
    fulfillment_status: "not_started",
    amount: { total_cents: 6900 },
    currency: "USD",
    download_ready: false
  };
}

export function CheckoutFlow({ orderNumber }: { orderNumber: string }) {
  const founderDemoMode = process.env.NODE_ENV === "development";
  const founderDemoOrder = founderDemoMode && orderNumber.startsWith("FD-");
  const [order, setOrder] = useState<OrderStatus | null>(() =>
    founderDemoOrder ? createFounderDemoOrderStatus(orderNumber) : null
  );
  const [product, setProduct] = useState<ProductDetail | null>(() =>
    founderDemoOrder ? founderDemoProduct : null
  );
  const [consents, setConsents] = useState<Record<string, boolean>>({
    terms_accepted: false,
    privacy_policy_accepted: false,
    heritage_disclaimer_accepted: false,
    ai_generation_consent: false,
    email_delivery_consent: false,
    marketing_opt_in: false,
    gallery_opt_in: false
  });
  const [state, setState] = useState<
    "idle" | "checkout_creating" | "redirecting_to_stripe" | "demo_payment_creating"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => trackFunnelStepViewed("checkout", { order_number: orderNumber }), [orderNumber]);

  useEffect(() => {
    if (founderDemoOrder) {
      setOrder(createFounderDemoOrderStatus(orderNumber));
      setProduct(founderDemoProduct);
      return;
    }
    void Promise.all([
      api.getOrderStatus(orderNumber),
      api.getProductDetail("family_legacy_collection")
    ])
      .then(([orderResult, productResult]) => {
        setOrder(orderResult);
        setProduct(productResult);
      })
      .catch(() => setError("Checkout details could not be loaded."));
  }, [api, founderDemoOrder, orderNumber]);

  const requiredAccepted = REQUIRED_CONSENTS.every((key) => consents[key]);
  const primaryPackage = product?.packages[0] ?? null;

  async function checkout() {
    if (!requiredAccepted) {
      setError("Please accept the required consent items before payment.");
      return;
    }
    setState("checkout_creating");
    setError(null);
    const startedAt = performance.now();
    try {
      await api.createConsent(orderNumber, {
        ...consents,
        consent_version: "2026-06-29"
      });
      trackEvent("consent_completed", { order_number: orderNumber });
      const session = await api.createStripeCheckoutSession({
        order_number: orderNumber,
        success_url: `${window.location.origin}/payment/success?order_number=${encodeURIComponent(orderNumber)}`,
        cancel_url: `${window.location.origin}/payment/cancel?order_number=${encodeURIComponent(orderNumber)}`
      });
      setState("redirecting_to_stripe");
      const durationMs = Math.round(performance.now() - startedAt);
      trackEvent("checkout_started", { order_number: orderNumber }, { durationMs, stepName: "checkout" });
      trackEvent("funnel_step_completed", { step_name: "checkout", order_number: orderNumber }, { durationMs, stepName: "checkout" });
      window.location.assign(session.checkout_url);
    } catch {
      setError("Stripe checkout could not be created. Please retry.");
      setState("idle");
    }
  }

  async function founderDemoPayment() {
    if (!founderDemoMode) {
      setError("Founder Demo Mode is only available in development.");
      return;
    }
    if (!requiredAccepted) {
      setError("Please accept the required consent items before payment.");
      return;
    }
    setState("demo_payment_creating");
    setError(null);
    try {
      if (!founderDemoOrder) {
        await api.createConsent(orderNumber, {
          ...consents,
          consent_version: "2026-06-29"
        });
      }
      const demoPayment = api.createFounderDemoPayment(orderNumber);
      window.sessionStorage.setItem(
        `mykinlegacy_founder_demo_${orderNumber}`,
        JSON.stringify(demoPayment)
      );
      trackEvent("founder_demo_payment_completed", { order_number: orderNumber });
      window.location.assign(demoPayment.collection_ready_url);
    } catch {
      setError("Founder demo payment could not be completed. Please retry.");
      setState("idle");
    }
  }

  return (
    <section className="journey-shell">
      <div className="section checkout-layout">
        <div className="journey-card">
          <p className="eyebrow">Private vault checkout</p>
          <h1>Reserve and prepare their Family Legacy Collection</h1>
          <p className="lead">
            Confirm the digital keepsake, accept the private delivery terms, and continue to secure
            Stripe checkout.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <div className="grid">
            <section className="card">
              <h2>{product?.translations[0]?.name ?? "Loading product..."}</h2>
              <p>Order {order?.order_number ?? orderNumber}</p>
              <p className="lead">
                {primaryPackage
                  ? formatMoneyFromCents(primaryPackage.price_cents, primaryPackage.currency)
                  : "Loading price..."}
              </p>
              <p className="muted">Delivery email is stored securely with your private order.</p>
              <p className="notice">
                Prepared as a private digital collection for gifting and personal keeping.
              </p>
            </section>
            <section className="card">
              <h2>Collection artifacts</h2>
              <ul>
                {collectionArtifacts.map((artifact) => (
                  <li key={artifact}>{artifact}</li>
                ))}
              </ul>
            </section>
          </div>
          <form className="form">
            {REQUIRED_CONSENTS.map((key) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={consents[key]}
                  onChange={(event) =>
                    setConsents((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />{" "}
                <span>{consentLabels[key]}</span>
              </label>
            ))}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consents.marketing_opt_in}
                onChange={(event) =>
                  setConsents((current) => ({ ...current, marketing_opt_in: event.target.checked }))
                }
              />{" "}
              Marketing opt-in
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consents.gallery_opt_in}
                onChange={(event) =>
                  setConsents((current) => ({ ...current, gallery_opt_in: event.target.checked }))
                }
              />{" "}
              Gallery opt-in
            </label>
          </form>
          <p className="notice">
            Your collection is private by default, not public, delivered digitally, and prepared as
            a personalized symbolic keepsake. It is not an official coat of arms and not a genealogy
            claim.
          </p>
          <button
            className="button"
            type="button"
            onClick={() => void checkout()}
            disabled={!requiredAccepted || state !== "idle"}
          >
            {state === "checkout_creating"
              ? "Creating checkout..."
              : state === "redirecting_to_stripe"
                ? "Redirecting..."
                : "Continue to Stripe"}
          </button>
          {founderDemoMode ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void founderDemoPayment()}
              disabled={!requiredAccepted || state !== "idle"}
            >
              {state === "demo_payment_creating"
                ? "Preparing demo collection..."
                : "DEV Mock Payment"}
            </button>
          ) : null}
        </div>
        <aside className="side-panel" aria-label="Secure checkout summary">
          <div className="side-panel-visual">
            <Image
              src={`${finalHomepageAsset}/04_homepage/features/feature-private-vault.webp`}
              width={520}
              height={360}
              alt=""
              aria-hidden="true"
            />
          </div>
          <p className="eyebrow">Private vault</p>
          <h2>What happens next</h2>
          <div className="summary-list">
            <div className="summary-row">
              <strong>1</strong>
              <span>Payment is verified securely.</span>
            </div>
            <div className="summary-row">
              <strong>2</strong>
              <span>Your private collection preparation begins.</span>
            </div>
            <div className="summary-row">
              <strong>3</strong>
              <span>Artifacts are delivered through a token-protected vault.</span>
            </div>
          </div>
          <p className="notice">No public gallery is created by default.</p>
        </aside>
      </div>
    </section>
  );
}

export function areRequiredConsentsAccepted(consents: Record<string, boolean>): boolean {
  return REQUIRED_CONSENTS.every((key) => consents[key]);
}
