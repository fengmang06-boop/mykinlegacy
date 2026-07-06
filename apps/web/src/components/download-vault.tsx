"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ApiClient,
  type DownloadAsset,
  type DownloadVault as DownloadVaultData
} from "../lib/api-client";
import { trackEvent } from "../lib/analytics";
import { formatBytes } from "../lib/format";
import { PrivateVaultPreview } from "./vault-meaning";

const demoArtifacts: DownloadAsset[] = [
  {
    asset_id: "demo_collection_letter",
    deliverable_code: "collection_letter",
    friendly_name: "Collection Letter",
    asset_type: "document",
    file_ext: "pdf",
    mime_type: "application/pdf",
    size_bytes: 124000,
    available: true,
    status: "available_for_download"
  },
  {
    asset_id: "demo_crest_artwork",
    deliverable_code: "crest_artwork",
    friendly_name: "Crest Artwork",
    asset_type: "image",
    file_ext: "png",
    mime_type: "image/png",
    size_bytes: 480000,
    available: true,
    status: "available_for_download"
  },
  {
    asset_id: "demo_heritage_certificate",
    deliverable_code: "heritage_certificate_pdf",
    friendly_name: "Heritage Certificate",
    asset_type: "pdf",
    file_ext: "pdf",
    mime_type: "application/pdf",
    size_bytes: 210000,
    available: true,
    status: "available_for_download"
  },
  {
    asset_id: "demo_family_story",
    deliverable_code: "family_story_pdf",
    friendly_name: "Family Story",
    asset_type: "pdf",
    file_ext: "pdf",
    mime_type: "application/pdf",
    size_bytes: 260000,
    available: true,
    status: "available_for_download"
  },
  {
    asset_id: "demo_symbol_guide",
    deliverable_code: "symbol_explanation_pdf",
    friendly_name: "Symbol Guide",
    asset_type: "pdf",
    file_ext: "pdf",
    mime_type: "application/pdf",
    size_bytes: 190000,
    available: true,
    status: "available_for_download"
  },
  {
    asset_id: "demo_complete_collection",
    deliverable_code: "download_package_zip",
    friendly_name: "Complete Collection Archive",
    asset_type: "archive",
    file_ext: "zip",
    mime_type: "application/zip",
    size_bytes: 1280000,
    available: true,
    status: "available_for_download"
  }
];

const demoVault: DownloadVaultData = {
  order_number: "FOUNDER-DEMO",
  download_token_status: "active",
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
  download_count: 0,
  max_downloads: 20,
  assets_ready: true,
  assets_summary: [],
  disclaimer:
    "This is a personalized heritage-inspired symbolic keepsake. It is not official arms or a genealogy claim."
};

const artifactDescriptions: Record<string, string> = {
  collection_letter: "A warm opening note that explains why the collection was prepared.",
  crest_artwork: "A symbolic family centerpiece shaped around values, story, and belonging.",
  crest_variant_1_png: "A symbolic family centerpiece shaped around values, story, and belonging.",
  crest_variant_2_png: "A second crest artwork option for family review.",
  crest_variant_3_png: "A third crest artwork option for family review.",
  transparent_crest_png: "A transparent crest artwork prepared for personal display uses.",
  heritage_certificate_pdf: "A ceremonial keepsake for gifting, printing, and preserving.",
  family_story_pdf: "A written family narrative meant to be read, shared, and kept.",
  symbol_explanation_pdf: "A guide to the symbols, colors, and motto in the collection.",
  download_package_zip: "The complete private collection prepared for safekeeping."
};

