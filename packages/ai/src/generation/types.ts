export type AiGenerationStatus = "succeeded" | "failed";
export type AiCandidateType = "image" | "text";
export type AiValidationStatus = "pending_or_passed" | "passed" | "failed";

export interface GenerateImageInput {
  rendered_prompt_id: string;
  rendered_prompt: string;
  negative_prompt: string | null;
  prompt_template_version_id: string;
  identity_version_id: string;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  model_code: string;
  output_requirements: Record<string, unknown>;
  safety_metadata: Record<string, unknown>;
}

export interface GenerateImageOutput {
  provider_request_id: string;
  temporary_output_ref: string;
  output_format: string;
  width: number;
  height: number;
  latency_ms: number;
  cost_cents_estimated: number;
  raw_provider_response_json?: Record<string, unknown>;
  status: AiGenerationStatus;
}

export interface GenerateTextInput {
  rendered_prompt_id: string;
  rendered_prompt: string;
  prompt_template_version_id: string;
  identity_version_id: string;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  model_code: string;
  output_requirements: Record<string, unknown>;
  safety_metadata: Record<string, unknown>;
}

export interface GenerateTextOutput {
  provider_request_id: string;
  output_text: string;
  structured_output_json?: Record<string, unknown>;
  latency_ms: number;
  cost_cents_estimated: number;
  raw_provider_response_json?: Record<string, unknown>;
  status: AiGenerationStatus;
}

export interface AiProviderAdapter {
  provider_code: string;
  supports_image_generation: boolean;
  supports_text_generation: boolean;
  generateImage(input: GenerateImageInput): Promise<GenerateImageOutput>;
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  estimateCost(input: { generation_type: AiCandidateType; model_code: string }): number;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] };
}

export type AiErrorCode =
  | "ai_provider_not_configured"
  | "ai_provider_timeout"
  | "ai_provider_error"
  | "ai_generation_failed"
  | "ai_output_validation_failed"
  | "unsafe_prompt_blocked"
  | "no_text_rule_violation"
  | "missing_prompt_template_version"
  | "missing_ai_model"
  | "missing_ai_provider";

export interface AiGenerationErrorDetails {
  error_code: AiErrorCode;
  retryable: boolean;
  severity: "warning" | "error" | "critical";
  debug_context: Record<string, unknown>;
  message: string;
}

export interface AiGenerationJobBaseInput {
  job_id: string;
  generation_job_id: string;
  generation_step_id: string | null;
  rendered_prompt_id: string;
  rendered_prompt: string;
  prompt_template_version_id: string;
  identity_version_id: string;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  provider_code: string;
  model_code: string;
  output_requirements: Record<string, unknown>;
  safety_metadata: Record<string, unknown>;
  ai_provider_id?: string;
  ai_model_id?: string;
}

export interface AiImageGenerationJobInput extends AiGenerationJobBaseInput {
  negative_prompt: string | null;
}

export type AiTextGenerationJobInput = AiGenerationJobBaseInput;

export interface ImageOutputCandidate {
  candidate_id: string;
  candidate_type: "image";
  deliverable_code: string;
  temporary_output_ref: string;
  validation_status: AiValidationStatus;
  ai_generation_run_id: string;
  ready_for_next_step: boolean;
  cost_cents_estimated: number;
  provider_request_id: string;
}

export interface TextOutputCandidate {
  candidate_id: string;
  candidate_type: "text";
  deliverable_code: string;
  output_text: string;
  structured_output_json: Record<string, unknown>;
  validation_status: AiValidationStatus;
  ai_generation_run_id: string;
  ready_for_next_step: boolean;
  cost_cents_estimated: number;
  provider_request_id: string;
}

export type AiOutputCandidate = ImageOutputCandidate | TextOutputCandidate;

export interface AiGenerationRunCreateInput {
  generation_job_id: string;
  generation_step_id: string | null;
  ai_provider_id: string;
  ai_model_id: string;
  prompt_template_version_id: string | null;
  rendered_prompt: string;
  negative_prompt: string | null;
  input_payload_json: Record<string, unknown>;
  output_payload_json?: Record<string, unknown> | null;
  status: "pending" | "succeeded" | "failed";
  provider_request_id?: string | null;
  cost_cents_estimated?: number | null;
  latency_ms?: number | null;
  error_code?: AiErrorCode | null;
  error_message?: string | null;
  created_at?: Date;
  completed_at?: Date | null;
}

export interface AiGenerationRunRecord extends AiGenerationRunCreateInput {
  id: string;
  created_at: Date;
}

export interface AiGenerationRunRepository {
  createRun(input: AiGenerationRunCreateInput): Promise<AiGenerationRunRecord>;
}
