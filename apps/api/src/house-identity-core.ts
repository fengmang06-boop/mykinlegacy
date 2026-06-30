import { ulid } from "ulid";

import { ApiException } from "./common/api-error";

export interface HouseDNA {
  contract_version: "1.1";
  schema_version: string;
  created_at: string;
  updated_at: string;
  source: string;
  locale: string;
  output_language: string;
  fallback_language: string;
  house_name: string;
  surname: string;
  origin_country: string;
  heritage_regions: string[];
  family_values: string[];
  personality_traits: string[];
  guardian_animals: string[];
  symbols: string[];
  colors: { primary: string[]; secondary?: string[]; metallic?: string[]; accent?: string[] };
  motto: string | null;
  motto_meaning: string | null;
  visual_style: string;
  emotional_tone: string[];
  story_theme: string | null;
  cultural_references: string[];
  forbidden_elements: string[];
  preferred_elements: string[];
  generation_preferences: {
    text_strategy: {
      include_text_in_image: false;
      render_text_server_side: true;
      text_fields: string[];
      text_render_targets: string[];
    };
  };
  privacy_preferences: { private_by_default: true };
  future_product_preferences: string[];
}

export function normalizeTextInput(rawInput: string) {
  const lower = rawInput.toLowerCase();
  const normalized_house_dna: Partial<HouseDNA> = {
    locale: "en-US",
    output_language: "en",
    fallback_language: "en"
  };
  const inferred_fields: string[] = [];
  const user_confirm_required_fields: string[] = [];

  if (/\bgermany\b|\bgerman\b/i.test(rawInput)) {
    normalized_house_dna.origin_country = "Germany";
    inferred_fields.push("origin_country");
  } else if (/\birish\b|\bireland\b/i.test(rawInput)) {
    normalized_house_dna.origin_country = "Ireland";
    inferred_fields.push("origin_country");
    user_confirm_required_fields.push("origin_country");
  }

  if (/\birish\b|\bireland\b/i.test(rawInput) && normalized_house_dna.origin_country !== "Ireland") {
    normalized_house_dna.heritage_regions = ["Ireland"];
    inferred_fields.push("heritage_regions");
    user_confirm_required_fields.push("heritage_regions");
  }

  const colors = ["black", "gold", "ivory", "blue", "red", "green", "white", "silver"].filter((color) =>
    lower.includes(color)
  );
  if (colors.length > 0) {
    normalized_house_dna.colors = { primary: colors };
    inferred_fields.push("colors");
  }

  if (/\bstrong\b|\bstrength\b/i.test(rawInput)) {
    normalized_house_dna.family_values = ["strength"];
    inferred_fields.push("family_values");
  }

  if (/\blion\b/i.test(rawInput)) {
    normalized_house_dna.guardian_animals = ["lion"];
    inferred_fields.push("guardian_animals");
  }

  const forbidden = [...lower.matchAll(/\bno\s+([a-z]+)\b/g)].map((match) => match[1]).filter(Boolean) as string[];
  if (forbidden.length > 0) {
    normalized_house_dna.forbidden_elements = [...new Set(forbidden)];
    inferred_fields.push("forbidden_elements");
  }

  const timestamp = new Date().toISOString();
  return {
    contract_version: "1.1",
    schema_version: "house_identity.normalized_input.v1",
    created_at: timestamp,
    updated_at: timestamp,
    source: "deterministic_normalizer",
    normalized_house_dna,
    confidence_score: Math.min(0.9, 0.45 + inferred_fields.length * 0.08),
    inferred_fields: [...new Set(inferred_fields)],
    user_confirm_required_fields: [...new Set(user_confirm_required_fields)],
    notes: user_confirm_required_fields.length > 0 ? ["Some inferred fields should be confirmed."] : []
  };
}

