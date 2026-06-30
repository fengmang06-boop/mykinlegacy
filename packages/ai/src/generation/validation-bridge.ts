import type {
  AiImageGenerationJobInput,
  AiTextGenerationJobInput,
  AiGenerationErrorDetails
} from "./types";
import { createAiGenerationError } from "./errors";

interface ValidationModule {
  DEFAULT_PROMPT_SAFETY_RULES: Record<string, unknown>;
  validateRenderedImagePrompt(input: {
    rendered_prompt: {
      rendered_prompt: string;
      negative_prompt: string | null;
      metadata: Record<string, unknown>;
    };
    house_dna: Record<string, unknown>;
    safety_rules: Record<string, unknown>;
  }): ValidationResult;
  validateTextOutput(input: {
    output_text: string;
    prompt_type: string;
    house_dna: Record<string, unknown>;
    safety_rules: Record<string, unknown>;
    min_words?: number;
    max_words?: number;
  }): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  hard_failures: string[];
  soft_warnings: string[];
  rewrite_required: boolean;
  recommended_action: string;
}

export function validateImageInputOrThrow(input: AiImageGenerationJobInput): ValidationResult {
  const validation = requireValidation();
  const result = validation.validateRenderedImagePrompt({
    rendered_prompt: {
      rendered_prompt: input.rendered_prompt,
      negative_prompt: input.negative_prompt,
      metadata: {
        ...input.safety_metadata,
        text_must_be_rendered_server_side:
          input.output_requirements.text_must_be_rendered_server_side === true,
        forbidden_elements_injected: input.safety_metadata.forbidden_elements_injected === true
      }
    },
    house_dna: toSafetyHouseDna(input),
    safety_rules: validation.DEFAULT_PROMPT_SAFETY_RULES
  });

  if (!result.valid) {
    const isNoTextViolation = result.hard_failures.some((failure) =>
      failure.toLowerCase().includes("text")
    );

    throw createAiGenerationError({
      error_code: isNoTextViolation ? "no_text_rule_violation" : "unsafe_prompt_blocked",
      message: result.hard_failures.join("; ") || "Unsafe image prompt blocked.",
      retryable: false,
      debug_context: {
        deliverable_code: input.deliverable_code,
        rendered_prompt_id: input.rendered_prompt_id
      }
    });
  }

  return result;
}

export function validateTextOutputOrThrow(input: {
  job: AiTextGenerationJobInput;
  output_text: string;
}): ValidationResult {
  const validation = requireValidation();
  const result = validation.validateTextOutput({
    output_text: input.output_text,
    prompt_type: inferPromptType(input.job.deliverable_code),
    house_dna: toSafetyHouseDna(input.job),
    safety_rules: validation.DEFAULT_PROMPT_SAFETY_RULES,
    min_words: 3
  });

  if (!result.valid || result.rewrite_required) {
    throw createAiGenerationError({
      error_code: "ai_output_validation_failed",
      message: [...result.hard_failures, ...result.soft_warnings].join("; ") || "AI text output validation failed.",
      retryable: true,
      debug_context: {
        deliverable_code: input.job.deliverable_code,
        rendered_prompt_id: input.job.rendered_prompt_id
      }
    });
  }

  return result;
}

export function validateImageProviderOutputOrThrow(input: {
  job: AiImageGenerationJobInput;
  providerOutput: { raw_provider_response_json?: Record<string, unknown> };
}): void {
  const raw = input.providerOutput.raw_provider_response_json ?? {};
  if (raw.text_detected === true) {
    throw createAiGenerationError({
      error_code: "ai_output_validation_failed",
      message: "Mock image output reported text_detected.",
      retryable: true,
      debug_context: {
        deliverable_code: input.job.deliverable_code
      }
    });
  }

  if (raw.unsafe_logo_risk === true) {
    throw createAiGenerationError({
      error_code: "ai_output_validation_failed",
      message: "Mock image output reported unsafe_logo_risk.",
      retryable: true,
      debug_context: {
        deliverable_code: input.job.deliverable_code
      }
    });
  }
}

export function toSafeFailure(error: unknown): AiGenerationErrorDetails {
  if (error && typeof error === "object" && "details" in error) {
    return (error as { details: AiGenerationErrorDetails }).details;
  }

  return {
    error_code: "ai_generation_failed",
    retryable: true,
    severity: "error",
    debug_context: {},
    message: error instanceof Error ? error.message : "AI generation failed"
  };
}

