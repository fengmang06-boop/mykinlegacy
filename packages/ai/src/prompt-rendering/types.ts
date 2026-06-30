export type PromptType = "image" | "story" | "certificate" | "explanation" | "readme" | "email";

export interface PromptHouseDNA {
  locale: string;
  output_language: string;
  fallback_language: string;
  house_name: string;
  surname: string;
  origin_country: string;
  heritage_regions: string[];
  family_values: string[];
  guardian_animals: string[];
  symbols: string[];
  colors: {
    primary: string[];
    secondary?: string[];
    metallic?: string[];
    accent?: string[];
  };
  motto: string | null;
  visual_style: string;
  forbidden_elements: string[];
  preferred_elements: string[];
  generation_preferences: {
    text_strategy: {
      include_text_in_image: boolean;
      render_text_server_side: boolean;
      text_fields?: string[];
      text_render_targets?: string[];
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

export interface PromptRenderContext {
  house_dna: PromptHouseDNA;
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

export interface PromptTemplateVersionRecord {
  id: string;
  prompt_type: PromptType;
  template_body: string;
  negative_prompt: string | null;
  variables_schema_json: {
    required?: string[];
    optional?: string[];
  } | null;
  params_json: Record<string, unknown> | null;
}

export interface ActivePromptBindingRecord {
  id: string;
  product_code: string;
  package_code: string | null;
  deliverable_code: string | null;
  prompt_template_version: PromptTemplateVersionRecord;
}

export interface PromptRepository {
  getActivePromptBinding(input: {
    product_code: string;
    package_code: string;
    deliverable_code: string;
  }): Promise<ActivePromptBindingRecord | null>;
  getPromptTemplateVersion(id: string): Promise<PromptTemplateVersionRecord | null>;
  listPromptTemplatesForProduct(productCode: string): Promise<ActivePromptBindingRecord[]>;
}

export interface KnowledgeContextItem {
  key: string;
  label: string;
  content: string;
  source_type: string;
  confidence_level: string;
  definition_type: string;
}

export interface PromptRenderResult {
  rendered_prompt: RenderedPrompt | null;
  validation: {
    valid: boolean;
    hard_failures: string[];
    soft_warnings: string[];
    rewrite_required: boolean;
    recommended_action: string;
  };
}
