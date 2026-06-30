import type { ImagePromptValidationInput, PromptSafetyValidationResult } from "./types";

import { detectForbiddenTerms } from "./forbidden-terms";
import { enforceNoTextImageRule } from "./no-text-image";

export function validateRenderedImagePrompt(
  input: ImagePromptValidationInput
): PromptSafetyValidationResult {
  const noTextResult = enforceNoTextImageRule({
    rendered_prompt: input.rendered_prompt.rendered_prompt,
    negative_prompt: input.rendered_prompt.negative_prompt,
    house_dna: input.house_dna,
    safety_rules: input.safety_rules
  });
  const hardFailures = [...noTextResult.hard_failures];
  const softWarnings = [...noTextResult.soft_warnings];
  const promptText = input.rendered_prompt.rendered_prompt;
  const forbiddenMatches = detectForbiddenTerms(promptText, input.safety_rules, "image_prompt");

  if (containsAny(promptText, input.safety_rules.copyrighted_logo_terms)) {
    hardFailures.push("Image prompt contains copyrighted logo or trademark request.");
  }

  if (containsAny(input.rendered_prompt.rendered_prompt, input.safety_rules.official_emblem_terms)) {
    hardFailures.push("Image prompt contains official emblem request.");
  }

  if (!input.rendered_prompt.metadata.forbidden_elements_injected) {
    softWarnings.push("Forbidden elements were not marked as injected.");
  }

  if (!input.house_dna.visual_style) {
    hardFailures.push("Visual style is missing.");
  }

  if (input.house_dna.colors.primary.length === 0) {
    hardFailures.push("Primary colors are missing.");
  }

  if (input.house_dna.guardian_animals.length === 0 && input.house_dna.symbols.length === 0) {
    hardFailures.push("Guardian animal or main symbol is missing.");
  }

  if (input.rendered_prompt.metadata.text_must_be_rendered_server_side !== true) {
    hardFailures.push("Image output requirements must render text server-side.");
  }

  return {
    valid: hardFailures.length === 0,
    hard_failures: hardFailures,
    soft_warnings: softWarnings,
    rewrite_required: hardFailures.length > 0 || softWarnings.length > 0,
    forbidden_terms_detected: [...noTextResult.forbidden_terms_detected, ...forbiddenMatches],
    disclaimer_present: noTextResult.disclaimer_present,
    no_text_image_rule_passed: noTextResult.no_text_image_rule_passed && hardFailures.length === 0,
    recommended_action: hardFailures.length > 0 ? "block" : softWarnings.length > 0 ? "rewrite" : "allow"
  };
}

function containsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();

  return terms.some((term) => normalized.includes(term.toLowerCase()));
}
