import {
  DEFAULT_COLORS,
  DEFAULT_FALLBACK_LANGUAGE,
  DEFAULT_FAMILY_VALUES,
  DEFAULT_FORBIDDEN_ELEMENTS,
  DEFAULT_LOCALE,
  DEFAULT_ORIGIN_COUNTRY,
  DEFAULT_OUTPUT_LANGUAGE,
  DEFAULT_TEXT_STRATEGY,
  DEFAULT_VISUAL_STYLE,
  createContractMetadata
} from "./defaults";
import { normalizeHouseIdentityText } from "./normalizer";
import type { HouseDNA, InterviewAnswer } from "./types";

export interface HouseDnaBuilderOptions {
  source?: string;
  timestamp?: Date;
}

export function buildHouseDNAFromInterviewAnswers(
  answers: InterviewAnswer[],
  options: HouseDnaBuilderOptions = {}
): HouseDNA {
  const source = options.source ?? "house_dna_builder";
  const timestamp = options.timestamp ?? new Date();
  const partial: Partial<HouseDNA> = {};

  for (const answer of answers) {
    mergeHouseDnaPartial(partial, answer.normalized_output);

    if (typeof answer.raw_answer === "string") {
      mergeHouseDnaPartial(partial, inferFromStep(answer.step_code, answer.raw_answer));
      mergeHouseDnaPartial(partial, normalizeHouseIdentityText(answer.raw_answer).normalized_input.normalized_house_dna);
    }
  }

  return buildHouseDNA(partial, { source, timestamp });
}

export function buildHouseDNA(input: Partial<HouseDNA>, options: HouseDnaBuilderOptions = {}): HouseDNA {
  const source = options.source ?? "house_dna_builder";
  const timestamp = options.timestamp ?? new Date();
  const surname = normalizeText(input.surname) || "Unknown";
  const houseName = normalizeText(input.house_name) || `House of ${surname}`;
  const forbiddenElements = unique([
    ...DEFAULT_FORBIDDEN_ELEMENTS,
    ...(input.forbidden_elements ?? [])
  ]);

  return {
    ...createContractMetadata(source, timestamp),
    locale: input.locale ?? DEFAULT_LOCALE,
    output_language: input.output_language ?? DEFAULT_OUTPUT_LANGUAGE,
    fallback_language: input.fallback_language ?? DEFAULT_FALLBACK_LANGUAGE,
    house_name: houseName,
    surname,
    origin_country: normalizeText(input.origin_country) || DEFAULT_ORIGIN_COUNTRY,
    heritage_regions: input.heritage_regions ?? [],
    family_values: normalizeList(input.family_values, [...DEFAULT_FAMILY_VALUES]),
    personality_traits: input.personality_traits ?? [],
    guardian_animals: input.guardian_animals ?? [],
    symbols: input.symbols ?? [],
    colors: {
      primary: input.colors?.primary?.length ? input.colors.primary : [...DEFAULT_COLORS],
      secondary: input.colors?.secondary ?? [],
      metallic: input.colors?.metallic ?? [],
      accent: input.colors?.accent ?? []
    },
    motto: input.motto ?? null,
    motto_meaning: input.motto_meaning ?? null,
    visual_style: normalizeText(input.visual_style) || DEFAULT_VISUAL_STYLE,
    emotional_tone: input.emotional_tone ?? [],
    story_theme: input.story_theme ?? null,
    cultural_references: input.cultural_references ?? [],
    forbidden_elements: forbiddenElements,
    preferred_elements: input.preferred_elements ?? [],
    generation_preferences: {
      ...input.generation_preferences,
      text_strategy: DEFAULT_TEXT_STRATEGY
    },
    privacy_preferences: {
      ...input.privacy_preferences,
      private_by_default: true
    },
    future_product_preferences: input.future_product_preferences ?? []
  };
}

function inferFromStep(stepCode: string, rawAnswer: string): Partial<HouseDNA> {
  const value = normalizeText(rawAnswer);

  if (!value) {
    return {};
  }

  if (stepCode.includes("surname")) {
    return { surname: value };
  }
  if (stepCode.includes("house_name")) {
    return { house_name: value };
  }
  if (stepCode.includes("motto")) {
    return { motto: value };
  }

  return {};
}

function mergeHouseDnaPartial(target: Partial<HouseDNA>, next?: Partial<HouseDNA>): void {
  if (!next) {
    return;
  }

  for (const [key, value] of Object.entries(next) as Array<[keyof HouseDNA, HouseDNA[keyof HouseDNA]]>) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      target[key] = unique([...(target[key] as string[] | undefined ?? []), ...value]) as never;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      target[key] = { ...((target[key] as object | undefined) ?? {}), ...value } as never;
      continue;
    }
    target[key] = value as never;
  }
}

function normalizeList(values: string[] | undefined, fallback: string[]): string[] {
  const normalized = values?.map(normalizeText).filter(Boolean) ?? [];
  return normalized.length > 0 ? unique(normalized) : fallback;
}

function normalizeText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
