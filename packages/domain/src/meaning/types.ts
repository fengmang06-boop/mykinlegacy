export type MeaningConfidence = "low" | "medium" | "high";
export type MeaningSourceLevel = "minimal" | "customer_informed" | "customer_confirmed";
export type MeaningSource =
  | "customer_input"
  | "symbolic_interpretation"
  | "system_default"
  | "safety_boundary";

export interface MeaningCustomerInputs {
  recipient: string | null;
  occasion: string | null;
  values: string[];
  memories: string[];
  preferred_tone: string[];
  symbols: string[];
  colors: string[];
  surname: string | null;
  house_name: string | null;
  motto: string | null;
}

export interface MeaningTheme {
  theme: string;
  evidence: string;
  confidence: MeaningConfidence;
}

export interface SymbolChoice {
  symbol: string;
  meaning: string;
  rationale: string;
  source: MeaningSource;
}

export interface MeaningValidationResult {
  valid: boolean;
  quality_flags: string[];
  banned_claims_found: string[];
}

export interface MeaningProfile {
  contract_version: "1.0";
  schema_version: "meaning_profile.v1";
  created_at: string;
  updated_at: string;
  source: "rule_based_meaning_engine";
  source_level: MeaningSourceLevel;
  customer_inputs: MeaningCustomerInputs;
  meaning_themes: MeaningTheme[];
  symbol_choices: SymbolChoice[];
  design_rationale: string[];
  story_direction: string;
  certificate_direction: string;
  boundary_statement: string;
  validation: MeaningValidationResult;
}

export interface GenerationBrief {
  contract_version: "1.0";
  schema_version: "generation_brief.v1";
  created_at: string;
  source: "rule_based_meaning_engine";
  source_level: MeaningSourceLevel;
  meaning_profile: MeaningProfile;
  art_direction: {
    composition: string[];
    palette: string[];
    avoid: string[];
  };
  text_strategy: {
    include_text_in_image: false;
    render_text_server_side: true;
    text_fields: string[];
  };
}

export interface MeaningEngineInput {
  recipient?: string | null;
  occasion?: string | null;
  values?: string[];
  memories?: string[];
  preferred_tone?: string[];
  symbols?: string[];
  colors?: string[];
  surname?: string | null;
  house_name?: string | null;
  motto?: string | null;
  source_level?: MeaningSourceLevel;
}

export interface MeaningManifestAttachment {
  attachment_type: "meaning_engine";
  version: "1.0";
  meaning_profile: MeaningProfile;
  generation_brief: GenerationBrief;
}
