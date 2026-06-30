import { createAiGenerationError } from "./errors";
import type {
  AiProviderAdapter,
  GenerateImageInput,
  GenerateImageOutput,
  GenerateTextInput,
  GenerateTextOutput
} from "./types";

export class OpenAiAdapterSkeleton implements AiProviderAdapter {
  public readonly provider_code = "openai";
  public readonly supports_image_generation = true;
  public readonly supports_text_generation = true;

  constructor(private readonly config: { apiKey?: string; enabled?: boolean } = {}) {}

  async generateImage(_input: GenerateImageInput): Promise<GenerateImageOutput> {
    throw createAiGenerationError({
      error_code: "ai_provider_not_configured",
      message: "OpenAI adapter skeleton is disabled in Milestone 8.",
      retryable: false
    });
  }

  async generateText(_input: GenerateTextInput): Promise<GenerateTextOutput> {
    throw createAiGenerationError({
      error_code: "ai_provider_not_configured",
      message: "OpenAI adapter skeleton is disabled in Milestone 8.",
      retryable: false
    });
  }

  estimateCost(): number {
    return 0;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    if (!this.config.enabled) {
      return { valid: false, errors: ["openai_adapter_disabled"] };
    }

    if (!this.config.apiKey || this.config.apiKey === "replace_me") {
      return { valid: false, errors: ["openai_api_key_missing"] };
    }

    return { valid: true, errors: [] };
  }
}
