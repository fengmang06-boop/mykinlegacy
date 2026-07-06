import {
  createAiGenerationError,
  normalizeAiProviderError
} from "./errors";
import type { AiProviderRegistry } from "./provider-registry";
import { applyAllowlistedLrePromptReplacement } from "./lre-prompt-replacement";
import type {
  AiGenerationRunRepository,
  AiImageGenerationJobInput,
  AiTextGenerationJobInput,
  ImageOutputCandidate,
  TextOutputCandidate
} from "./types";
import { randomUlidLike } from "./ulid";
import { validateImageInputOrThrow, validateImageProviderOutputOrThrow, validateTextOutputOrThrow } from "./validation-bridge";

export interface AiGenerationJobHandlerDependencies {
  providerRegistry: AiProviderRegistry;
  runRepository: AiGenerationRunRepository;
  now?: () => Date;
}

export async function handleAiImageGenerationJob(
  input: AiImageGenerationJobInput,
  dependencies: AiGenerationJobHandlerDependencies
): Promise<ImageOutputCandidate> {
  validateRequiredJobFields(input);
  const promptReplacement = applyAllowlistedLrePromptReplacement(input);
  const effectiveInput = promptReplacement.input;
  validateImageInputOrThrow(effectiveInput);

  const provider = dependencies.providerRegistry.getProvider(effectiveInput.provider_code);
  if (!provider.supports_image_generation) {
    throw createAiGenerationError({
      error_code: "ai_provider_not_configured",
      message: "Selected provider does not support image generation.",
      retryable: false
    });
  }

  try {
    const output = await provider.generateImage({
      rendered_prompt_id: effectiveInput.rendered_prompt_id,
      rendered_prompt: effectiveInput.rendered_prompt,
      negative_prompt: effectiveInput.negative_prompt,
      prompt_template_version_id: effectiveInput.prompt_template_version_id,
      identity_version_id: effectiveInput.identity_version_id,
      product_code: effectiveInput.product_code,
      package_code: effectiveInput.package_code,
      deliverable_code: effectiveInput.deliverable_code,
      model_code: effectiveInput.model_code,
      output_requirements: effectiveInput.output_requirements,
      safety_metadata: effectiveInput.safety_metadata
    });
    validateImageProviderOutputOrThrow({ job: effectiveInput, providerOutput: output });

    const run = await dependencies.runRepository.createRun({
      ...baseRun(effectiveInput, promptReplacement.audit),
      negative_prompt: effectiveInput.negative_prompt,
      output_payload_json: {
        ...sanitizeProviderOutput(output),
        lre_bridge: promptReplacement.audit
      },
      status: "succeeded",
      provider_request_id: output.provider_request_id,
      cost_cents_estimated: output.cost_cents_estimated,
      latency_ms: output.latency_ms,
      completed_at: dependencies.now?.() ?? new Date()
    });

    return {
      candidate_id: randomUlidLike(),
      candidate_type: "image",
      deliverable_code: effectiveInput.deliverable_code,
      temporary_output_ref: output.temporary_output_ref,
      validation_status: "pending_or_passed",
      ai_generation_run_id: run.id,
      ready_for_next_step: true,
      cost_cents_estimated: output.cost_cents_estimated,
      provider_request_id: output.provider_request_id
    };
  } catch (error) {
    const normalized = normalizeAiProviderError(error);
    await dependencies.runRepository.createRun({
      ...baseRun(effectiveInput, promptReplacement.audit),
      negative_prompt: effectiveInput.negative_prompt,
      status: "failed",
      output_payload_json: null,
      error_code: normalized.details.error_code,
      error_message: normalized.details.message,
      completed_at: dependencies.now?.() ?? new Date()
    });
    throw normalized;
  }
}

