import { describe, expect, it } from "vitest";

import {
  AiGenerationError,
  DefaultAiProviderRegistry,
  InMemoryAiGenerationRunRepository,
  buildAiGenerationLog,
  handleAiImageGenerationJob,
  handleAiTextGenerationJob
} from "./index";
import type { AiImageGenerationJobInput, AiTextGenerationJobInput, MockAiProvider } from "./index";

describe("AI generation pipeline foundation", () => {
  it("runs mock image generation successfully", async () => {
    const runs = new InMemoryAiGenerationRunRepository();
    const candidate = await handleAiImageGenerationJob(imageJob(), {
      providerRegistry: registry(),
      runRepository: runs
    });

    expect(candidate).toMatchObject({
      candidate_type: "image",
      deliverable_code: "crest_variant_1_png",
      temporary_output_ref: "mock://image/crest_variant_1_png.png",
      validation_status: "pending_or_passed",
      ready_for_next_step: true,
      cost_cents_estimated: 12,
      provider_request_id: "mock-image-rendered_prompt_1"
    });
    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]).toMatchObject({
      status: "succeeded",
      provider_request_id: "mock-image-rendered_prompt_1",
      latency_ms: 25,
      cost_cents_estimated: 12
    });
  });

  it("runs mock text generation successfully and includes disclaimer", async () => {
    const runs = new InMemoryAiGenerationRunRepository();
    const candidate = await handleAiTextGenerationJob(textJob(), {
      providerRegistry: registry(),
      runRepository: runs
    });

    expect(candidate.candidate_type).toBe("text");
    expect(candidate.output_text).toContain("This is a personalized, AI-generated");
    expect(candidate.validation_status).toBe("passed");
    expect(runs.runs[0]?.cost_cents_estimated).toBe(3);
  });

  it("blocks image prompt that requests visible text", async () => {
    await expect(
      handleAiImageGenerationJob(
        imageJob({
          rendered_prompt: "Please render the motto and surname as visible words."
        }),
        {
          providerRegistry: registry(),
          runRepository: new InMemoryAiGenerationRunRepository()
        }
      )
    ).rejects.toMatchObject({
      details: {
        error_code: "no_text_rule_violation",
        retryable: false
      }
    });
  });

  it("blocks image generation when include_text_in_image is true", async () => {
    await expect(
      handleAiImageGenerationJob(
        imageJob({
          safety_metadata: {
            ...baseSafetyMetadata(),
            include_text_in_image: true
          }
        }),
        {
          providerRegistry: registry(),
          runRepository: new InMemoryAiGenerationRunRepository()
        }
      )
    ).rejects.toMatchObject({
      details: {
        error_code: "no_text_rule_violation"
      }
    });
  });

  it("blocks image prompt when no-text negative prompt is missing", async () => {
    await expect(
      handleAiImageGenerationJob(imageJob({ negative_prompt: "watermark" }), {
        providerRegistry: registry(),
        runRepository: new InMemoryAiGenerationRunRepository()
      })
    ).rejects.toMatchObject({
      details: {
        error_code: "no_text_rule_violation"
      }
    });
  });

  it("blocks forbidden official positive claim in text output", async () => {
    await expect(
      handleAiTextGenerationJob(textJob(), {
        providerRegistry: registry("forbidden_positive_claim"),
        runRepository: new InMemoryAiGenerationRunRepository()
      })
    ).rejects.toMatchObject({
      details: {
        error_code: "ai_output_validation_failed"
      }
    });
  });

  it("passes disclaimer negation in safe mock output", async () => {
    const candidate = await handleAiTextGenerationJob(textJob(), {
      providerRegistry: registry(),
      runRepository: new InMemoryAiGenerationRunRepository()
    });

    expect(candidate.output_text).toContain("not an official");
  });

  it("fails missing disclaimer text output", async () => {
    await expect(
      handleAiTextGenerationJob(textJob(), {
        providerRegistry: registry("missing_disclaimer"),
        runRepository: new InMemoryAiGenerationRunRepository()
      })
    ).rejects.toMatchObject({
      details: {
        error_code: "ai_output_validation_failed"
      }
    });
  });

  it("records failed ai_generation_run when provider errors", async () => {
    const runs = new InMemoryAiGenerationRunRepository();

    await expect(
      handleAiImageGenerationJob(imageJob(), {
        providerRegistry: registry("provider_error"),
        runRepository: runs
      })
    ).rejects.toMatchObject({
      details: {
        error_code: "ai_provider_error"
      }
    });

    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]).toMatchObject({
      status: "failed",
      error_code: "ai_provider_error"
    });
  });

  it("normalizes timeout errors", async () => {
    await expect(
      handleAiImageGenerationJob(imageJob(), {
        providerRegistry: registry("timeout"),
        runRepository: new InMemoryAiGenerationRunRepository()
      })
    ).rejects.toMatchObject({
      details: {
        error_code: "ai_provider_timeout",
        retryable: true
      }
    });
  });

  it("creates a new ai_generation_run for each retry", async () => {
    const runs = new InMemoryAiGenerationRunRepository();
    const deps = {
      providerRegistry: registry("provider_error"),
      runRepository: runs
    };

    await handleAiImageGenerationJob(imageJob({ job_id: "try_1" }), deps).catch(() => undefined);
    await handleAiImageGenerationJob(imageJob({ job_id: "try_2" }), deps).catch(() => undefined);

    expect(runs.runs).toHaveLength(2);
    expect(runs.runs[0]?.id).not.toBe(runs.runs[1]?.id);
  });

  it("fails mock text invented ancestor output", async () => {
    await expect(
      handleAiTextGenerationJob(textJob(), {
        providerRegistry: registry("invented_ancestor"),
        runRepository: new InMemoryAiGenerationRunRepository()
      })
    ).rejects.toBeInstanceOf(AiGenerationError);
  });

  it("does not write rendered prompt or API key to structured logs", () => {
    const log = buildAiGenerationLog({
      level: "info",
      message: "ai_generation_started",
      job_id: "job_1",
      extra: {
        rendered_prompt: "secret prompt",
        openai_api_key: "sk-secret",
        safe: "kept"
      }
    });

    expect(JSON.stringify(log)).not.toContain("secret prompt");
    expect(JSON.stringify(log)).not.toContain("sk-secret");
    expect(log.extra).toEqual({ safe: "kept" });
  });

  it("worker processor contract does not create assets, update payment, or send email", async () => {
    const runs = new InMemoryAiGenerationRunRepository();
    await handleAiImageGenerationJob(imageJob(), {
      providerRegistry: registry(),
      runRepository: runs
    });

    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]?.output_payload_json).not.toHaveProperty("asset_id");
    expect(runs.runs[0]?.output_payload_json).not.toHaveProperty("payment_status");
    expect(runs.runs[0]?.output_payload_json).not.toHaveProperty("email_log_id");
  });
});

