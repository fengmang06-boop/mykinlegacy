import React from "react";

import type { VaultMeaningProfile } from "../lib/api-client";

const includedItems = [
  "Heritage Certificate",
  "Family Story",
  "Symbol Guide",
  "Crest Artwork",
  "Collection Letter",
  "Private Vault Access"
];

interface VaultMeaningProps {
  meaningProfile?: VaultMeaningProfile | null;
  vaultReady?: boolean;
}

export function PrivateVaultPreview({ meaningProfile, vaultReady = false }: VaultMeaningProps) {
  const hasMeaning = hasMeaningProfile(meaningProfile);

  return (
    <section className="private-vault-preview" aria-label="Private vault collection preview">
      <div className="vault-preview-header">
        <p className="eyebrow">Collection meaning</p>
        <h2>{vaultReady ? "Inside your private vault" : "What your vault is preparing"}</h2>
        <p>
          This preview explains the meaning basis behind the collection. It is written for the
          family, not for internal production review.
        </p>
      </div>

      {hasMeaning ? (
        <>
          <VaultMeaningSummary meaningProfile={meaningProfile} />
          <MeaningThemeList meaningProfile={meaningProfile} />
          <SymbolRationaleList meaningProfile={meaningProfile} />
          <div className="vault-meaning-two-column">
            <DesignBasisPanel meaningProfile={meaningProfile} />
            <StoryDirectionPanel meaningProfile={meaningProfile} />
            <CertificateDirectionPanel meaningProfile={meaningProfile} />
            <BoundaryStatementNotice meaningProfile={meaningProfile} />
          </div>
        </>
      ) : (
        <MeaningFallback />
      )}

      <VaultIncludedItems />
    </section>
  );
}

export function VaultMeaningSummary({ meaningProfile }: VaultMeaningProps) {
  const themes = cleanThemes(meaningProfile);
  const symbols = cleanSymbols(meaningProfile);
  const strongestTheme = themes[0]?.theme ?? "family meaning";
  const strongestSymbol = symbols[0]?.symbol ?? "chosen symbols";

  return (
    <article className="vault-meaning-card vault-meaning-summary">
      <span>House Meaning Summary</span>
      <h3>
        A private symbolic collection centered on {strongestTheme.toLowerCase()} and expressed
        through {strongestSymbol.toLowerCase()}.
      </h3>
      <p>
        The collection uses the family&apos;s values, memories, and symbolic choices to form a
        keepsake that feels personal, gift-ready, and safe to preserve.
      </p>
    </article>
  );
}

export function MeaningThemeList({ meaningProfile }: VaultMeaningProps) {
  const themes = cleanThemes(meaningProfile);
  return (
    <article className="vault-meaning-card">
      <span>Meaning Themes</span>
      <h3>What this family stands for</h3>
      <div className="meaning-chip-list">
        {themes.length ? (
          themes.map((theme) => (
            <div className="meaning-chip" key={`${theme.theme}-${theme.confidence}`}>
              <strong>{theme.theme}</strong>
              <small>{theme.evidence || `${theme.confidence} confidence`}</small>
            </div>
          ))
        ) : (
          <p>No themes were attached to this collection yet.</p>
        )}
      </div>
    </article>
  );
}

export function SymbolRationaleList({ meaningProfile }: VaultMeaningProps) {
  const symbols = cleanSymbols(meaningProfile);
  return (
    <article className="vault-meaning-card">
      <span>Chosen Symbols</span>
      <h3>Why these symbols were chosen</h3>
      <div className="symbol-rationale-list">
        {symbols.length ? (
          symbols.map((symbol) => (
            <div className="symbol-rationale" key={`${symbol.symbol}-${symbol.meaning}`}>
              <strong>{symbol.symbol}</strong>
              <p>{symbol.meaning}</p>
              <small>{symbol.rationale}</small>
            </div>
          ))
        ) : (
          <p>No symbol rationale was attached to this collection yet.</p>
        )}
      </div>
    </article>
  );
}

export function DesignBasisPanel({ meaningProfile }: VaultMeaningProps) {
  const rationale = cleanStrings(meaningProfile?.design_rationale);
  return (
    <article className="vault-meaning-card compact">
      <span>Design Basis</span>
      <h3>How the collection should feel</h3>
      {rationale.length ? (
        <ul>
          {rationale.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>Design basis will appear here when the Meaning Engine profile is available.</p>
      )}
    </article>
  );
}

export function StoryDirectionPanel({ meaningProfile }: VaultMeaningProps) {
  return (
    <article className="vault-meaning-card compact">
      <span>Story Direction</span>
      <h3>The story this collection should tell</h3>
      <p>{meaningProfile?.story_direction || "Story direction is not attached yet."}</p>
    </article>
  );
}

export function CertificateDirectionPanel({ meaningProfile }: VaultMeaningProps) {
  return (
    <article className="vault-meaning-card compact">
      <span>Certificate Direction</span>
      <h3>How the keepsake should be presented</h3>
      <p>{meaningProfile?.certificate_direction || "Certificate direction is not attached yet."}</p>
    </article>
  );
}

export function BoundaryStatementNotice({ meaningProfile }: VaultMeaningProps) {
  return (
    <article className="vault-meaning-card compact boundary">
      <span>Boundary Statement</span>
      <h3>Symbolic by design</h3>
      <p>
        {meaningProfile?.boundary_statement ||
          "MyKinLegacy creates personalized symbolic keepsakes. It does not provide official coats of arms, legal heraldic grants, noble title claims, or certified genealogical records."}
      </p>
    </article>
  );
}

export function VaultIncludedItems() {
  return (
    <article className="vault-meaning-card vault-included-items">
      <span>Private Vault Includes</span>
      <h3>Prepared as a private digital collection</h3>
      <div className="included-items-grid">
        {includedItems.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </article>
  );
}

function MeaningFallback() {
  return (
    <article className="vault-meaning-card vault-meaning-fallback">
      <span>Meaning basis</span>
      <h3>Meaning Engine profile not attached</h3>
      <p>
        This collection was completed before the Meaning Engine profile was generated. A symbolic
        design basis can be generated for future collections.
      </p>
    </article>
  );
}

function hasMeaningProfile(profile?: VaultMeaningProfile | null): profile is VaultMeaningProfile {
  return Boolean(
    profile &&
      (cleanThemes(profile).length ||
        cleanSymbols(profile).length ||
        cleanStrings(profile.design_rationale).length ||
        profile.story_direction ||
        profile.certificate_direction ||
        profile.boundary_statement)
  );
}

function cleanThemes(profile?: VaultMeaningProfile | null) {
  return (profile?.themes ?? [])
    .map((theme) => ({
      theme: cleanText(theme.theme) || "Meaning theme",
      confidence: cleanText(theme.confidence) || "medium",
      evidence: cleanText(theme.evidence)
    }))
    .filter((theme) => theme.theme);
}

function cleanSymbols(profile?: VaultMeaningProfile | null) {
  return (profile?.symbols ?? [])
    .map((symbol) => ({
      symbol: cleanText(symbol.symbol) || "Symbol",
      meaning: cleanText(symbol.meaning) || "A family symbol selected for this collection.",
      rationale: cleanText(symbol.rationale) || "Selected from the family identity inputs."
    }))
    .filter((symbol) => symbol.symbol);
}

function cleanStrings(values?: string[]) {
  return (values ?? []).map(cleanText).filter((value): value is string => Boolean(value));
}

function cleanText(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
