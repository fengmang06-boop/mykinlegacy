"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent } from "../lib/analytics";

const finalHomepageAsset = "/assets/final-homepage";
const isLogDeliveryMode = process.env.NEXT_PUBLIC_EMAIL_PROVIDER === "log";

export function PaymentSuccess() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order_number") ?? "";
  const demoToken = searchParams.get("token") ?? "";
  const isFounderDemo = searchParams.get("demo") === "1" && demoToken.startsWith("dev-demo-");
  const [message, setMessage] = useState(
    isFounderDemo
      ? "Your Family Legacy Collection Is Ready"
      : "Payment received, verifying your order."
  );
  const [confirmed, setConfirmed] = useState(isFounderDemo);
  const [attempts, setAttempts] = useState(0);
  const paymentSuccessTracked = useRef(false);
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    trackEvent("payment_success_returned", { order_number: orderNumber });
  }, [orderNumber]);

  useEffect(() => {
    if (isFounderDemo) {
      setConfirmed(true);
      trackEvent("founder_demo_collection_ready", { order_number: orderNumber });
      if (!paymentSuccessTracked.current) {
        paymentSuccessTracked.current = true;
        trackEvent("payment_success", { order_number: orderNumber, mode: "founder_demo" }, { stepName: "payment" });
        trackEvent("checkout_completed", { order_number: orderNumber, mode: "founder_demo" }, { stepName: "stripe_checkout" });
      }
      return;
    }
    if (!orderNumber || confirmed || attempts >= 24) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        void api
          .getOrderStatus(orderNumber)
          .then((order) => {
            if (order.payment_status === "paid") {
              setMessage("Your Family Legacy Collection Is Ready");
              setConfirmed(true);
              trackEvent("payment_verified", { order_number: orderNumber });
              if (!paymentSuccessTracked.current) {
                paymentSuccessTracked.current = true;
                trackEvent("payment_success", { order_number: orderNumber }, { stepName: "payment" });
                trackEvent("checkout_completed", { order_number: orderNumber }, { stepName: "stripe_checkout" });
              }
            } else {
              setAttempts((current) => current + 1);
            }
          })
          .catch(() => setAttempts((current) => current + 1));
      },
      attempts === 0 ? 0 : 5000
    );
    return () => window.clearTimeout(timer);
  }, [api, attempts, confirmed, isFounderDemo, orderNumber]);

  return (
    <section className="journey-shell">
      <div className="section transaction-layout">
        <div className="journey-card">
          <p className="eyebrow">{isFounderDemo ? "Founder Demo Mode" : "Collection Ready"}</p>
          <h1>{message}</h1>
          <p className="lead">
            Your payment has been confirmed. Your private collection is being prepared for review,
            including the Final Crest, Heritage Certificate, Family Story, and Meaning Behind Your
            Crest.
          </p>
          {!isFounderDemo ? (
            <p className="notice">
              In live email mode, your vault link will be sent by email when the collection is
              ready. For your privacy, vault links are not shown on this page.
            </p>
          ) : null}
          {isLogDeliveryMode ? (
            <p className="notice">
              Test mode: delivery is logged for internal review, not sent externally.
            </p>
          ) : null}
          {attempts >= 24 && !confirmed ? (
            <p className="notice">
              Payment may still be processing. Please do not pay again unless support confirms.
            </p>
          ) : null}
          <div className="button-row">
            {confirmed && demoToken ? (
              <Link className="button" href={`/download/${encodeURIComponent(demoToken)}`}>
                View My Collection
              </Link>
            ) : null}
            {orderNumber && !demoToken ? (
              <Link className={confirmed ? "secondary-button" : "button"} href={`/order-status/${orderNumber}`}>
                {confirmed ? "View Order Status" : "Check Collection Status"}
              </Link>
            ) : null}
            <Link className="secondary-button" href="/support">
              Support
            </Link>
          </div>
        </div>
        <aside className="side-panel transaction-side-panel" aria-label="Collection preparation">
          <div className="side-panel-visual">
            <Image
              src={`${finalHomepageAsset}/08_homepage/cta/cta-review-before-you-begin.webp`}
              width={520}
              height={360}
              alt=""
              aria-hidden="true"
              priority
            />
          </div>
          <p className="eyebrow">Private collection</p>
          <h2>Prepared with care</h2>
          <p>
            The vault is token-protected, private by default, and designed for personal keeping.
          </p>
        </aside>
      </div>
    </section>
  );
}
