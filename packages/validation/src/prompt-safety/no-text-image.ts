import type { PromptSafetyValidationResult, PromptSafetyRules, SafetyHouseDNA } from "./types";

import { detectForbiddenTerms } from "./forbidden-terms";

const TEXT_GENERATION_PATTERNS = [
  /\b(write|render|display|show|include|add)\s+(the\s+)?(motto|surname|house name|family name|initials|letters|words|banner text)\b/i,
  /\btext\s+(inside|in|on)\s+(the\s+)?(image|crest|banner|shield)\b/i,
  /\bvisible\s+(motto|surname|letters|words|text)\b/i
];

export function enforceNoTextImageRule(input: {
  rendered_prompt: string;
  negative_prompt: string | null;
  house_dna: SafetyHouseDNA;
  safety_rules: PromptSafetyRules;
}): PromptSafetyValidationResult {
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];
  const negativePrompt = input.negative_prompt ?? "";
  const forbiddenMatches = detectForbiddenTerms(input.rendered_prompt, input.safety_rules, "rendered_prompt");

  if (input.house_dna.generation_preferences.text_strategy.include_text_in_image) {
    hardFailures.push("include_text_in_image is not allowed for MVP image prompts.");
  }

  if (TEXT_GENERATION_PATTERNS.some((pattern) => pattern.test(input.rendered_prompt))) {
    hardFailures.push("Image prompt appears to request visible text generation.");
  }

  if (!/do not render text/i.test(input.rendered_prompt)) {
    softWarnings.push("Image prompt should explicitly say do not render text.");
  }

  const missingNegativeTerms = input.safety_rules.no_text_image_negative_terms.filter(
    (term) => !negativePrompt.toLowerCase().includes(term.toLowerCase())
  );

  if (missingNegativeTerms.length > 0) {
    hardFailures.push(`Image negative prompt is missing no-text terms: ${missingNegativeTerms.join(", ")}`);
  }

  const positiveForbidden = forbiddenMatches.filter((match) => match.is_positive_claim);
  if (positiveForbidden.length > 0) {
    hardFailures.push("Image prompt contains official/legal/historical positive claim language.");
  }

  return {
    valid: hardFailures.length === 0,
    hard_failures: hardFailures,
    soft_warnings: softWarnings,
    rewrite_required: hardFailures.length > 0 || softWarnings.length > 0,
    forbidden_terms_detected: forbiddenMatches,
    disclaimer_present: input.rendered_prompt.includes(input.safety_rules.required_disclaimer),
    no_text_image_rule_passed: hardFailures.length === 0,
    recommended_action: hardFailures.length > 0 ? "block" : softWarnings.length > 0 ? "rewrite" : "allow"
  };
}