export function DownloadVault({ token }: { token: string }) {
  const [vault, setVault] = useState<DownloadVaultData | null>(null);
  const [assets, setAssets] = useState<DownloadAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingAsset, setDownloadingAsset] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(), []);
  const isFounderDemo = token.startsWith("dev-demo-") && process.env.NODE_ENV === "development";

  async function load() {
    if (isFounderDemo) {
      setVault(demoVault);
      setAssets(demoArtifacts);
      setError(null);
      trackEvent("founder_demo_vault_opened", { order_number: demoVault.order_number });
      return;
    }
    setError(null);
    try {
      const [vaultResult, assetResult] = await Promise.all([
        api.getDownloadVault(token),
        api.getDownloadAssets(token)
      ]);
      setVault(vaultResult);
      setAssets(assetResult);
      trackEvent("download_vault_opened", { order_number: vaultResult.order_number });
      trackEvent("vault_opened", { order_number: vaultResult.order_number, source: "download_vault" }, { stepName: "vault" });
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Download vault could not be loaded.";
      setError(message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function download(asset: DownloadAsset) {
    if (isFounderDemo) {
      downloadDemoCollection(asset);
      return;
    }
    if (!asset.available) {
      setError("This asset is not ready yet. Refresh status and try again.");
      return;
    }
    setDownloadingAsset(asset.asset_id);
    setError(null);
    try {
      const signed = await api.createSignedAssetUrl(token, asset.asset_id);
      trackEvent(
        asset.deliverable_code.includes("zip") ? "zip_download_clicked" : "asset_download_clicked",
        {
          asset_id: asset.asset_id,
          deliverable_code: asset.deliverable_code
        }
      );
      trackEvent(
        "artifact_downloaded",
        {
          asset_id: asset.asset_id,
          deliverable_code: asset.deliverable_code,
          file_ext: asset.file_ext
        },
        { stepName: "artifact_download" }
      );
      window.location.assign(signed.signed_url);
    } catch {
      setError("Signed URL failed. Please try again.");
    } finally {
      setDownloadingAsset(null);
    }
  }

  function downloadUrl(asset: DownloadAsset): string {
    return api.createAssetDownloadUrl(token, asset.asset_id);
  }

  function trackDownloadClick(asset: DownloadAsset) {
    trackEvent(
      asset.deliverable_code.includes("zip") ? "zip_download_clicked" : "asset_download_clicked",
      {
        asset_id: asset.asset_id,
        deliverable_code: asset.deliverable_code
      }
    );
    trackEvent(
      "artifact_downloaded",
      {
        asset_id: asset.asset_id,
        deliverable_code: asset.deliverable_code,
        file_ext: asset.file_ext
      },
      { stepName: "artifact_download" }
    );
  }

  const sortedAssets = [...assets].sort((a, b) => artifactOrder(a) - artifactOrder(b));
  const hasPlaceholderAssets = sortedAssets.some(isPlaceholderAsset);
  const hasMeaningContext = Boolean(vault?.meaning_profile || vault?.collection_content);
  const firstPdfAsset = sortedAssets.find(
    (asset) => asset.file_ext === "pdf" && asset.available && !isPlaceholderAsset(asset)
  );
  const completeCollectionAsset = sortedAssets.find(
    (asset) =>
      asset.deliverable_code === "download_package_zip" &&
      asset.available &&
      !isPlaceholderAsset(asset)
  );

  async function downloadCompleteCollection() {
    if (!completeCollectionAsset) {
      setError("The complete collection archive is not ready yet.");
      return;
    }
    await download(completeCollectionAsset);
  }

  return (
    <>
      <section className="vault-hero">
        <div className="section interview-hero-grid">
          <div>
            <p className="eyebrow">{isFounderDemo ? "Founder Demo Collection" : "Private Collection Vault"}</p>
            <h1>Your Private Legacy Vault Is Ready</h1>
            <p className="lead">
              Open the private artifacts prepared for this family collection. This vault is private,
              token-protected, and designed for family keeping.
            </p>
          </div>
          <div className="vault-display-case">
            <span>Private Archive</span>
            <strong>Ready for review.</strong>
            <p>Your token is never displayed on this page.</p>
          </div>
        </div>
      </section>
      <div className="section">
        {error ? <p className="error">{error}</p> : null}
        {vault ? (
          <section className="vault-summary" aria-label="Vault summary">
            <div className="file-thumb png" aria-hidden="true" />
            <div>
              <span className="muted">Order Number</span>
              <h2 className="vault-order-number">{vault.order_number}</h2>
            </div>
            <div>
              <span className="muted">Expires On</span>
              <strong>{new Date(vault.expires_at).toLocaleDateString()}</strong>
            </div>
            <div>
              <span className="muted">Downloads Used</span>
              <strong>
                {vault.download_count} / {vault.max_downloads}
              </strong>
            </div>
          </section>
        ) : null}

        {vault && hasMeaningContext ? (
          <PrivateVaultPreview
            vaultReady={vault.assets_ready}
            meaningProfile={vault.meaning_profile}
            collectionContent={vault.collection_content}
          />
        ) : vault ? (
          <section className="private-vault-preview" aria-label="Vault meaning fallback">
            <div className="vault-preview-header">
              <p className="eyebrow">Meaning basis</p>
              <h2>Collection meaning is being prepared</h2>
              <p>
                This vault is ready, but the Meaning Engine profile is not attached to this token
                yet. The artifacts below remain private and available through this secure vault.
              </p>
            </div>
          </section>
        ) : null}

        <section className="section-tight vault-artifact-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Private artifacts</p>
              <h2>Your Collection Artifacts</h2>
            </div>
            {vault ? <span className="vault-status-pill">{vault.assets_ready ? "Vault ready" : "Preparing"}</span> : null}
          </div>
          <p className="lead">
            Review each part of the collection, then save the complete private collection for family
            keeping.
          </p>
          <div className="vault-download-actions" aria-label="Primary vault downloads">
            {isFounderDemo || !firstPdfAsset ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => (firstPdfAsset ? void download(firstPdfAsset) : undefined)}
                disabled={!firstPdfAsset || downloadingAsset === firstPdfAsset.asset_id}
              >
                {firstPdfAsset && downloadingAsset === firstPdfAsset.asset_id
                  ? "Preparing PDF..."
                  : "Download PDF"}
              </button>
            ) : (
              <a
                className="secondary-button"
                href={downloadUrl(firstPdfAsset)}
                download={downloadFileName(firstPdfAsset)}
                onClick={() => trackDownloadClick(firstPdfAsset)}
              >
                Download PDF
              </a>
            )}
            {isFounderDemo || !completeCollectionAsset ? (
              <button
                className="button"
                type="button"
                onClick={() => void downloadCompleteCollection()}
                disabled={!completeCollectionAsset || downloadingAsset === completeCollectionAsset.asset_id}
              >
                {completeCollectionAsset && downloadingAsset === completeCollectionAsset.asset_id
                  ? "Preparing ZIP..."
                  : "Download Collection ZIP"}
              </button>
            ) : (
              <a
                className="button"
                href={downloadUrl(completeCollectionAsset)}
                download={downloadFileName(completeCollectionAsset)}
                onClick={() => trackDownloadClick(completeCollectionAsset)}
              >
                Download Collection ZIP
              </a>
            )}
          </div>
          {hasPlaceholderAssets ? (
            <p className="notice alpha-vault-notice">
              This internal alpha order contains placeholder collection artifacts. Future real
              customer orders should replace these with final generated collection files.
            </p>
          ) : null}
          <div className="vault-artifact-grid">
            {sortedAssets.map((asset) => (
              <article className="vault-artifact-card" key={asset.asset_id}>
                <span className={`vault-artifact-icon ${asset.file_ext}`} aria-hidden="true" />
                <div>
                  <h3>{asset.friendly_name}</h3>
                  <p className="muted">
                    {artifactDescriptions[asset.deliverable_code] ?? "A private collection artifact."}
                  </p>
                </div>
                <div className="artifact-meta-row">
                  <span>{asset.file_ext.toUpperCase()}</span>
                  <span className={asset.available ? "status-ready" : "muted"}>
                    {asset.available ? "Ready" : asset.status}
                  </span>
                  {formatArtifactSizeLabel(asset) ? <span>{formatArtifactSizeLabel(asset)}</span> : null}
                </div>
                <div>
                  {isFounderDemo ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void download(asset)}
                      disabled={!asset.available || downloadingAsset === asset.asset_id}
                    >
                      {downloadingAsset === asset.asset_id ? "Preparing..." : downloadLabel(asset)}
                    </button>
                  ) : asset.available ? (
                    <a
                      className="secondary-button"
                      href={downloadUrl(asset)}
                      download={downloadFileName(asset)}
                      onClick={() => trackDownloadClick(asset)}
                    >
                      {downloadLabel(asset)}
                    </a>
                  ) : (
                    <button className="secondary-button" type="button" disabled>
                      Preparing...
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {isFounderDemo || !completeCollectionAsset ? (
            <button
              className="button"
              type="button"
              onClick={() => void downloadCompleteCollection()}
              disabled={!completeCollectionAsset}
            >
              Download Complete Collection
            </button>
          ) : (
            <a
              className="button"
              href={downloadUrl(completeCollectionAsset)}
              download={downloadFileName(completeCollectionAsset)}
              onClick={() => trackDownloadClick(completeCollectionAsset)}
            >
              Download Complete Collection
            </a>
          )}
        </section>

        <section className="support-layout section-tight">
          <div className="side-panel">
            <h2>Need Help?</h2>
            <p className="muted">
              We can review expired links, missing artifacts, and delivery questions.
            </p>
            <Link className="secondary-button" href="/support">
              Contact Support
            </Link>
          </div>
          <div className="side-panel">
            <h2>Your Privacy. Our Promise.</h2>
            <p className="muted">
              This private link is unique to you and should not be shared publicly. For your
              privacy, the raw vault token is never shown on this page.
            </p>
            <button className="secondary-button" type="button" onClick={() => void load()}>
              Refresh status
            </button>
          </div>
        </section>

        {vault?.disclaimer ? <p className="notice">{vault.disclaimer}</p> : null}
      </div>
    </>
  );
}

export function isPlaceholderAsset(asset: Pick<DownloadAsset, "size_bytes" | "status">): boolean {
  return (
    asset.size_bytes > 0 &&
    asset.size_bytes <= 512 &&
    (asset.status === "available_for_download" || asset.status === "available")
  );
}

export function formatArtifactSizeLabel(asset: Pick<DownloadAsset, "size_bytes" | "status">): string | null {
  if (!asset.size_bytes || isPlaceholderAsset(asset)) return null;
  return formatBytes(asset.size_bytes);
}

export function downloadLabel(asset: Pick<DownloadAsset, "file_ext" | "deliverable_code">): string {
  if (asset.deliverable_code === "download_package_zip" || asset.file_ext === "zip") {
    return "Download ZIP";
  }
  if (asset.file_ext === "pdf") {
    return "Download PDF";
  }
  if (asset.file_ext === "png") {
    return "Download PNG";
  }
  return "Download Artifact";
}

export function downloadFileName(asset: Pick<DownloadAsset, "friendly_name" | "file_ext">): string {
  const safeBaseName = asset.friendly_name
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeBaseName || "MyKinLegacy-Artifact"}.${asset.file_ext}`;
}

function artifactOrder(asset: DownloadAsset): number {
  const order: Record<string, number> = {
    collection_letter: 1,
    crest_artwork: 2,
    crest_variant_1_png: 2,
    crest_variant_2_png: 3,
    crest_variant_3_png: 4,
    transparent_crest_png: 5,
    heritage_certificate_pdf: 6,
    family_story_pdf: 7,
    symbol_explanation_pdf: 8,
    download_package_zip: 9
  };
  return order[asset.deliverable_code] ?? 50;
}

function downloadDemoCollection(asset: DownloadAsset): void {
  const body = [
    "MyKinLegacy Founder Demo Collection",
    "",
    `Artifact: ${asset.friendly_name}`,
    "",
    artifactDescriptions[asset.deliverable_code] ?? "A private collection artifact.",
    "",
    "Included in the complete Family Legacy Collection:",
    "- Collection Letter",
    "- Crest Artwork",
    "- Heritage Certificate",
    "- Family Story",
    "- Symbol Guide",
    "- Complete Collection Archive",
    "",
    "This demo artifact proves the Founder can move from checkout to vault to collection access without admin, logs, or email."
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    asset.deliverable_code === "download_package_zip"
      ? "mykinlegacy-complete-collection-demo.txt"
      : `${asset.deliverable_code}-demo.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
