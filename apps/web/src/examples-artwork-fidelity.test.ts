import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(__dirname);
const publicRoot = path.resolve(sourceRoot, "../public");
const page = fs.readFileSync(path.join(sourceRoot, "app/real-examples/page.tsx"), "utf8");
const css = fs.readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

const assets = [
  "assets/examples-v2/finished/migration-journey-finished-v2.png",
  "assets/examples-v2/finished/family-birthstones-finished-v2.png",
  "assets/examples-v2/finished/craftsmanship-retirement-finished-v2.png",
  "assets/examples-v2/finished/generations-anniversary-finished-v2.png"
];

function pngDimensions(file: string) {
  const buffer = fs.readFileSync(file);
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

describe("Examples V2 public finished artwork fidelity", () => {
  it("uses four high-resolution PUBLIC_FINISHED_STUDY assets", () => {
    expect(page.match(/assetLayer: "PUBLIC_FINISHED_STUDY"/g)).toHaveLength(4);

    for (const asset of assets) {
      expect(page).toContain(`/${asset}`);
      const file = path.join(publicRoot, asset);
      expect(fs.existsSync(file)).toBe(true);
      const { width, height } = pngDimensions(file);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(1024);
      expect(fs.statSync(file).size).toBeGreaterThan(1_000_000);
    }
  });

  it("keeps internal art-direction diagrams out of the public render", () => {
    expect(page).not.toContain("INTERNAL_ART_DIRECTION");
    expect(page).not.toContain("DirectionArtwork");
    expect(page).not.toContain("px2-art-ring");
    expect(css).not.toContain(".px2-direction-art");
    expect(css).not.toContain(".px2-art-ring");
  });

  it("keeps evidence references and explicit gemstone or celestial conditions", () => {
    expect(page.match(/evidenceRefs:/g)).toHaveLength(4);
    expect(page).toContain("four explicitly selected birthstones");
    expect(page).toContain("only through explicit family selection");
    expect(page).toContain("conditional on explicit family confirmation");
    expect(page).toContain("guiding star appears only when explicitly confirmed");
    expect(page).toContain("not a claimed gemstone effect");
  });

  it("passes the Crest Differentiation Engine thresholds", () => {
    const silhouettes = [...page.matchAll(/silhouette: "([^"]+)"/g)].map((match) => match[1] ?? "");
    const backgrounds = [...page.matchAll(/background: "([^"]+)"/g)].map((match) => match[1] ?? "");

    expect(new Set(silhouettes).size).toBe(4);
    expect(backgrounds).toHaveLength(4);
    expect(backgrounds.filter((value) => !value.includes("black"))).toHaveLength(4);
    expect(page.match(/usesShield: false/g)).toHaveLength(4);
    expect(page.match(/usesTree: false/g)).toHaveLength(4);
    expect(page.match(/asymmetric: true/g)?.length).toBeGreaterThanOrEqual(1);
    expect(page).toContain('silhouette: "architectural horizontal frame"');
    expect(page).toContain('silhouette: "organic interwoven vertical form"');
    expect(page).toContain('silhouette: "open circular medallion"');
    expect(page).toContain('silhouette: "open dual botanical form"');
  });

  it("shows complete subjects with contain sizing on public cards", () => {
    expect(page).toContain("FinishedStudyArtwork");
    expect(css).toMatch(/\.px2-finished-study img\s*\{[^}]*object-fit:\s*contain/s);
    expect(css).toMatch(/\.px2-finished-study-compact img\s*\{[^}]*object-fit:\s*contain/s);
    expect(css).not.toMatch(/\.px2-finished-[^{]+\{[^}]*object-fit:\s*cover/s);
  });

  it("uses accurate synthetic labeling and no fabricated customer framing", () => {
    expect(page).toContain("Illustrative Design Study");
    expect(page).toContain(
      "A fictional design study created to demonstrate how different family information may lead to different symbolic directions."
    );
    for (const forbidden of ["Real family", "Client case", "Customer story", "Commissioned for", "Delivered to"]) {
      expect(page).not.toContain(forbidden);
    }
  });
});