function toSafetyHouseDna(
  input: AiImageGenerationJobInput | AiTextGenerationJobInput
): Record<string, unknown> {
  const metadata = input.safety_metadata;

  return {
    origin_country: String(metadata.origin_country ?? "unknown"),
    visual_style: String(metadata.visual_style ?? "heritage-inspired"),
    guardian_animals: Array.isArray(metadata.guardian_animals) ? metadata.guardian_animals : ["symbol"],
    symbols: Array.isArray(metadata.symbols) ? metadata.symbols : [],
    colors: {
      primary: Array.isArray(metadata.colors) ? metadata.colors : ["black"]
    },
    generation_preferences: {
      text_strategy: {
        include_text_in_image: metadata.include_text_in_image === true,
        render_text_server_side: input.output_requirements.text_must_be_rendered_server_side === true
      }
    }
  };
}

function inferPromptType(deliverableCode: string): string {
  if (deliverableCode.includes("certificate")) {
    return "certificate";
  }
  if (deliverableCode.includes("symbol")) {
    return "explanation";
  }
  if (deliverableCode.includes("email")) {
    return "email";
  }
  return "story";
}

function requireValidation(): ValidationModule {
  return LOCAL_VALIDATION;
}

const LOCAL_DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

const LOCAL_VALIDATION: ValidationModule = {
  DEFAULT_PROMPT_SAFETY_RULES: {
    forbidden_terms: ["official coat of arms", "granted by the crown", "authentic ancestral crest"],
    required_disclaimer: LOCAL_DISCLAIMER,
    required_safe_language: ["personalized", "AI-generated", "heritage-inspired", "symbolic"],
    no_text_image_negative_terms: ["no readable text", "no letters", "no words"],
    copyrighted_logo_terms: ["copyrighted logo", "company logo", "trademark"],
    official_emblem_terms: ["official coat of arms", "royal emblem", "national emblem"]
  },
  validateRenderedImagePrompt(input) {
    const hardFailures: string[] = [];
    const negativePrompt = input.rendered_prompt.negative_prompt ?? "";
    if (input.house_dna.generation_preferences instanceof Object) {
      const preferences = input.house_dna.generation_preferences as {
        text_strategy?: { include_text_in_image?: boolean };
      };
      if (preferences.text_strategy?.include_text_in_image === true) {
        hardFailures.push("include_text_in_image is not allowed for MVP image prompts.");
      }
    }
    if (/(write|render|display|show|include|add)\s+(the\s+)?(motto|surname|house name|letters|words)/i.test(input.rendered_prompt.rendered_prompt)) {
      hardFailures.push("Image prompt appears to request visible text generation.");
    }
    for (const term of ["no readable text", "no letters", "no words"]) {
      if (!negativePrompt.toLowerCase().includes(term)) {
        hardFailures.push(`Image negative prompt is missing no-text term: ${term}`);
      }
    }
    if (/official coat of arms|royal emblem|copyrighted logo/i.test(input.rendered_prompt.rendered_prompt)) {
      hardFailures.push("Image prompt contains official or copyrighted request.");
    }
    return {
      valid: hardFailures.length === 0,
      hard_failures: hardFailures,
      soft_warnings: [],
      rewrite_required: hardFailures.length > 0,
      recommended_action: hardFailures.length > 0 ? "block" : "allow"
    };
  },
  validateTextOutput(input) {
    const hardFailures: string[] = [];
    if (/official coat of arms|granted by the crown/i.test(input.output_text) && !/not an official|not official/i.test(input.output_text)) {
      hardFailures.push("Text output contains forbidden positive official/legal/historical claims.");
    }
    if (!input.output_text.includes(LOCAL_DISCLAIMER)) {
      hardFailures.push("Required heritage disclaimer is missing.");
    }
    if (/ancestor\s+[A-Z][a-z]+|descended from [A-Z][a-z]+ [A-Z][a-z]+/i.test(input.output_text)) {
      hardFailures.push("Text output appears to invent named ancestors.");
    }
    return {
      valid: hardFailures.length === 0,
      hard_failures: hardFailures,
      soft_warnings: [],
      rewrite_required: hardFailures.length > 0,
      recommended_action: hardFailures.length > 0 ? "rewrite" : "allow"
    };
  }
};
