"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiClient, type OrderStatus as OrderStatusData } from "../lib/api-client";
import { friendlyGenerationMessage } from "../lib/state";
import { trackEvent } from "../lib/analytics";
import { PrivateVaultPreview } from "./vault-meaning";

const finalHomepageAsset = "/assets/final-homepage";

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
  const vaultReady = Boolean(order?.download_ready);

  return (
    <section className="journey-shell">
      <div className="section transaction-layout">
        <div className="journey-card">
          <p className="eyebrow">Private vault progress</p>
          <h1>{vaultReady ? "Your vault is ready" : "Your collection is being prepared"}</h1>
          <p className="lead">Order {orderNumber}</p>
          {error ? <p className="error">{error}</p> : null}
          <div className="status-grid">
            <div className="card status-card" data-state={order?.payment_status === "paid" ? "complete" : "pending"}>
              <h2>Payment</h2>
              <p>{order?.payment_status ?? "Loading"}</p>
            </div>
            <div
              className="card status-card"
              data-state={order?.fulfillment_status === "completed" ? "complete" : "pending"}
            >
              <h2>Fulfillment</h2>
              <p>{order?.fulfillment_status ?? "Loading"}</p>
            </div>
            <div className="card status-card" data-state={expected > 0 && generated >= expected ? "complete" : "pending"}>
              <h2>Assets</h2>
              <p>
                {generated} / {expected}
              </p>
            </div>
            <div className="card status-card" data-state={vaultReady ? "complete" : "pending"}>
              <h2>Vault</h2>
              <p>{vaultReady ? "Ready" : "Still preparing"}</p>
            </div>
          </div>
          {vaultReady ? (
            <div className="vault-ready-panel">
              <strong>Vault Ready</strong>
              <span>
                Your private vault link has been created and sent through the configured delivery
                channel.
              </span>
            </div>
          ) : null}
          <p className="notice">
            {friendlyGenerationMessage({
              payment_status: order?.payment_status,
              fulfillment_status: order?.fulfillment_status,
              download_ready: order?.download_ready,
              elapsed_minutes: elapsed
            })}
          </p>
          {order?.download_ready ? (
            <p className="notice">
              Your private vault link has been sent to your delivery email. For your privacy, the
              vault token is not shown on this page.
            </p>
          ) : (
            <p className="notice">
              When your private vault is ready, the secure link will be sent to your delivery email.
            </p>
          )}
          <PrivateVaultPreview
            meaningProfile={order?.generation_manifest?.meaning_profile}
            vaultReady={vaultReady}
          />
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
        <aside className="side-panel transaction-side-panel" aria-label="Vault status visual">
          <div className="side-panel-visual">
            <Image
              src={`${finalHomepageAsset}/09_extras/extra-private-archive-wide.webp`}
              width={520}
              height={360}
              alt=""
              aria-hidden="true"
              priority
            />
          </div>
          <p className="eyebrow">Private by default</p>
          <h2>{vaultReady ? "Ready for keeping" : "Preparing the collection"}</h2>
          <p>
            The vault token is never displayed here. This protects the private collection even on a
            shared screen.
          </p>
        </aside>
      </div>
    </section>
  );
}
