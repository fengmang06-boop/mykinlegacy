import React from "react";

import type { VaultCollectionContent, VaultMeaningProfile } from "../lib/api-client";

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
  collectionContent?: VaultCollectionContent | null;
  vaultReady?: boolean;
}

export function PrivateVaultPreview({
  meaningProfile,
  collectionContent,
  vaultReady = false
}: VaultMeaningProps) {
  const hasMeaning = hasMeaningProfile(meaningProfile);
  const hasContent = hasCollectionContent(collectionContent);

  return (
    <section className="private-vault-preview" aria-label="Private vault collection preview">
      <div className="vault-preview-header">
        <p className="eyebrow">Collection meaning</p>
        <h2>{vaultReady ? "Inside your private vault" : "The keepsake taking shape"}</h2>
        <p>
          A simple preview of the family meaning, symbols, and story that shaped this private
          collection.
        </p>
      </div>

      {hasMeaning ? (
        <>
          <VaultMeaningSummary meaningProfile={meaningProfile} />
          <CollectionDocuments collectionContent={collectionContent} />
          <MeaningThemeList meaningProfile={meaningProfile} />
          <SymbolRationaleList meaningProfile={meaningProfile} />
          <div className="vault-meaning-two-column">
            <DesignBasisPanel meaningProfile={meaningProfile} />
            <StoryDirectionPanel meaningProfile={meaningProfile} />
            <CertificateDirectionPanel meaningProfile={meaningProfile} />
            <BoundaryStatementNotice />
          </div>
        </>
      ) : (
        <MeaningFallback />
      )}

      {!hasContent && hasMeaning ? <CollectionContentFallback /> : null}
      <VaultIncludedItems />
    </section>
  );
}

export function CollectionDocuments({ collectionContent }: VaultMeaningProps) {
  if (!hasCollectionContent(collectionContent)) return null;

  const documents = [
    {
      title: "House Meaning Summary",
      body: collectionContent.house_meaning_summary
    },
    {
      title: "Family Story",
      body: collectionContent.family_story
    },
    {
      title: "Certificate Text",
      body: collectionContent.certificate_text
    },
    {
      title: "Collection Letter",
      body: collectionContent.collection_letter
    },
    {
      title: "Design Basis",
      body: collectionContent.design_basis
    }
  ].filter((item): item is { title: string; body: string } => Boolean(cleanText(item.body)));

  return (
    <article className="vault-meaning-card collection-documents">
      <span>Collection Documents</span>
      <h3>Written for your private archive</h3>
      <p>
        These are the first customer-readable sections prepared from the family meaning profile.
      </p>
      <div className="collection-document-list">
        {documents.map((document, index) => (
          <details key={document.title} open={index === 0}>
            <summary>{document.title}</summary>
            <p>{document.body}</p>
          </details>
        ))}
      </div>
      {collectionContent.symbol_guide?.length ? (
        <section className="collection-symbol-guide" aria-label="Symbol guide">
          <h4>Symbol Guide</h4>
          {collectionContent.symbol_guide.map((symbol) => (
            <div className="collection-symbol-guide-item" key={`${symbol.symbol}-${symbol.meaning}`}>
              <strong>{cleanText(symbol.symbol) ?? "Symbol"}</strong>
              <p>{cleanText(symbol.meaning) ?? "A symbolic part of this collection."}</p>
              <details>
                <summary>Why it belongs here</summary>
                <small>{cleanText(symbol.why_chosen) ?? "Selected from the family meaning profile."}</small>
                <small>
                  {cleanText(symbol.emotional_relevance) ??
                    "Included to make the collection feel personal and memorable."}
                </small>
              </details>
            </div>
          ))}
        </section>
      ) : null}
      <BoundaryStatementNotice boundaryStatement={collectionContent.boundary_statement} />
    </article>
  );
}

export function VaultMeaningSummary({ meaningProfile }: VaultMeaningProps) {
  const themes = cleanThemes(meaningProfile);
  const symbols = cleanSymbols(meaningProfile);
  const themePhrase = formatThemePhrase(themes.map((theme) => theme.theme).slice(0, 3));
  const strongestSymbol = symbols[0]?.symbol ?? "chosen symbols";

  return (
    <article className="vault-meaning-card vault-meaning-summary">
      <span>Your Collection At A Glance</span>
      <h3>Your collection was shaped around {themePhrase.toLowerCase()}.</h3>
      <p>
        It translates those family qualities into a symbolic keepsake, with {strongestSymbol} as
        one of the visual anchors.
      </p>
    </article>
  );
}

