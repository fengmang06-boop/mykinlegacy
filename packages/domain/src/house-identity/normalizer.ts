import {
  DEFAULT_FALLBACK_LANGUAGE,
  DEFAULT_LOCALE,
  DEFAULT_OUTPUT_LANGUAGE,
  createContractMetadata
} from "./defaults";
import type { HouseDNA, NormalizationResult } from "./types";

const countryPatterns: Array<{ pattern: RegExp; country: string; uncertain: boolean }> = [
  { pattern: /\bgermany\b|\bgerman\b/i, country: "Germany", uncertain: false },
  { pattern: /\birish\b|\bireland\b/i, country: "Ireland", uncertain: true },
  { pattern: /\bscotland\b|\bscottish\b/i, country: "Scotland", uncertain: true },
  { pattern: /\bengland\b|\benglish\b/i, country: "England", uncertain: true },
  { pattern: /\bitaly\b|\bitalian\b/i, country: "Italy", uncertain: false },
  { pattern: /\bfrance\b|\bfrench\b/i, country: "France", uncertain: false }
];

const colorKeywords = ["black", "gold", "ivory", "blue", "red", "green", "white", "silver"];
const animalKeywords = ["lion", "eagle", "wolf", "bear", "stag", "dragon", "horse"];

export function normalizeHouseIdentityText(input: string, source = "deterministic_normalizer"): NormalizationResult {
  const text = input.trim();
  const lowerText = text.toLowerCase();
  const inferredFields: string[] = [];
  const userConfirmRequiredFields: string[] = [];
  const notes: string[] = [];
  const normalizedHouseDna: Partial<HouseDNA> = {
    locale: DEFAULT_LOCALE,
    output_language: DEFAULT_OUTPUT_LANGUAGE,
    fallback_language: DEFAULT_FALLBACK_LANGUAGE
  };

  const matchedCountries = countryPatterns.filter(({ pattern }) => pattern.test(text));
  const primaryCountry =
    matchedCountries.find((match) => !match.uncertain) ??
    matchedCountries.find((match) => !isMaybeContext(lowerText, match.country));
  if (primaryCountry) {
    normalizedHouseDna.origin_country = primaryCountry.country;
    inferredFields.push("origin_country");
  } else if (matchedCountries[0]) {
    normalizedHouseDna.origin_country = matchedCountries[0].country;
    inferredFields.push("origin_country");
    userConfirmRequiredFields.push("origin_country");
    notes.push("Origin country was inferred from cautious wording and should be confirmed.");
  }

  const heritageRegions = matchedCountries
    .filter((match) => match.country !== normalizedHouseDna.origin_country || match.uncertain)
    .map((match) => match.country);
  if (heritageRegions.length > 0) {
    normalizedHouseDna.heritage_regions = unique(heritageRegions);
    inferredFields.push("heritage_regions");
    if (/\bmaybe\b|\btoo\b|\balso\b/i.test(text)) {
      userConfirmRequiredFields.push("heritage_regions");
    }
  }

  const colors = colorKeywords.filter((color) => lowerText.includes(color));
  if (colors.length > 0) {
    normalizedHouseDna.colors = { primary: unique(colors) };
    inferredFields.push("colors");
  }

  if (/\bstrong\b|\bstrength\b|\bresilient\b|\bresilience\b/i.test(text)) {
    normalizedHouseDna.family_values = ["strength"];
    inferredFields.push("family_values");
  } else if (/\bfamily\b|\bunity\b|\btogether\b/i.test(text)) {
    normalizedHouseDna.family_values = ["unity"];
    inferredFields.push("family_values");
  }

  const animals = animalKeywords.filter((animal) => lowerText.includes(animal));
  if (animals.length > 0) {
    normalizedHouseDna.guardian_animals = unique(animals);
    inferredFields.push("guardian_animals");
  }

  const forbiddenElements = extractForbiddenElements(lowerText);
  if (forbiddenElements.length > 0) {
    normalizedHouseDna.forbidden_elements = forbiddenElements;
    inferredFields.push("forbidden_elements");
  }

  const confidenceScore = calculateConfidenceScore(inferredFields.length, userConfirmRequiredFields.length);

  return {
    normalized_input: {
      ...createContractMetadata(source),
      normalized_house_dna: normalizedHouseDna,
      confidence_score: confidenceScore,
      inferred_fields: unique(inferredFields),
      user_confirm_required_fields: unique(userConfirmRequiredFields),
      notes
    }
  };
}

function isMaybeContext(text: string, country: string): boolean {
  const lowerCountry = country.toLowerCase();
  return new RegExp(`\\bmaybe\\b.{0,24}\\b${lowerCountry}\\b|\\b${lowerCountry}\\b.{0,24}\\btoo\\b`).test(
    text
  );
}

function extractForbiddenElements(text: string): string[] {
  const forbiddenElements: string[] = [];
  const noPattern = /\bno\s+([a-z]+)\b/g;
  let match = noPattern.exec(text);

  while (match) {
    if (match[1]) {
      forbiddenElements.push(match[1]);
    }
    match = noPattern.exec(text);
  }

  return unique(forbiddenElements);
}

function calculateConfidenceScore(inferredCount: number, confirmRequiredCount: number): number {
  const base = Math.min(0.9, 0.45 + inferredCount * 0.08);
  return Math.max(0.1, Number((base - confirmRequiredCount * 0.08).toFixed(2)));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
