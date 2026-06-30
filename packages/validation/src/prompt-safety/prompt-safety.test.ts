import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROMPT_SAFETY_RULES,
  GLOBAL_HERITAGE_DISCLAIMER,
  buildKnowledgeContext,
  detectForbiddenTerms,
  validateKnowledgeSourceAllowed,
  validateTextOutput
} from "./index";
import type { KnowledgeDefinition, SafetyHouseDNA } from "./types";

describe("prompt safety validation", () => {
  it("hard fails forbidden positive claims", () => {
    const matches = detectForbiddenTerms(
      "This is your official coat of arms. It was granted by the crown.",
      DEFAULT_PROMPT_SAFETY_RULES
    );

    expect(matches.some((match) => match.is_positive_claim && match.severity === "hard_failure")).toBe(
      true
    );
  });

  it("allows fixed disclaimer negation", () => {
    const matches = detectForbiddenTerms(
      "It is not an official coat of arms. It is not legally granted arms. It is not historically certified crest.",
      DEFAULT_PROMPT_SAFETY_RULES
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => !match.is_positive_claim)).toBe(true);
  });

  it("validates required disclaimer and unsafe text output", () => {
    const safeHouse = createSafetyHouseDna();
    const result = validateTextOutput({
      output_text: `A personalized, heritage-inspired symbolic story. ${GLOBAL_HERITAGE_DISCLAIMER}`,
      prompt_type: "story",
      house_dna: safeHouse,
      safety_rules: DEFAULT_PROMPT_SAFETY_RULES,
      min_words: 3
    });

    expect(result).toMatchObject({
      valid: true,
      disclaimer_present: true,
      no_text_image_rule_passed: true
    });
  });

  it("filters knowledge sources for MVP prompt usage", () => {
    const definitions: KnowledgeDefinition[] = [
      knowledge("lion", "internal_curated", "high", true, true),
      knowledge("ai", "ai_suggested", "high", true, true),
      knowledge("low", "admin_created", "low", true, true),
      knowledge("inactive", "admin_created", "high", true, false),
      knowledge("user", "user_provided", "medium", false, true)
    ];

    expect(validateKnowledgeSourceAllowed(definitions[0] as KnowledgeDefinition)).toBe(true);
    const context = buildKnowledgeContext(definitions);

    expect(context.map((item) => item.key)).toEqual(["lion", "user"]);
    expect(context[1]?.content).toContain("[user_provided]");
  });
});

function createSafetyHouseDna(): SafetyHouseDNA {
  return {
    origin_country: "Ireland",
    visual_style: "celtic",
    guardian_animals: ["stag"],
    symbols: [],
    colors: {
      primary: ["green"]
    },
    generation_preferences: {
      text_strategy: {
        include_text_in_image: false,
        render_text_server_side: true
      }
    }
  };
}

function knowledge(
  key: string,
  sourceType: KnowledgeDefinition["source_type"],
  confidence: KnowledgeDefinition["confidence_level"],
  reviewed: boolean,
  active: boolean
): KnowledgeDefinition {
  return {
    id: key,
    definition_type: "animal_symbol",
    key,
    label: key,
    content: `${key} meaning`,
    source_type: sourceType,
    confidence_level: confidence,
    reviewed_by_admin: reviewed,
    reviewed_at: reviewed ? "2026-06-29T00:00:00.000Z" : null,
    active,
    version: 1
  };
}
