export interface SafetyHouseDNA {
  origin_country: string;
  visual_style: string;
  guardian_animals: string[];
  symbols: string[];
  colors: {
    primary: string[];
  };
  generation_preferences: {
    text_strategy: {
      include_text_in_image: boolean;
      render_text_server_side: boolean;
    };
  };
}

export interface PromptSafetyRules {
  forbidden_terms: string[];
  required_disclaimer: string;
  required_safe_language: string[];
  no_text_image_negative_terms: string[];
  copyrighted_logo_terms: string[];
  official_emblem_terms: string[];
}

export type PromptRecommendedAction =
  | "allow"
  | "rewrite"
  | "regenerate"
  | "regenerate_or_admin_review"
  | "block";

export interface ForbiddenTermMatch {
  term: string;
  match_context: string;
  severity: "soft_warning" | "hard_failure";
  allowed_in_disclaimer: boolean;
  is_positive_claim: boolean;
  location: string;
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

export interface KnowledgeDefinition {
  id: string;
  definition_type:
    | "symbol"
    | "animal_symbol"
    | "color_meaning"
    | "motto_pattern"
    | "heritage_style"
    | "cultural_sensitivity_rule"
    | "heraldry_disclaimer_rule";
  key: string;
  label: string;
  content: string;
  source_type:
    | "internal_curated"
    | "public_domain_reference"
    | "ai_suggested"
    | "admin_created"
    | "user_provided";
  confidence_level: "low" | "medium" | "high";
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
  source_type: KnowledgeDefinition["source_type"];
  confidence_level: KnowledgeDefinition["confidence_level"];
  definition_type: KnowledgeDefinition["definition_type"];
}

export interface TextOutputValidationInput {
  output_text: string;
  prompt_type: string;
  house_dna: SafetyHouseDNA;
  safety_rules: PromptSafetyRules;
  min_words?: number;
  max_words?: number;
}

export interface RenderedPromptForValidation {
  rendered_prompt: string;
  negative_prompt: string | null;
  metadata: Record<string, unknown>;
}

export interface ImagePromptValidationInput {
  rendered_prompt: RenderedPromptForValidation;
  house_dna: SafetyHouseDNA;
  safety_rules: PromptSafetyRules;
}
