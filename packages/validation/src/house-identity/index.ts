import type { ValidationResult } from "../result";
import { invalidResult } from "../result";

export interface HouseDnaValidationInput {
  contract_version: string;
  surname?: string;
  house_name?: string;
  family_values: string[];
  colors: { primary?: string[] };
  visual_style?: string;
  locale?: string;
  output_language?: string;
  generation_preferences: {
    text_strategy: {
      include_text_in_image: boolean;
      render_text_server_side: boolean;
    };
  };
  privacy_preferences: {
    private_by_default: boolean;
  };
}

export interface InterviewAnswerValidationInput {
  step_code: string;
  raw_answer: unknown;
  normalized_output?: unknown;
  maps_to_house_dna: unknown;
}

export interface NormalizedInputValidationInput {
  confidence_score: number;
  inferred_fields: unknown;
  user_confirm_required_fields: unknown;
}

export interface ConsentRecordValidationInput {
  terms_accepted: boolean;
  privacy_policy_accepted: boolean;
  heritage_disclaimer_accepted: boolean;
  ai_generation_consent: boolean;
  email_delivery_consent: boolean;
}

export function validateHouseDNA(houseDna: HouseDnaValidationInput): ValidationResult {
  const errors: string[] = [];

  if (houseDna.contract_version !== "1.1") {
    errors.push("contract_version must be 1.1.");
  }
  if (!houseDna.surname || houseDna.surname.length > 80) {
    errors.push("surname is required and must be 80 characters or fewer.");
  }
  if (!houseDna.house_name && !houseDna.surname) {
    errors.push("house_name is required unless surname fallback is available.");
  }
  if (houseDna.family_values.length < 1 || houseDna.family_values.length > 8) {
    errors.push("family_values must contain between 1 and 8 values.");
  }
  if (!houseDna.colors.primary || houseDna.colors.primary.length < 1) {
    errors.push("colors.primary must contain at least one color.");
  }
  if (!houseDna.visual_style) {
    errors.push("visual_style is required.");
  }
  if (houseDna.generation_preferences.text_strategy.include_text_in_image !== false) {
    errors.push("generation_preferences.text_strategy.include_text_in_image must be false.");
  }
  if (houseDna.generation_preferences.text_strategy.render_text_server_side !== true) {
    errors.push("generation_preferences.text_strategy.render_text_server_side must be true.");
  }
  if (houseDna.privacy_preferences.private_by_default !== true) {
    errors.push("privacy_preferences.private_by_default must be true.");
  }
  if (houseDna.locale !== "en-US") {
    errors.push("locale must default to en-US for MVP.");
  }
  if (houseDna.output_language !== "en") {
    errors.push("output_language must default to en for MVP.");
  }

  return invalidResult(errors);
}

export function validateInterviewAnswer(answer: InterviewAnswerValidationInput): ValidationResult {
  const errors: string[] = [];

  if (!answer.step_code.trim()) {
    errors.push("step_code is required.");
  }
  if (answer.raw_answer === undefined || answer.raw_answer === null) {
    errors.push("raw_answer is required.");
  }
  if (!Array.isArray(answer.maps_to_house_dna)) {
    errors.push("maps_to_house_dna must be an array.");
  }
  if (answer.normalized_output !== undefined && typeof answer.normalized_output !== "object") {
    errors.push("normalized_output must be an object when provided.");
  }

  return invalidResult(errors);
}

export function validateNormalizedInput(input: NormalizedInputValidationInput): ValidationResult {
  const errors: string[] = [];

  if (input.confidence_score < 0 || input.confidence_score > 1) {
    errors.push("confidence_score must be between 0 and 1.");
  }
  if (!Array.isArray(input.inferred_fields)) {
    errors.push("inferred_fields must be an array.");
  }
  if (!Array.isArray(input.user_confirm_required_fields)) {
    errors.push("user_confirm_required_fields must be an array.");
  }

  return invalidResult(errors);
}

export function validateConsentRecord(consent: ConsentRecordValidationInput): ValidationResult {
  const errors: string[] = [];

  if (!consent.terms_accepted) {
    errors.push("terms_accepted is required before generation.");
  }
  if (!consent.privacy_policy_accepted) {
    errors.push("privacy_policy_accepted is required before generation.");
  }
  if (!consent.heritage_disclaimer_accepted) {
    errors.push("heritage_disclaimer_accepted is required before generation.");
  }
  if (!consent.ai_generation_consent) {
    errors.push("ai_generation_consent is required before generation.");
  }
  if (!consent.email_delivery_consent) {
    errors.push("email_delivery_consent is required before generation.");
  }

  return invalidResult(errors);
}
