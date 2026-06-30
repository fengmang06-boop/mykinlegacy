"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiClient, type OrderStatus as OrderStatusData } from "../lib/api-client";
import { friendlyGenerationMessage } from "../lib/state";
import { trackEvent } from "../lib/analytics";

export function OrderStatusView({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<OrderStatusData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    trackEvent("generation_status_viewed", { order_number: orderNumber });
  }, [orderNumber]);

  useEffect(() => {
    let stopped = false;
    function delay() {
      if (elapsed < 2) {
        return 5000;
      }
      if (elapsed < 10) {
        return 15000;
      }
      return 30000;
    }
    async function poll() {
      try {
        const result = await api.getOrderStatus(orderNumber);
        if (!stopped) {
          setOrder(result);
        }
      } catch {
        if (!stopped) {
          setError("Order status could not be refreshed.");
        }
      }
      if (!stopped) {
        window.setTimeout(() => {
          setElapsed((current) => current + delay() / 60000);
          void poll();
        }, delay());
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [api, elapsed, orderNumber]);

  const expected = order?.generation_manifest?.expected_assets_count ?? 0;
  const generated = order?.generation_manifest?.generated_assets_count ?? 0;

  return (
    <section className="journey-shell">
      <div className="section">
        <div className="journey-card">
          <p className="eyebrow">Order Status</p>
          <h1>{orderNumber}</h1>
          {error ? <p className="error">{error}</p> : null}
          <div className="grid">
            <div className="card">
              <h2>Payment</h2>
              <p>{order?.payment_status ?? "Loading"}</p>
            </div>
            <div className="card">
              <h2>Fulfillment</h2>
              <p>{order?.fulfillment_status ?? "Loading"}</p>
            </div>
            <div className="card">
              <h2>Assets</h2>
              <p>
                {generated} / {expected}
              </p>
            </div>
            <div className="card">
              <h2>Vault</h2>
              <p>{order?.download_ready ? "Ready" : "Still preparing"}</p>
            </div>
          </div>
          <p className="notice">
            {friendlyGenerationMessage({
              payment_status: order?.payment_status,
              fulfillment_status: order?.fulfillment_status,
              download_ready: order?.download_ready,
              elapsed_minutes: elapsed
            })}
          </p>
          <ul>
            <li>Your payment is confirmed.</li>
            <li>Your House Identity is being prepared.</li>
            <li>We are creating your crest variants.</li>
            <li>We are preparing your story and certificate.</li>
            <li>We are packaging your private vault files.</li>
          </ul>
          {elapsed > 30 || order?.fulfillment_status === "failed" ? (
            <Link className="secondary-button" href="/support">
              Contact Support
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
