import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(__dirname);
const repositoryRoot = path.resolve(sourceRoot, "../../..");
const read = (relative: string) =>
  fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

const home = read("apps/web/src/app/page.tsx");
const collection = read("apps/web/src/app/family-legacy-collection/page.tsx");
const examples = read("apps/web/src/app/real-examples/page.tsx");
const layout = read("apps/web/src/app/layout.tsx");
const nextConfig = read("apps/web/next.config.mjs");
const workflow = read(".github/workflows/deploy-production.yml");
const deploy = read("deployment/deploy.sh");

const publicPages = [home, collection, examples];
const deliverables = [
  "Final Crest",
  "Heritage Certificate",
  "Family Story",
  "Meaning Behind Your Crest",
  "Complete Collection"
];

describe("V2 Phase 3 public release boundary", () => {
  it("keeps internal workbench, synthetic records, and internal art direction out of public pages", () => {
    for (const source of publicPages) {
      expect(source).not.toContain("admin/v2-design-brief");
      expect(source).not.toContain("DesignBriefWorkbench");
      expect(source).not.toContain("SYNTHETIC_TEST_PROFILE");
      expect(source).not.toContain("FR-EV-");
      expect(source).not.toContain("INTERNAL_ART_DIRECTION");
      expect(source).not.toContain("DirectionArtwork");
    }
  });

  it("renders only the four approved public finished studies", () => {
    expect(examples.match(/assetLayer: "PUBLIC_FINISHED_STUDY"/g)).toHaveLength(4);
    expect(examples).toContain("Illustrative Design Study");
    expect(examples).toContain("not a real customer case");
    expect(examples).not.toContain("Real Customer");
    expect(examples).not.toContain("Client Case");
  });

  it("keeps the consumer product contract and price truthful", () => {
    for (const deliverable of deliverables) {
      expect(home).toContain(deliverable);
      expect(collection).toContain(deliverable);
    }
    for (const source of publicPages) {
      expect(source).toContain("USD $49");
      expect(source.toLowerCase()).toContain("digital");
      expect(source.toLowerCase()).toContain("founder review");
      expect(source.toLowerCase()).toContain("no physical shipping");
    }
    const deliverableBlock = collection.slice(
      collection.indexOf("const deliverables"),
      collection.indexOf("const examples")
    );
    expect(deliverableBlock.match(/name: "/g)).toHaveLength(5);
    expect(deliverableBlock).not.toContain('name: "Private Vault"');
    expect(examples).toContain("Private Vault is the delivery method");
  });

  it("keeps schema counts and commercial claims within the approved boundary", () => {
    expect(layout.match(/"@type": "Organization"/g)).toHaveLength(1);
    expect(layout.match(/"@type": "WebSite"/g)).toHaveLength(1);
    expect(collection.match(/"@type": "WebPage"/g)).toHaveLength(1);
    expect(collection.match(/"@type": "BreadcrumbList"/g)).toHaveLength(1);
    expect(collection.match(/"@type": "Product"/g)).toHaveLength(1);
    expect(collection).toContain('price: "49.00"');
    for (const source of publicPages) {
      expect(source).not.toContain('"@type": "Review"');
      expect(source).not.toContain('"AggregateRating"');
    }
  });
});

describe("V2 Phase 3 image and deployment hardening", () => {
  it("negotiates AVIF and WebP and supplies responsive image sizes", () => {
    expect(nextConfig).toContain('formats: ["image/avif", "image/webp"]');
    expect(home.match(/sizes=/g)?.length).toBeGreaterThanOrEqual(10);
    expect(collection.match(/sizes=/g)?.length).toBeGreaterThanOrEqual(8);
    expect(examples).toContain("sizes={compact ?");
  });

  it("preloads only one intended hero image per public page", () => {
    expect(home.match(/\bpriority\b/g)).toHaveLength(1);
    expect(collection.match(/\bpriority\b/g)).toHaveLength(1);
    expect(examples.match(/<FinishedStudyArtwork study=\{studies\[2\]\} priority/g)).toHaveLength(1);
  });

  it("uses the production lock, disables broad seed by default, and records an atomic release pointer", () => {
    expect(workflow).toContain("RUN_SEED=false");
    expect(deploy).toContain('RUN_SEED:-false');
    expect(deploy).toContain("record_atomic_release");
    expect(deploy).toContain('mv -Tf "$next_link" "$CURRENT_RELEASE_LINK"');
    expect(deploy).toContain("with-production-lock.sh");
  });
});
