export type ContractVersion = "1.1";

export type HouseStatus = "active" | "archived" | "deleted";
export type HouseIdentityStatus = "draft" | "confirmed" | "archived";
export type InterviewStatus =
  | "in_progress"
  | "needs_confirmation"
  | "confirmed"
  | "expired"
  | "cancelled";
export type IdentityVersionReason =
  | "initial_create"
  | "user_edit"
  | "regeneration"
  | "product_upgrade"
  | "admin_edit";

export interface ContractMetadata {
  contract_version: ContractVersion;
  schema_version: string;
  created_at: string;
  updated_at: string;
  source: string;
}

export interface TextStrategy {
  include_text_in_image: false;
  render_text_server_side: true;
  text_fields: Array<"house_name" | "motto">;
  text_render_targets: string[];
}

export interface HouseColors {
  primary: string[];
  secondary?: string[];
  metallic?: string[];
  accent?: string[];
}

export interface HousePrivacyPreferences {
  private_by_default: true;
  allow_public_gallery?: boolean;
  allow_marketing_showcase?: boolean;
  data_retention_policy?: string;
}

export interface HouseGenerationPreferences {
  text_strategy: TextStrategy;
  image_count?: number;
  transparent_png?: boolean;
}

export interface HouseDNA extends ContractMetadata {
  locale: string;
  output_language: string;
  fallback_language: string;
  house_name: string;
  surname: string;
  origin_country: string;
  heritage_regions: string[];
  family_values: string[];
  personality_traits: string[];
  guardian_animals: string[];
  symbols: string[];
  colors: HouseColors;
  motto: string | null;
  motto_meaning: string | null;
  visual_style: string;
  emotional_tone: string[];
  story_theme: string | null;
  cultural_references: string[];
  forbidden_elements: string[];
  preferred_elements: string[];
  generation_preferences: HouseGenerationPreferences;
  privacy_preferences: HousePrivacyPreferences;
  future_product_preferences: string[];
}

export interface InterviewAnswer extends ContractMetadata {
  step_code: string;
  raw_answer: unknown;
  normalized_output?: Partial<HouseDNA>;
  maps_to_house_dna: string[];
}

export interface NormalizedInput extends ContractMetadata {
  normalized_house_dna: Partial<HouseDNA>;
  confidence_score: number;
  inferred_fields: string[];
  user_confirm_required_fields: string[];
  notes: string[];
}

export interface IdentityVersion extends ContractMetadata {
  id?: string;
  house_id: string;
  identity_id: string;
  identity_version: number;
  version_reason: IdentityVersionReason;
  previous_version_id: string | null;
  active_version: boolean;
  generated_from_order_id: string | null;
  generated_from_interview_id: string | null;
  generated_from_admin_edit: boolean;
  house_dna_snapshot: HouseDNA;
  changed_fields: ChangedHouseDnaField[];
}

export interface ChangedHouseDnaField {
  field: HouseDnaVersionedField;
  before: unknown;
  after: unknown;
}

export type HouseDnaVersionedField =
  | "house_name"
  | "surname"
  | "origin_country"
  | "heritage_regions"
  | "family_values"
  | "guardian_animals"
  | "symbols"
  | "colors"
  | "motto"
  | "visual_style"
  | "story_theme"
  | "cultural_references"
  | "forbidden_elements"
  | "preferred_elements";

export type MemoryLayer = "explicit_memory" | "behavioral_memory" | "system_memory";

export interface IdentityMemoryItem {
  memory_type: string;
  value: unknown;
  source_event: string;
  confidence: number;
  weight: number;
  created_at: string;
  last_used_at: string | null;
  affects_prompt: boolean;
  affects_recommendation: boolean;
  user_visible: boolean;
  user_editable: boolean;
}

export interface IdentityMemory extends ContractMetadata {
  house_id: string;
  identity_version_id: string | null;
  explicit_memory: IdentityMemoryItem[];
  behavioral_memory: IdentityMemoryItem[];
  system_memory: IdentityMemoryItem[];
}

export interface ConsentRecord extends ContractMetadata {
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  privacy_policy_accepted: boolean;
  privacy_policy_accepted_at: string | null;
  heritage_disclaimer_accepted: boolean;
  heritage_disclaimer_accepted_at: string | null;
  ai_generation_consent: boolean;
  email_delivery_consent: boolean;
  marketing_opt_in: boolean;
  gallery_opt_in: boolean;
  ip_hash: string | null;
  user_agent_hash: string | null;
  consent_version: string;
}

export interface NormalizationResult {
  normalized_input: NormalizedInput;
}