function registry(mode: ConstructorParameters<typeof MockAiProvider>[0] = "success") {
  return new DefaultAiProviderRegistry({ mockMode: mode });
}

function imageJob(overrides: Partial<AiImageGenerationJobInput> = {}): AiImageGenerationJobInput {
  return {
    job_id: "job_image_1",
    generation_job_id: "generation_job_1",
    generation_step_id: null,
    rendered_prompt_id: "rendered_prompt_1",
    rendered_prompt:
      "Create a heritage-inspired symbolic crest. Do not render text, letters, words, surname, motto, or initials.",
    negative_prompt:
      "no readable text, no letters, no words, no motto, no surname, no initials, no banner text, no official coat of arms, no royal emblem, no national emblem, no company logo, no copyrighted logo",
    prompt_template_version_id: "prompt_template_version_1",
    identity_version_id: "identity_version_1",
    product_code: "family_legacy_collection",
    package_code: "standard",
    deliverable_code: "crest_variant_1_png",
    provider_code: "mock",
    model_code: "image-model-placeholder",
    ai_provider_id: "ai_provider_mock",
    ai_model_id: "ai_model_image",
    output_requirements: {
      text_must_be_rendered_server_side: true
    },
    safety_metadata: baseSafetyMetadata(),
    ...overrides
  };
}

function textJob(overrides: Partial<AiTextGenerationJobInput> = {}): AiTextGenerationJobInput {
  return {
    job_id: "job_text_1",
    generation_job_id: "generation_job_1",
    generation_step_id: null,
    rendered_prompt_id: "rendered_prompt_1",
    rendered_prompt:
      "Write personalized, AI-generated, heritage-inspired symbolic text and include the required disclaimer.",
    prompt_template_version_id: "prompt_template_version_1",
    identity_version_id: "identity_version_1",
    product_code: "family_legacy_collection",
    package_code: "standard",
    deliverable_code: "family_story_pdf",
    provider_code: "mock",
    model_code: "text-model-placeholder",
    ai_provider_id: "ai_provider_mock",
    ai_model_id: "ai_model_text",
    output_requirements: {},
    safety_metadata: baseSafetyMetadata(),
    ...overrides
  };
}

function baseSafetyMetadata(): Record<string, unknown> {
  return {
    origin_country: "Ireland",
    visual_style: "gothic",
    guardian_animals: ["lion"],
    symbols: [],
    colors: ["black", "gold"],
    include_text_in_image: false,
    forbidden_elements_injected: true
  };
}
