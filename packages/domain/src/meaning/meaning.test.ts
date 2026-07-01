import { describe, expect, it } from "vitest";

import {
  BOUNDARY_STATEMENT,
  buildMeaningProfile,
  createMeaningManifestAttachment,
  validateMeaningProfile
} from "./rules";

describe("rule-based Meaning Engine", () => {
  it("maps values and memories into themes and symbols", () => {
    const profile = buildMeaningProfile({
      recipient: "father",
      occasion: "retirement",
      values: ["protection", "resilience", "gratitude"],
      memories: ["He held the family together through difficult years."],
      colors: ["dark gold", "ivory"]
    });

    expect(profile.source_level).toBe("customer_informed");
    expect(profile.meaning_themes.map((theme) => theme.theme)).toEqual(
      expect.arrayContaining(["protection", "resilience", "gratitude"])
    );
    expect(profile.symbol_choices.map((symbol) => symbol.symbol)).toEqual(
      expect.arrayContaining(["shield", "oak branch"])
    );
    expect(profile.symbol_choices.every((symbol) => symbol.rationale.length > 20)).toBe(true);
    expect(profile.design_rationale.length).toBeGreaterThan(0);
    expect(profile.boundary_statement).toBe(BOUNDARY_STATEMENT);
    expect(profile.validation.valid).toBe(true);
  });

  it("keeps claims symbolic and rejects unqualified official claims", () => {
    const profile = buildMeaningProfile({ values: ["unity"], surname: "Alder" });
    expect(profile.validation.banned_claims_found).toEqual([]);

    const invalid = validateMeaningProfile({
      ...profile,
      boundary_statement: "This proves your ancestry and confirms royal lineage.",
      design_rationale: ["This is an official family crest."]
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.banned_claims_found).toEqual(
      expect.arrayContaining(["proves your ancestry", "royal lineage", "official family crest"])
    );
  });

  it("flags empty or unsupported output", () => {
    const profile = buildMeaningProfile({});
    expect(profile.validation.valid).toBe(false);
    expect(profile.validation.quality_flags).toContain("output_too_generic");
  });

  it("creates a manifest attachment for future generation and vault display", () => {
    const attachment = createMeaningManifestAttachment({
      values: ["guidance"],
      memories: ["She always helped the children find their way."]
    });
    expect(attachment.attachment_type).toBe("meaning_engine");
    expect(attachment.generation_brief.text_strategy.include_text_in_image).toBe(false);
    expect(attachment.meaning_profile.symbol_choices.length).toBeGreaterThan(0);
  });
});
