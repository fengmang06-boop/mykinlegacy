"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent, trackFunnelStepViewed } from "../lib/analytics";

export function ConfirmFlow({ interviewId }: { interviewId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const api = useMemo(() => new ApiClient(), []);
  const founderDemoMode =
    process.env.NODE_ENV === "development" && interviewId.startsWith("founder-demo-");

  useEffect(() => trackFunnelStepViewed("confirm_identity", { interview_id: interviewId }), [interviewId]);

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
      const product = await api.getProductDetail("family_legacy_collection");
      const selectedPackage = product.packages[0];
      if (!selectedPackage) {
        throw new Error("package_missing");
      }
      const order = await api.createOrder({
        product_code: product.product_code,
        package_code: selectedPackage.package_code,
        interview_id: interviewId,
        house_id: identity.house_id,
        identity_version_id: identity.identity_version_id,
        customer_email: email
      });
      trackEvent("house_dna_confirmed", { interview_id: interviewId });
      trackEvent("order_created", {
        order_number: order.order_number,
        product_code: product.product_code
      });
      trackEvent("funnel_step_completed", {
        step_name: "confirm_identity",
        order_number: order.order_number,
        product_code: product.product_code
      });
      router.push(`/checkout/${order.order_number}`);
    } catch {
      setError("We could not confirm and create your order. Please retry.");
      setLoading(false);
    }
  }

  return (
    <>
      <section className="interview-hero">
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
            <h1>Confirm their Family Legacy Collection</h1>
            {founderDemoMode ? <p className="notice">Founder Demo Mode: no backend order is created.</p> : null}
            <div className="summary-list">
              <div className="summary-row">
                <strong>Recipient</strong>
                <span>The parent, grandparent, couple, or family moment from your answers</span>
              </div>
              <div className="summary-row">
                <strong>Family name</strong>
                <span>Used only to personalize this symbolic keepsake</span>
              </div>
              <div className="summary-row">
                <strong>Gift moment</strong>
                <span>Father's Day, Mother's Day, Christmas, retirement, anniversary, or reunion</span>
              </div>
              <div className="summary-row">
                <strong>Values</strong>
                <span>The qualities this collection should help them feel recognized for</span>
              </div>
              <div className="summary-row">
                <strong>Symbols</strong>
                <span>Symbolic motifs chosen to represent your family's story</span>
              </div>
              <div className="summary-row">
                <strong>Colors and style</strong>
                <span>Your selected palette and keepsake direction</span>
              </div>
              <div className="summary-row">
                <strong>Words</strong>
                <span>Your chosen motto or phrase for the collection</span>
              </div>
              <div className="summary-row">
                <strong>Privacy</strong>
                <span>Private by default and not published publicly</span>
              </div>
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
              <span>Final Crest, certificate, story, meaning notes, and private vault.</span>
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
