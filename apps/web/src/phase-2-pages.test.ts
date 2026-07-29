import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname);
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const home = read("app/page.tsx");
const collection = read("app/family-legacy-collection/page.tsx");
const examples = read("app/real-examples/page.tsx");
const globalCss = read("app/globals.css");
const collectionCss = read("app/collection.css");
const layout = read("app/layout.tsx");

const deliverables = [
  "Final Crest",
  "Heritage Certificate",
  "Family Story",
  "Meaning Behind Your Crest",
  "Complete Collection"
];

describe("Phase 2 local page contracts", () => {
  it("keeps the five connected deliverables accurate on Homepage and Collection", () => {
    for (const name of deliverables) {
      expect(home).toContain(name);
      expect(collection).toContain(name);
    }
    expect((collection.match(/name: "(Final Crest|Heritage Certificate|Family Story|Meaning Behind Your Crest|Complete Collection)"/g) ?? [])).toHaveLength(5);
  });

  it("classifies Private Vault as delivery and never a sixth deliverable", () => {
    expect(home).toContain("private vault");
    expect(collection).toContain("Private Vault delivery");
    expect(examples).toContain("delivery method");
    expect(examples).toContain("not a sixth deliverable");
    expect(deliverables).not.toContain("Private Vault");
  });

  it("shows price, digital delivery, founder review, and no physical shipping", () => {
    for (const source of [home, collection, examples]) {
      expect(source).toContain("USD $49");
      expect(source.toLowerCase()).toContain("founder review");
      expect(source.toLowerCase()).toContain("digital");
      expect(source.toLowerCase()).toContain("no physical shipping");
    }
  });

  it("states the non-heraldry and non-genealogy boundaries", () => {
    expect(home).toContain("not inherited arms, official heraldry, or genealogical proof");
    expect(collection).toContain("not official or inherited arms");
    expect(examples).toContain("no ancestry");
  });

  it("does not add fabricated review or aggregate-rating schema", () => {
    for (const source of [home, collection, examples]) {
      expect(source).not.toContain('"AggregateRating"');
      expect(source).not.toContain('"@type": "Review"');
    }
  });

  it("labels all public Phase 2 studies as illustrative", () => {
    expect(examples.match(/id: "(father-retirement|parents-anniversary|migration-journey|birthstone-family)"/g)).toHaveLength(4);
    expect(examples).toContain("Illustrative Design Study");
    expect(examples).toContain("not a real customer case");
    expect(home).toContain("Illustrative Design Study");
    expect(collection).toContain("Illustrative Design Study");
    expect(examples).not.toContain("Real customer");
  });

  it("shows at least four structurally different directions", () => {
    for (const direction of ["Father Retirement", "Parents Anniversary", "Migration / Journey", "Birthstone / Family Members"]) {
      expect(examples).toContain(direction);
    }
    for (const dimension of ["Silhouette", "Primary evidence", "Composition", "Material", "Emotional tone"]) {
      expect(examples).toContain(dimension);
    }
  });

  it("uses contain for Phase 2 product and study imagery", () => {
    expect(globalCss.match(/object-fit:\s*contain/g)?.length).toBeGreaterThanOrEqual(3);
    expect(collectionCss).toContain("object-fit: contain");
    expect(globalCss).not.toMatch(/px2-[^{]+\{[^}]*object-fit:\s*cover/s);
  });

  it("keeps one shared header and footer at the root layout", () => {
    expect(layout.match(/<SiteHeader \/>/g)).toHaveLength(1);
    expect(layout.match(/<footer /g)).toHaveLength(1);
    for (const source of [home, collection, examples]) {
      expect(source).not.toContain("<SiteHeader");
      expect(source).not.toContain("<footer");
    }
  });

  it("keeps each Phase 2 surface to one H1 and accessible CTAs", () => {
    for (const source of [home, collection, examples]) {
      expect(source.match(/<h1(?:\s|>)/g)).toHaveLength(1);
      expect(source).toContain('href="/create"');
    }
  });

  it("does not contain production mutation or indexing behavior", () => {
    for (const source of [home, collection, examples]) {
      expect(source).not.toMatch(/indexingApi|requestIndexing|submitSitemap|create-checkout-session/);
    }
  });

  it("uses distinct, unobstructed hero systems for Homepage and Collection", () => {
    expect(home).toContain("hv2-hero-suite");
    expect(collection).toContain("cv2-product-board");
    expect(home).not.toContain("hv2-document-stack");
    expect(collection).not.toContain("cv2-suite");
    expect(home).toContain("05a-compass-journey-medallion.png");
    expect(collection).toContain("03a-gothic-memory-lantern.png");
    expect(globalCss).toContain(".hv2-hero-suite");
    expect(collectionCss).toContain(".cv2-product-board");
  });

  it("keeps Vault as delivery wording and removes the rejected phrase", () => {
    expect(collection).toContain("delivered privately through your secure vault");
    expect(collection).not.toContain("one private Vault");
  });

  it("places at least three design directions above the Examples fold", () => {
    expect(examples).toContain("px2-hero-directions");
    expect(examples).toContain("<FinishedStudyArtwork study={studies[2]} priority");
    expect(examples).toContain("<FinishedStudyArtwork study={studies[3]} compact");
    expect(examples).toContain("<FinishedStudyArtwork study={studies[0]} compact");
    expect(examples).not.toContain("design outcomes");
  });

  it("provides four materially different, mostly non-shield visual directions", () => {
    for (const direction of ["journey", "birthstone", "craft", "anniversary"]) {
      expect(examples).toContain(`art: "${direction}"`);
      expect(globalCss).toContain(`.px2-finished-${direction}`);
    }
    expect(examples.match(/usesShield: false/g)).toHaveLength(4);
    expect(examples.match(/usesTree: false/g)).toHaveLength(4);
    expect(examples).not.toContain("DirectionArtwork");
    expect(globalCss).not.toContain(".px2-direction-art");
  });

  it("locks the warm Collection hero to high-contrast mobile text tokens", () => {
    expect(collectionCss).toContain(".cv2-hero h1 { color: #17372c; }");
    expect(collectionCss).toContain("color: #3f453f;");
    expect(collectionCss).toContain(".cv2-hero .cv2-includes strong { color: #744517; }");
    expect(collectionCss).toContain(".cv2-hero .cv2-trust-line strong { color: #744517; }");
    expect(collectionCss).toContain("font-size: 2.75rem;");
    expect(collectionCss).not.toMatch(/\.cv2-hero h1\s*\{[^}]*color:\s*#fff/i);
  });
});
