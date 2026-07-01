"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent } from "../lib/analytics";

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
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    trackEvent("payment_success_returned", { order_number: orderNumber });
  }, [orderNumber]);

  useEffect(() => {
    if (isFounderDemo) {
      setConfirmed(true);
      trackEvent("founder_demo_collection_ready", { order_number: orderNumber });
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
      <div className="section">
        <div className="journey-card">
          <p className="eyebrow">{isFounderDemo ? "Founder Demo Mode" : "Collection Ready"}</p>
          <h1>{message}</h1>
          <p className="lead">
            Your private collection has been prepared for review. Open the vault to see the
            Heritage Certificate, Family Story, Symbol Guide, Crest Artwork, and Collection Letter.
          </p>
          {!isFounderDemo ? (
            <p className="notice">
              When your private vault is ready, the secure vault link will be sent to your delivery
              email. For your privacy, vault links are not shown on this page.
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
      </div>
    </section>
  );
}