export function buildHouseDNA(input: Partial<HouseDNA>): HouseDNA {
  const timestamp = new Date().toISOString();
  const surname = input.surname?.trim() || "Unknown";
  return {
    contract_version: "1.1",
    schema_version: "house_identity.v1",
    created_at: input.created_at ?? timestamp,
    updated_at: timestamp,
    source: input.source ?? "api",
    locale: input.locale ?? "en-US",
    output_language: input.output_language ?? "en",
    fallback_language: input.fallback_language ?? "en",
    house_name: input.house_name?.trim() || `House of ${surname}`,
    surname,
    origin_country: input.origin_country ?? "unknown",
    heritage_regions: input.heritage_regions ?? [],
    family_values: input.family_values?.length ? input.family_values : ["unity"],
    personality_traits: input.personality_traits ?? [],
    guardian_animals: input.guardian_animals ?? [],
    symbols: input.symbols ?? [],
    colors: input.colors?.primary?.length ? input.colors : { primary: ["deep_navy", "gold", "ivory"] },
    motto: input.motto ?? null,
    motto_meaning: input.motto_meaning ?? null,
    visual_style: input.visual_style ?? "classic_heritage",
    emotional_tone: input.emotional_tone ?? [],
    story_theme: input.story_theme ?? null,
    cultural_references: input.cultural_references ?? [],
    forbidden_elements: [
      "readable text in generated images",
      "copyrighted logos",
      "trademarked symbols",
      ...(input.forbidden_elements ?? [])
    ],
    preferred_elements: input.preferred_elements ?? [],
    generation_preferences: {
      text_strategy: {
        include_text_in_image: false,
        render_text_server_side: true,
        text_fields: ["house_name", "motto"],
        text_render_targets: ["certificate_pdf", "poster_pdf", "social_kit", "wallpaper"]
      }
    },
    privacy_preferences: { private_by_default: true },
    future_product_preferences: input.future_product_preferences ?? []
  };
}

export function validateHouseDNA(houseDna: HouseDNA): void {
  if (houseDna.contract_version !== "1.1") {
    throwValidation("contract_version must be 1.1.", "contract_version");
  }
  if (!houseDna.surname || houseDna.surname.length > 80) {
    throwValidation("surname is required and must be 80 characters or fewer.", "surname");
  }
  if (houseDna.family_values.length < 1 || houseDna.family_values.length > 8) {
    throwValidation("family_values must contain between 1 and 8 values.", "family_values");
  }
  if (!houseDna.colors.primary?.length) {
    throwValidation("colors.primary is required.", "colors.primary");
  }
  if (houseDna.generation_preferences.text_strategy.include_text_in_image !== false) {
    throwValidation("AI image text is not allowed in MVP.", "generation_preferences.text_strategy");
  }
  if (houseDna.generation_preferences.text_strategy.render_text_server_side !== true) {
    throwValidation("Server-side text rendering is required.", "generation_preferences.text_strategy");
  }
  if (houseDna.privacy_preferences.private_by_default !== true) {
    throwValidation("private_by_default must be true.", "privacy_preferences.private_by_default");
  }
}

export function mergeHouseDnaDraft(current: unknown, normalizedOutput: Partial<HouseDNA>): HouseDNA {
  const base = isRecord(current) ? (current as Partial<HouseDNA>) : {};
  return buildHouseDNA({
    ...base,
    ...normalizedOutput,
    colors: normalizedOutput.colors ?? base.colors
  });
}

export function nextInterviewStep(currentStep: string): string {
  const steps = [
    "name_your_house",
    "surname_and_origin",
    "choose_guardian_symbol",
    "values_and_colors",
    "motto_and_style",
    "review"
  ];
  const index = steps.indexOf(currentStep);
  return steps[Math.min(index + 1, steps.length - 1)] ?? "review";
}

export function createVersionId(): string {
  return ulid();
}

function throwValidation(message: string, affectedField: string): never {
  throw new ApiException({
    errorCode: "validation_error",
    message,
    userMessage: "Please check the House Identity details.",
    affectedField
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
