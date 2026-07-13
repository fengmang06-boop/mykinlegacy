"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiClient, type ProductDetail } from "../lib/api-client";
import { formatMoneyFromCents } from "../lib/format";
import { trackEvent } from "../lib/analytics";

const collectionArtifacts = [
  "One frameable Family Legacy Certificate",
  "One personalized Final Crest",
  "One Family Story",
  "One Meaning Behind Your Crest",
  "One Complete Collection archive",
  "Secure private vault"
];

const confidenceNotes = [
  "Prepared as a private digital collection.",
  "Founder reviewed before final delivery.",
  "Normally delivered within two business days."
];

export function ProductDetails() {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(), []);

  useEffect(() => {
    let active = true;
    void api
      .getProductDetail("family_legacy_collection")
      .then((result) => {
        if (!active) {
          return;
        }
        setProduct(result);
        trackEvent("product_viewed", { product_code: result.product_code });
      })
      .catch(() => {
        if (active) {
          setError("Collection details are being prepared. Please continue when you are ready.");
        }
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (error) {
    return (
      <section className="product-details product-details-fallback">
        <p className="eyebrow">Collection details</p>
        <h2>Family Legacy Collection</h2>
        <p className="lead">
          A private symbolic keepsake for parents, grandparents, and families who deserve something
          more meaningful than another ordinary gift.
        </p>
        <p className="notice">{error}</p>
        <div className="product-confidence">
          {confidenceNotes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
        <ul className="product-bullets">
          {collectionArtifacts.map((artifact) => (
            <li key={artifact}>{artifact}</li>
          ))}
        </ul>
        <Link className="button" href="/create">
          Begin Their Legacy
        </Link>
        <p className="notice">Digital product. No physical shipping.</p>
      </section>
    );
  }
  if (!product) {
    return <p className="notice">Your private collection preview is loading.</p>;
  }

  const translation = product.translations[0];
  const primaryPackage = product.packages[0];
  if (!primaryPackage) {
    return <p className="notice">Collection details are being prepared.</p>;
  }

  return (
    <section className="product-details">
      <p className="eyebrow">Collection details</p>
      <h2>{translation?.name ?? "Family Legacy Collection"}</h2>
      <p className="lead">
        A meaningful private digital keepsake for parents, grandparents, and families who deserve
        something more personal than another ordinary gift.
      </p>
      <ul className="product-bullets">
        {collectionArtifacts.map((artifact) => (
          <li key={artifact}>{artifact}</li>
        ))}
      </ul>
      <div className="product-confidence">
        {confidenceNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
      <p className="lead">
        {formatMoneyFromCents(primaryPackage.price_cents, primaryPackage.currency)}
      </p>
      <p className="muted">One-time payment. No subscription.</p>
      <Link className="button" href="/create">
        Begin Their Legacy
      </Link>
      <p className="notice">Digital product. No physical shipping.</p>

      <div className="card product-detail-card">
        <p className="eyebrow">Gift-ready collection</p>
        <div className="summary-list">
          <div className="summary-row">
            <strong>Delivery</strong>
            <span>Founder-reviewed Private Collection Vault, normally within two business days</span>
          </div>
          <div className="summary-row">
            <strong>Checkout</strong>
            <span>Secure payment before collection preparation</span>
          </div>
          <div className="summary-row">
            <strong>Use</strong>
            <span>Receive, print, gift, and keep</span>
          </div>
          <div className="summary-row">
            <strong>Support</strong>
            <span>Correction and refund requests are reviewed under the published policies</span>
          </div>
        </div>
      </div>

      <div className="card product-detail-card">
        <p className="eyebrow">What&apos;s included</p>
        <h2>Included artifacts</h2>
        <ul>
          {collectionArtifacts.map((artifact) => (
            <li key={artifact}>{artifact}</li>
          ))}
        </ul>
        <p className="muted">
          Includes email delivery, private vault access, and clear symbolic keepsake boundaries.
        </p>
      </div>
    </section>
  );
}
