import { describe, expect, it } from "vitest";

import {
  composeCrestGenome,
  CORE_MEANING_THEMES,
  createCrestGenomeContactSheet,
  readCrestPngMetadata,
  SYMBOL_TAXONOMY,
  validateCrestGenomeOutput
} from ".";
import type { CrestGenomeOutput } from "./types";

describe("Crest Genome Library", () => {
  it("defines symbol mappings for every core meaning theme", () => {
    expect(CORE_MEANING_THEMES).toHaveLength(18);
    for (const theme of CORE_MEANING_THEMES) {
      expect(SYMBOL_TAXONOMY[theme].length).toBeGreaterThanOrEqual(6);
    }
  });

  it("is deterministic for the same seed and meaning profile", () => {
    const first = composeCrestGenome({
      meaning_themes: ["continuity", "unity"],
      selected_symbols: ["tree", "knot"],
      order_seed: "order-001"
    });
    const second = composeCrestGenome({
      meaning_themes: ["continuity", "unity"],
      selected_symbols: ["tree", "knot"],
      order_seed: "order-001"
    });

    expect(first.visual_signature).toBe(second.visual_signature);
    expect(first.manifest).toEqual(second.manifest);
    expect(first.pngBuffer.equals(second.pngBuffer)).toBe(true);
  });

  it("produces different visual signatures for different seeds", () => {
    const first = composeCrestGenome({
      meaning_themes: ["memory", "wisdom"],
      selected_symbols: ["book", "lantern"],
      order_seed: "seed-a"
    });
    const second = composeCrestGenome({
      meaning_themes: ["memory", "wisdom"],
      selected_symbols: ["book", "lantern"],
      order_seed: "seed-b"
    });

    expect(first.visual_signature).not.toBe(second.visual_signature);
  });

  it("creates valid PNG and transparent PNG outputs", () => {
    const output = composeCrestGenome({
      meaning_themes: ["protection", "home", "belonging"],
      selected_symbols: ["shield", "key"],
      order_seed: "png-valid"
    });
    const png = readCrestPngMetadata(output.pngBuffer);
    const transparent = readCrestPngMetadata(output.transparentPngBuffer);

    expect(png?.width).toBe(640);
    expect(png?.height).toBe(640);
    expect(png?.has_alpha).toBe(true);
    expect(transparent?.has_transparent_pixels).toBe(true);
    expect(png?.text).toContain("artwork_system=crest_genome_library");
  });

  it("does not include unsupported random symbols in manifest output", () => {
    const output = composeCrestGenome({
      meaning_themes: ["journey", "resilience"],
      selected_symbols: ["random_line", "mechanical_mask", "mountain"],
      order_seed: "unsupported-symbol"
    });

    expect(output.manifest.primary_symbol_id).not.toBe("random_line");
    expect(output.manifest.secondary_symbol_ids).not.toContain("mechanical_mask");
  });

  it("quality gate catches missing main symbol and duplicate signature", () => {
    const output = composeCrestGenome({
      meaning_themes: ["legacy", "continuity"],
      order_seed: "quality"
    });
    const broken: CrestGenomeOutput = {
      ...output,
      manifest: {
        ...output.manifest,
        primary_symbol_id: ""
      }
    };

    expect(validateCrestGenomeOutput(broken).hard_failures).toContain("no_main_symbol");
    expect(validateCrestGenomeOutput(output, new Set([output.visual_signature])).hard_failures).toContain("duplicate_signature");
  });

  it("quality gate passes a normal crest and variants are byte-distinct", () => {
    const output = composeCrestGenome({
      meaning_themes: ["gratitude", "love", "unity"],
      selected_symbols: ["laurel", "ring"],
      order_seed: "normal-quality"
    });
    const report = validateCrestGenomeOutput(output);

    expect(report.passed).toBe(true);
    expect(output.pngBuffer.equals(output.transparentPngBuffer)).toBe(false);
  });

  it("creates a contact sheet from generated crest samples", () => {
    const samples = Array.from({ length: 6 }, (_, index) =>
      composeCrestGenome({
        meaning_themes: ["continuity", "unity"],
        selected_symbols: ["tree", "knot"],
        order_seed: `contact-${index}`
      }).pngBuffer
    );
    const sheet = createCrestGenomeContactSheet(samples, 3, 160);
    const metadata = readCrestPngMetadata(sheet);

    expect(metadata?.width).toBe(480);
    expect(metadata?.height).toBe(320);
  });
});
