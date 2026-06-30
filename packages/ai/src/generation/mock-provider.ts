import { createAiGenerationError } from "./errors";
import type {
  AiProviderAdapter,
  GenerateImageInput,
  GenerateImageOutput,
  GenerateTextInput,
  GenerateTextOutput
} from "./types";

export type MockAiMode =
  | "success"
  | "timeout"
  | "provider_error"
  | "text_detected"
  | "unsafe_logo_risk"
  | "wrong_style"
  | "forbidden_positive_claim"
  | "missing_disclaimer"
  | "invented_ancestor";

const DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

export class MockAiProvider implements AiProviderAdapter {
  public readonly provider_code = "mock";
  public readonly supports_image_generation = true;
  public readonly supports_text_generation = true;

  constructor(private readonly mode: MockAiMode = "success") {}

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    if (this.mode === "timeout") {
      throw createAiGenerationError({
        error_code: "ai_provider_timeout",
        message: "Mock provider timeout",
        retryable: true
      });
    }

    if (this.mode === "provider_error") {
      throw createAiGenerationError({
        error_code: "ai_provider_error",
        message: "Mock provider error",
        retryable: true
      });
    }

    return {
      provider_request_id: `mock-image-${input.rendered_prompt_id}`,
      temporary_output_ref: `mock://image/${input.deliverable_code}.png`,
      output_format: "png",
      width: this.mode === "wrong_style" ? 512 : 2048,
      height: this.mode === "wrong_style" ? 512 : 2048,
      latency_ms: 25,
      cost_cents_estimated: this.estimateCost({
        generation_type: "image",
        model_code: input.model_code
      }),
      raw_provider_response_json: {
        mock_mode: this.mode,
        text_detected: this.mode === "text_detected",
        unsafe_logo_risk: this.mode === "unsafe_logo_risk",
        wrong_style: this.mode === "wrong_style"
      },
      status: "succeeded"
    };
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    if (this.mode === "provider_error") {
      throw createAiGenerationError({
        error_code: "ai_provider_error",
        message: "Mock provider error",
        retryable: true
      });
    }

    if (this.mode === "forbidden_positive_claim") {
      return this.textOutput(input, "This is your official coat of arms. Granted by the crown.");
    }

    if (this.mode === "missing_disclaimer") {
      return this.textOutput(input, "A warm symbolic family story without the required safety language.");
    }

    if (this.mode === "invented_ancestor") {
      return this.textOutput(input, `${DISCLAIMER}\nYour ancestor William Alder founded this noble line.`);
    }

    return this.textOutput(
      input,
      `A personalized, heritage-inspired symbolic family text for this collection.\n${DISCLAIMER}`
    );
  }

  estimateCost(input: { generation_type: "image" | "text"; model_code: string }): number {
    return input.generation_type === "image" ? 12 : 3;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  private textOutput(input: GenerateTextInput, outputText: string): GenerateTextOutput {
    return {
      provider_request_id: `mock-text-${input.rendered_prompt_id}`,
      output_text: outputText,
      structured_output_json: {
        mock: true
      },
      latency_ms: 15,
      cost_cents_estimated: this.estimateCost({
        generation_type: "text",
        model_code: input.model_code
      }),
      raw_provider_response_json: {
        mock_mode: this.mode
      },
      status: "succeeded"
    };
  }
}
