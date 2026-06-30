import type { HouseDNA } from "../house-identity";

export type PromptType = "image" | "story" | "certificate" | "explanation" | "readme" | "email";

export type PromptRecommendedAction =
  | "allow"
  | "rewrite"
  | "regenerate"
  | "regenerate_or_admin_review"
  | "block";

export type ForbiddenTermSeverity = "soft_warning" | "hard_failure";

export interface PromptSafetyRules {
  forbidden_terms: string[];
  required_disclaimer: string;
  required_safe_language: string[];
  no_text_image_negative_terms: string[];
  copyrighted_logo_terms: string[];
  official_emblem_terms: string[];
}

export interface PromptRenderContext {
  house_dna: HouseDNA;
  identity_version_id: string;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  prompt_template_version_id: string;
  locale: string;
  output_language: string;
  fallback_language: string;
  model_preferences?: Record<string, unknown>;
  safety_rules: PromptSafetyRules;
  output_requirements: Record<string, unknown>;
  knowledge_context?: KnowledgeContextItem[];
}

export interface RenderedPrompt {
  rendered_prompt_id: string;
  prompt_template_version_id: string;
  prompt_type: PromptType;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  rendered_prompt: string;
  negative_prompt: string | null;
  prompt_variables_used: Record<string, string>;
  forbidden_terms_applied: string[];
  safety_disclaimers_applied: string[];
  expected_output_format: string;
  quality_requirements: string[];
  metadata: Record<string, unknown>;
}

export interface PromptSafetyValidationResult {
  valid: boolean;
  hard_failures: string[];
  soft_warnings: string[];
  rewrite_required: boolean;
  forbidden_terms_detected: ForbiddenTermMatch[];
  disclaimer_present: boolean;
  no_text_image_rule_passed: boolean;
  recommended_action: PromptRecommendedAction;
}

export interface ForbiddenTermMatch {
  term: string;
  match_context: string;
  severity: ForbiddenTermSeverity;
  allowed_in_disclaimer: boolean;
  is_positive_claim: boolean;
  location: string;
}

export type KnowledgeSourceType =
  | "internal_curated"
  | "public_domain_reference"
  | "ai_suggested"
  | "admin_created"
  | "user_provided";

export type KnowledgeConfidenceLevel = "low" | "medium" | "high";

export type KnowledgeDefinitionType =
  | "symbol"
  | "animal_symbol"
  | "color_meaning"
  | "motto_pattern"
  | "heritage_style"
  | "cultural_sensitivity_rule"
  | "heraldry_disclaimer_rule";

export interface KnowledgeDefinition {
  id: string;
  definition_type: KnowledgeDefinitionType;
  key: string;
  label: string;
  content: string;
  source_type: KnowledgeSourceType;
  confidence_level: KnowledgeConfidenceLevel;
  reviewed_by_admin: boolean;
  reviewed_at: string | null;
  active: boolean;
  version: number;
  applies_to?: string[];
}

export interface KnowledgeContextItem {
  key: string;
  label: string;
  content: string;
  source_type: KnowledgeSourceType;
  confidence_level: KnowledgeConfidenceLevel;
  definition_type: KnowledgeDefinitionType;
}

export interface TextOutputValidationInput {
  output_text: string;
  prompt_type: PromptType;
  house_dna: HouseDNA;
  safety_rules: PromptSafetyRules;
  min_words?: number;
  max_words?: number;
}

export interface ImagePromptValidationInput {
  rendered_prompt: RenderedPrompt;
  house_dna: HouseDNA;
  safety_rules: PromptSafetyRules;
}
