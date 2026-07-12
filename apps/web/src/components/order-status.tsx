"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  ApiClient,
  type OrderArtifact,
  type OrderArtifacts,
  type OrderStatus as OrderStatusData
} from "../lib/api-client";
import { friendlyGenerationMessage } from "../lib/state";
import { trackEvent } from "../lib/analytics";
import { PrivateVaultPreview } from "./vault-meaning";

const finalHomepageAsset = "/assets/final-homepage";

export function OrderStatusView({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<OrderStatusData | null>(null);
  const [artifacts, setArtifacts] = useState<OrderArtifacts | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const vaultReadyTracked = useRef(false);
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
        try {
          const artifactResult = await api.getOrderArtifacts(orderNumber);
          if (!stopped) {
            setArtifacts(artifactResult);
          }
        } catch {
          if (!stopped) {
            setArtifacts(null);
          }
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

  useEffect(() => {
    if (!vaultReady || vaultReadyTracked.current) {
      return;
    }
    vaultReadyTracked.current = true;
    trackEvent("vault_opened", { order_number: orderNumber, source: "order_status" }, { stepName: "vault" });
    trackEvent("email_sent_confirmed", { order_number: orderNumber, source: "order_status" }, { stepName: "email_delivery" });
  }, [orderNumber, vaultReady]);
  const customerDeliveryStatus =
    order?.customer_delivery_status ?? artifacts?.customer_delivery_status ?? fallbackCustomerDeliveryStatus({
      paymentStatus: order?.payment_status,
      fulfillmentStatus: order?.fulfillment_status,
      vaultReady,
      expected,
      generated
    });
  const deliveryCopy = deliveryStatusCopy(customerDeliveryStatus);
  const showSupport =
    elapsed > 30 ||
    customerDeliveryStatus === "failed" ||
    customerDeliveryStatus === "artifact_generation_failed" ||
    customerDeliveryStatus === "email_delivery_attention";

  return (
    <section className="journey-shell">
      <div className="section transaction-layout">
        <div className="journey-card">
          <p className="eyebrow">Private vault progress</p>
          <h1>{deliveryCopy.heading}</h1>
          <p className="lead">Order {orderNumber}</p>
          {error ? <p className="error">{error}</p> : null}
          <div className="status-grid">
            <div className="card status-card" data-state={order?.payment_status === "paid" ? "complete" : "pending"}>
              <h2>Payment</h2>
              <p>{order?.payment_status ?? "Loading"}</p>
            </div>
            <div
              className="card status-card"
              data-state={
                customerDeliveryStatus === "vault_ready" || customerDeliveryStatus === "email_delivery_attention"
                  ? "complete"
                  : customerDeliveryStatus === "artifact_generation_failed" || customerDeliveryStatus === "failed"
                    ? "attention"
                    : "pending"
              }
            >
              <h2>Collection</h2>
              <p>{deliveryCopy.shortStatus}</p>
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
              <strong>{deliveryCopy.panelTitle}</strong>
              <span>{deliveryCopy.panelBody}</span>
            </div>
          ) : null}
          <p className="notice">
            {friendlyGenerationMessage({
              payment_status: order?.payment_status,
              fulfillment_status: order?.fulfillment_status,
              customer_delivery_status: customerDeliveryStatus,
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
            collectionContent={order?.generation_manifest?.collection_content}
            vaultReady={vaultReady}
          />
          <ArtifactVisibilityPanel artifacts={artifacts} />
          <ul>
            <li>Your payment is confirmed.</li>
            <li>Your private collection is being prepared.</li>
            <li>We are preparing your Final Crest.</li>
            <li>We are preparing your story and Heritage Certificate.</li>
            <li>We are packaging your private vault files.</li>
          </ul>
          {showSupport ? (
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

function fallbackCustomerDeliveryStatus(input: {
  paymentStatus?: string;
  fulfillmentStatus?: string;
  vaultReady: boolean;
  expected: number;
  generated: number;
}) {
  if (input.paymentStatus !== "paid") return "preparing";
  if (input.vaultReady && input.expected > 0 && input.generated >= input.expected) {
    return input.fulfillmentStatus === "failed" ? "email_delivery_attention" : "vault_ready";
  }
  if (input.fulfillmentStatus === "failed") return "artifact_generation_failed";
  return "preparing";
}

type DeliveryCopy = { heading: string; shortStatus: string; panelTitle: string; panelBody: string };

function deliveryStatusCopy(status: string): DeliveryCopy {
  const fallback: DeliveryCopy = {
    heading: "Your collection is being prepared",
    shortStatus: "Preparing",
    panelTitle: "Preparing",
    panelBody: "Your private vault is being prepared."
  };
  const copy: Record<string, DeliveryCopy> = {
    vault_ready: {
      heading: "Your vault is ready",
      shortStatus: "Ready",
      panelTitle: "Vault Ready",
      panelBody: "Your private vault is ready for secure access."
    },
    pending_founder_review: {
      heading: "Your collection is awaiting Founder review",
      shortStatus: "Pending Founder Review",
      panelTitle: "Founder Review",
      panelBody: "Your collection is being reviewed before the private delivery email and vault access are released."
    },
    email_delivery_attention: {
      heading: "Your vault is ready",
      shortStatus: "Email needs attention",
      panelTitle: "Vault Ready",
      panelBody:
        "Your collection files are ready. The delivery email needs attention, but vault access is not blocked."
    },
    artifact_generation_failed: {
      heading: "Collection preparation needs review",
      shortStatus: "Needs review",
      panelTitle: "Collection preparation failed",
      panelBody: "The private vault is not ready because one or more collection artifacts need support review."
    },
    failed: {
      heading: "Your order needs review",
      shortStatus: "Needs review",
      panelTitle: "Support review needed",
      panelBody: "We need to review this order before delivery can continue."
    },
    preparing: fallback
  };
  const selected = copy[status];
  if (selected) return selected;
  return fallback;
}

function ArtifactVisibilityPanel({ artifacts }: { artifacts: OrderArtifacts | null }) {
  const readyArtifacts = artifacts?.artifacts ?? [];
  const missingArtifacts = artifacts?.missing_artifacts ?? [];
  const visibleArtifacts = [...readyArtifacts, ...missingArtifacts];

  return (
    <section className="vault-meaning-card artifact-visibility-panel" aria-label="Collection artifacts">
      <span>Collection Artifacts</span>
      <h3>Your visible collection items</h3>
      <p>
        {visibleArtifacts.length > 0
          ? "Each artifact is linked to this order and prepared for access through the private vault."
          : "Generation in progress"}
      </p>
      <div className="artifact-visibility-list">
        {visibleArtifacts.length > 0 ? (
          visibleArtifacts.map((artifact) => (
            <ArtifactVisibilityCard key={`${artifact.deliverable_code}-${artifact.asset_id ?? "pending"}`} artifact={artifact} />
          ))
        ) : (
          <div className="artifact-visibility-card pending">
            <strong>Collection artifacts</strong>
            <small>Generation in progress</small>
          </div>
        )}
      </div>
    </section>
  );
}

function ArtifactVisibilityCard({ artifact }: { artifact: OrderArtifact }) {
  const ready = artifact.available && artifact.asset_id;
  return (
    <div className={`artifact-visibility-card${ready ? "" : " pending"}`}>
      <div>
        <strong>{artifact.friendly_name}</strong>
        <small>
          {ready
            ? `${artifact.file_ext.toUpperCase()} artifact ready`
            : artifact.message ?? "Generation in progress"}
        </small>
      </div>
      <span>{ready ? "Ready" : "In progress"}</span>
    </div>
  );
}