export function MeaningThemeList({ meaningProfile }: VaultMeaningProps) {
  const themes = cleanThemes(meaningProfile);
  return (
    <article className="vault-meaning-card">
      <span>The Meaning Behind This Collection</span>
      <h3>What your family stands for</h3>
      <div className="meaning-chip-list">
        {themes.length ? (
          themes.map((theme) => (
            <div className="meaning-chip" key={`${theme.theme}-${theme.confidence}`}>
              <strong>{theme.theme}</strong>
              {theme.evidence ? (
                <details>
                  <summary>Why this matters</summary>
                  <small>{theme.evidence}</small>
                </details>
              ) : null}
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
      <span>Symbols Chosen for Your Family</span>
      <h3>What each symbol carries</h3>
      <div className="symbol-rationale-list">
        {symbols.length ? (
          symbols.map((symbol) => (
            <div className="symbol-rationale" key={`${symbol.symbol}-${symbol.meaning}`}>
              <strong>{symbol.symbol}</strong>
              <p>{symbol.meaning}</p>
              <details>
                <summary>Why it was chosen</summary>
                <small>{symbol.rationale}</small>
              </details>
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
      <span>Why It Was Designed This Way</span>
      <h3>A visual direction with purpose</h3>
      {rationale.length ? (
        <>
          <p>{rationale[0]}</p>
          {rationale.length > 1 ? (
            <details>
              <summary>More design notes</summary>
              <ul>
                {rationale.slice(1).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p>The design direction will appear here when the meaning profile is available.</p>
      )}
    </article>
  );
}

export function StoryDirectionPanel({ meaningProfile }: VaultMeaningProps) {
  return (
    <article className="vault-meaning-card compact">
      <span>The Story This Collection Tells</span>
      <h3>The story this collection should tell</h3>
      <p>{meaningProfile?.story_direction || "Story direction is not attached yet."}</p>
    </article>
  );
}

export function CertificateDirectionPanel({ meaningProfile }: VaultMeaningProps) {
  return (
    <article className="vault-meaning-card compact">
      <span>How the Certificate Should Feel</span>
      <h3>How the keepsake should be presented</h3>
      <p>{meaningProfile?.certificate_direction || "Certificate direction is not attached yet."}</p>
    </article>
  );
}

export function BoundaryStatementNotice({ boundaryStatement }: { boundaryStatement?: string | null } = {}) {
  return (
    <article className="vault-meaning-card compact boundary">
      <span>Important Note</span>
      <h3>A symbolic family keepsake</h3>
      <p>{cleanText(boundaryStatement) ?? defaultBoundaryStatement}</p>
    </article>
  );
}

export function VaultIncludedItems() {
  return (
    <article className="vault-meaning-card vault-included-items">
      <span>Private Vault Includes</span>
      <h3>Everything prepared for keeping</h3>
      <div className="included-items-grid">
        {includedItems.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </article>
  );
}

function formatThemePhrase(themes: string[]) {
  const clean = themes.filter(Boolean);
  if (clean.length === 0) return "family meaning";
  if (clean.length === 1) return clean[0] ?? "family meaning";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean[0]}, ${clean[1]}, and ${clean[2]}`;
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

function CollectionContentFallback() {
  return (
    <article className="vault-meaning-card vault-meaning-fallback">
      <span>Collection Documents</span>
      <h3>Documents are being prepared</h3>
      <p>
        This order has a Meaning Engine profile, but the final customer-readable collection
        documents were not attached yet. Future completed orders will show the written collection
        sections here.
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

function hasCollectionContent(content?: VaultCollectionContent | null): content is VaultCollectionContent {
  return Boolean(
    content &&
      (cleanText(content.house_meaning_summary) ||
        cleanText(content.family_story) ||
        cleanText(content.certificate_text) ||
        cleanText(content.collection_letter) ||
        cleanText(content.design_basis) ||
        cleanText(content.boundary_statement) ||
        (content.symbol_guide?.length ?? 0) > 0)
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

const defaultBoundaryStatement =
  "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";
