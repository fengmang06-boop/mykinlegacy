import type { PromptSafetyValidationResult, TextOutputValidationInput } from "./types";

import { detectForbiddenTerms } from "./forbidden-terms";

const NOBLE_TITLE_PATTERN = /\b(lord|lady|duke|duchess|baron|baroness|earl|count|countess|prince|princess)\s+[A-Z][a-z]+\b/i;
const INVENTED_ANCESTOR_PATTERN = /\bdescended\s+from\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b|\byour\s+ancestor\s+[A-Z][a-z]+\b/i;

export function validateTextOutput(input: TextOutputValidationInput): PromptSafetyValidationResult {
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];
  const forbiddenMatches = detectForbiddenTerms(input.output_text, input.safety_rules, "output_text");
  const positiveForbidden = forbiddenMatches.filter((match) => match.is_positive_claim);
  const disclaimerPresent = input.output_text.includes(input.safety_rules.required_disclaimer);
  const words = input.output_text.trim().split(/\s+/).filter(Boolean);

  if (positiveForbidden.length > 0) {
    hardFailures.push("Text output contains forbidden positive official/legal/historical claims.");
  }

  if (!disclaimerPresent) {
    hardFailures.push("Required heritage disclaimer is missing.");
  }

  if (INVENTED_ANCESTOR_PATTERN.test(input.output_text)) {
    hardFailures.push("Text output appears to invent named ancestors.");
  }

  if (NOBLE_TITLE_PATTERN.test(input.output_text)) {
    hardFailures.push("Text output appears to invent or imply noble titles.");
  }

  if (input.house_dna.origin_country.toLowerCase() === "unknown" && /\bdefinitely\b|\bproves\b|\bverified\b/i.test(input.output_text)) {
    softWarnings.push("Output uses certainty language despite unknown origin.");
  }

  if (input.min_words && words.length < input.min_words) {
    softWarnings.push("Text output is below expected word count.");
  }

  if (input.max_words && words.length > input.max_words) {
    softWarnings.push("Text output exceeds expected word count.");
  }

  if (!hasAnySafeLanguage(input.output_text, input.safety_rules.required_safe_language)) {
    softWarnings.push("Text output is missing expected safe language.");
  }

  return {
    valid: hardFailures.length === 0,
    hard_failures: hardFailures,
    soft_warnings: softWarnings,
    rewrite_required: hardFailures.length > 0 || softWarnings.length > 0,
    forbidden_terms_detected: forbiddenMatches,
    disclaimer_present: disclaimerPresent,
    no_text_image_rule_passed: true,
    recommended_action:
      hardFailures.length > 1 ? "regenerate_or_admin_review" : hardFailures.length > 0 ? "rewrite" : "allow"
  };
}

function hasAnySafeLanguage(text: string, safeLanguage: string[]): boolean {
  const normalized = text.toLowerCase();

  return safeLanguage.some((term) => normalized.includes(term.toLowerCase()));
}
