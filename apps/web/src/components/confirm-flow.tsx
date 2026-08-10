"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiClient, type ProductDetail } from "../lib/api-client";
import { trackEvent, trackFunnelStepViewed } from "../lib/analytics";
import {
  COLLECTION_DELIVERABLES,
  COLLECTION_DELIVERY_NOTE,
  COLLECTION_PRICE_FALLBACK,
  COLLECTION_PRODUCT_CODE
} from "../lib/collection-contract";
import { formatMoneyFromCents } from "../lib/format";
import { INTERVIEW_STEPS } from "../lib/interview-contract";
import {
  formatInterviewAnswer,
  readInterviewDraft,
  type InterviewSessionDraft
} from "../lib/interview-draft";

export function ConfirmFlow({ interviewId }: { interviewId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [draft, setDraft] = useState<InterviewSessionDraft>({
    current_step_index: 0,
    answers: {}
  });
  const router = useRouter();
  const api = useMemo(() => new ApiClient(), []);
  const founderDemoMode =
    process.env.NODE_ENV === "development" && interviewId.startsWith("founder-demo-");

  useEffect(() => {
    trackFunnelStepViewed("confirm_identity", { interview_id: interviewId });
    setDraft(readInterviewDraft(window.sessionStorage, interviewId));
    void api.getProductDetail(COLLECTION_PRODUCT_CODE).then(setProduct).catch(() => undefined);
  }, [api, interviewId]);

  async function confirm() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email for digital delivery.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (founderDemoMode) {
        const orderNumber = `FD-${Date.now().toString(36).toUpperCase()}`;
        window.sessionStorage.setItem(
          `mykinlegacy_founder_demo_order_${orderNumber}`,
          JSON.stringify({
            order_number: orderNumber,
            interview_id: interviewId,
            customer_email: email,
            payment_status: "unpaid",
            order_status: "draft",
            fulfillment_status: "not_started"
          })
        );
        trackEvent("house_dna_confirmed", { interview_id: interviewId, mode: "founder_demo" });
        trackEvent("order_created", {
          order_number: orderNumber,
          product_code: "family_legacy_collection",
          mode: "founder_demo"
        });
        trackEvent("funnel_step_completed", {
          step_name: "confirm_identity",
          order_number: orderNumber,
          mode: "founder_demo"
        });
        router.push(`/checkout/${orderNumber}`);
        return;
      }
      const identity = await api.confirmHouseDNA(interviewId);
      const confirmedProduct = product ?? await api.getProductDetail(COLLECTION_PRODUCT_CODE);
      const selectedPackage = confirmedProduct.packages[0];
      if (!selectedPackage) {
        throw new Error("package_missing");
      }
      const order = await api.createOrder({
        product_code: confirmedProduct.product_code,
        package_code: selectedPackage.package_code,
        interview_id: interviewId,
        house_id: identity.house_id,
        identity_version_id: identity.identity_version_id,
        customer_email: email
      });
      trackEvent("house_dna_confirmed", { interview_id: interviewId });
      trackEvent("order_created", {
        order_number: order.order_number,
        product_code: confirmedProduct.product_code
      });
      trackEvent("funnel_step_completed", {
        step_name: "confirm_identity",
        order_number: order.order_number,
        product_code: confirmedProduct.product_code
      });
      router.push(`/checkout/${order.order_number}`);
    } catch {
      setError("We could not confirm and create your order. Please retry.");
      setLoading(false);
    }
  }

  return (
    <>
      <section className="interview-hero confirm-hero">
        <div className="section interview-hero-grid">
          <div>
            <p className="eyebrow">Review</p>
            <h1>Review the collection before checkout</h1>
            <p className="lead">
              Confirm who this gift is for, what it should honor, and where the finished collection
              should be delivered.
            </p>
          </div>
          <div className="mock-certificate">
            <span>Private collection</span>
            <strong>Ready for checkout.</strong>
          </div>
        </div>
      </section>
      <section className="journey-shell">
        <div className="section interview-layout">
          <div className="journey-card">
            <p className="eyebrow">Gift summary</p>
            <h2>Confirm their Family Legacy Collection</h2>
            {founderDemoMode ? <p className="notice">Founder Demo Mode: no backend order is created.</p> : null}
            <div className="summary-list">
              {INTERVIEW_STEPS.map((step, index) => (
                <div className="summary-row" key={step.code}>
                  <strong>{step.label}</strong>
                  <span>
                    {formatInterviewAnswer(draft.answers[step.code])}{" "}
                    <Link href={`/create/${interviewId}?step=${index}`}>Edit</Link>
                  </span>
                </div>
              ))}
              <div className="summary-row">
                <strong>Privacy</strong>
                <span>Private by default and not published publicly</span>
              </div>
            </div>
            <div className="collection-contract" aria-label="Collection price and contents">
              <p className="eyebrow">Complete Collection</p>
              <p className="collection-contract-price">
                {formatMoneyFromCents(
                  product?.packages[0]?.price_cents ?? COLLECTION_PRICE_FALLBACK.price_cents,
                  product?.packages[0]?.currency ?? COLLECTION_PRICE_FALLBACK.currency
                )}
              </p>
              <ul className="collection-contract-list">
                {COLLECTION_DELIVERABLES.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
              <p className="muted">{COLLECTION_DELIVERY_NOTE}</p>
            </div>
            <p className="notice">
              This is a personalized heritage-inspired symbolic keepsake for gifting and personal
              keeping. It is not an official coat of arms and not a genealogy claim.
            </p>
            <label className="field">
              <span>Delivery email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button
              className="button"
              type="button"
              onClick={() => void confirm()}
              disabled={loading}
            >
              {loading ? "Creating order..." : "Confirm Their Collection"}
            </button>
          </div>
          <aside className="interview-preview" aria-label="Collection summary">
            <div className="preview-cover">
              <strong>Collection Preview</strong>
              <span>
                Final Crest, Heritage Certificate, Family Story, Meaning Behind Your Crest, and
                private Complete Collection.
              </span>
            </div>
            <p className="notice">
              Required consent and secure checkout happen before collection preparation begins.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