export async function handleAiTextGenerationJob(
  input: AiTextGenerationJobInput,
  dependencies: AiGenerationJobHandlerDependencies
): Promise<TextOutputCandidate> {
  validateRequiredJobFields(input);
  const provider = dependencies.providerRegistry.getProvider(input.provider_code);
  if (!provider.supports_text_generation) {
    throw createAiGenerationError({
      error_code: "ai_provider_not_configured",
      message: "Selected provider does not support text generation.",
      retryable: false
    });
  }

  try {
    const output = await provider.generateText({
      rendered_prompt_id: input.rendered_prompt_id,
      rendered_prompt: input.rendered_prompt,
      prompt_template_version_id: input.prompt_template_version_id,
      identity_version_id: input.identity_version_id,
      product_code: input.product_code,
      package_code: input.package_code,
      deliverable_code: input.deliverable_code,
      model_code: input.model_code,
      output_requirements: input.output_requirements,
      safety_metadata: input.safety_metadata
    });
    validateTextOutputOrThrow({ job: input, output_text: output.output_text });

    const run = await dependencies.runRepository.createRun({
      ...baseRun(input),
      negative_prompt: null,
      output_payload_json: sanitizeProviderOutput(output),
      status: "succeeded",
      provider_request_id: output.provider_request_id,
      cost_cents_estimated: output.cost_cents_estimated,
      latency_ms: output.latency_ms,
      completed_at: dependencies.now?.() ?? new Date()
    });

    return {
      candidate_id: randomUlidLike(),
      candidate_type: "text",
      deliverable_code: input.deliverable_code,
      output_text: output.output_text,
      structured_output_json: output.structured_output_json ?? {},
      validation_status: "passed",
      ai_generation_run_id: run.id,
      ready_for_next_step: true,
      cost_cents_estimated: output.cost_cents_estimated,
      provider_request_id: output.provider_request_id
    };
  } catch (error) {
    const normalized = normalizeAiProviderError(error);
    await dependencies.runRepository.createRun({
      ...baseRun(input),
      negative_prompt: null,
      status: "failed",
      output_payload_json: null,
      error_code: normalized.details.error_code,
      error_message: normalized.details.message,
      completed_at: dependencies.now?.() ?? new Date()
    });
    throw normalized;
  }
}

function validateRequiredJobFields(input: AiImageGenerationJobInput | AiTextGenerationJobInput): void {
  if (!input.prompt_template_version_id) {
    throw createAiGenerationError({
      error_code: "missing_prompt_template_version",
      message: "Missing prompt template version.",
      retryable: false
    });
  }

  if (!input.model_code || !input.ai_model_id) {
    throw createAiGenerationError({
      error_code: "missing_ai_model",
      message: "Missing AI model.",
      retryable: false
    });
  }

  if (!input.provider_code || !input.ai_provider_id) {
    throw createAiGenerationError({
      error_code: "missing_ai_provider",
      message: "Missing AI provider.",
      retryable: false
    });
  }
}

function baseRun(input: AiImageGenerationJobInput | AiTextGenerationJobInput, lreBridge?: unknown) {
  return {
    generation_job_id: input.generation_job_id,
    generation_step_id: input.generation_step_id,
    ai_provider_id: input.ai_provider_id ?? "mock_provider_id",
    ai_model_id: input.ai_model_id ?? "mock_model_id",
    prompt_template_version_id: input.prompt_template_version_id,
    rendered_prompt: input.rendered_prompt,
    input_payload_json: {
      job_id: input.job_id,
      rendered_prompt_id: input.rendered_prompt_id,
      identity_version_id: input.identity_version_id,
      product_code: input.product_code,
      package_code: input.package_code,
      deliverable_code: input.deliverable_code,
      provider_code: input.provider_code,
      model_code: input.model_code,
      output_requirements: input.output_requirements,
      safety_metadata: sanitizeSafetyMetadata(input.safety_metadata),
      ...(lreBridge ? { lre_bridge: lreBridge } : {})
    },
    created_at: new Date()
  };
}

function sanitizeProviderOutput(output: object): Record<string, unknown> {
  const { raw_provider_response_json: rawProviderResponseJson, ...rest } = output as Record<string, unknown>;
  return {
    ...rest,
    raw_provider_response_json: sanitizeSafetyMetadata(
      (rawProviderResponseJson as Record<string, unknown> | undefined) ?? {}
    )
  };
}

function sanitizeSafetyMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !normalized.includes("api_key") && !normalized.includes("secret") && !normalized.includes("prompt");
    })
  );
}
