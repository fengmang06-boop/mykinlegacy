import type { PromptHouseDNA } from "./types";

export function resolvePromptVariables(houseDna: PromptHouseDNA): Record<string, string> {
  return {
    house_name: safeText(houseDna.house_name, "The family"),
    surname: safeText(houseDna.surname, "the surname"),
    heritage_country: safeText(houseDna.origin_country, "unknown heritage origin"),
    heritage_regions: listText(houseDna.heritage_regions, "unspecified regions"),
    family_values: listText(houseDna.family_values, "family values"),
    animal_symbols: listText([...houseDna.guardian_animals, ...houseDna.symbols], "symbolic motifs"),
    colors: listText(
      [
        ...houseDna.colors.primary,
        ...(houseDna.colors.secondary ?? []),
        ...(houseDna.colors.metallic ?? []),
        ...(houseDna.colors.accent ?? [])
      ],
      "balanced heritage colors"
    ),
    motto: safeText(houseDna.motto ?? "", "server-side motto field"),
    style: safeText(houseDna.visual_style, "heritage-inspired"),
    locale: safeText(houseDna.locale, "en-US"),
    output_language: safeText(houseDna.output_language, "en"),
    fallback_language: safeText(houseDna.fallback_language, "en"),
    cautious_origin_note:
      houseDna.origin_country.toLowerCase() === "unknown"
        ? "Use cautious wording: the heritage origin is unknown and must not be invented."
        : "Use heritage-inspired wording without claiming historical certification.",
    forbidden_elements: listText(houseDna.forbidden_elements, "none specified"),
    preferred_elements: listText(houseDna.preferred_elements, "none specified")
  };
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    return variables[key] ?? `[missing:${key}]`;
  });
}

export function findMissingRequiredVariables(
  requiredVariables: string[],
  variables: Record<string, string>
): string[] {
  return requiredVariables.filter((key) => {
    const value = variables[key];
    return !value || value.startsWith("[missing:");
  });
}

function safeText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function listText(values: string[], fallback: string): string {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  return cleanValues.length > 0 ? cleanValues.join(", ") : fallback;
}
