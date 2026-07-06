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
  private readonly config: {
    apiKey?: string;
    enabled?: boolean;
    modelCode?: string;
    size?: string;
    quality?: string;
    fetchImpl?: typeof fetch;
  };

  constructor(config: {
    apiKey?: string;
    enabled?: boolean;
    modelCode?: string;
    size?: string;
    quality?: string;
    fetchImpl?: typeof fetch;
  } = {}) {
    this.config = config;
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw createAiGenerationError({
        error_code: "ai_provider_not_configured",
        message: `OpenAI image provider is not configured: ${validation.errors.join(",")}`,
        retryable: false,
        debug_context: { errors: validation.errors }
      });
    }

    const startedAt = Date.now();
    const model = input.model_code || this.config.modelCode || "gpt-image-1";
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;
    const prompt = [
      input.rendered_prompt,
      input.negative_prompt ? `Negative instructions: ${input.negative_prompt}` : null
    ].filter(Boolean).join("\n\n");

    try {
      const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: this.config.size ?? "1024x1024",
          quality: this.config.quality ?? "high",
          output_format: "png"
        })
      });

      const responseJson = await safeJson(response);
      if (!response.ok) {
        throw createAiGenerationError({
          error_code: "ai_provider_error",
          message: `OpenAI image request failed with HTTP ${response.status}`,
          retryable: response.status >= 500 || response.status === 429,
          debug_context: {
            status: response.status,
            provider_error: summarizeProviderError(responseJson)
          }
        });
      }

      const first = Array.isArray(responseJson.data) ? responseJson.data[0] : null;
      const b64Json = typeof first?.b64_json === "string" ? first.b64_json : null;
      const url = typeof first?.url === "string" ? first.url : null;
      if (!b64Json && !url) {
        throw createAiGenerationError({
          error_code: "ai_generation_failed",
          message: "OpenAI image response did not include b64_json or url.",
          retryable: true,
          debug_context: { response_shape: Object.keys(responseJson) }
        });
      }

      const { width, height } = dimensionsFromSize(this.config.size ?? "1024x1024");
      return {
        provider_request_id: typeof responseJson.id === "string" ? responseJson.id : `openai-image-${Date.now()}`,
        temporary_output_ref: b64Json ? `data:image/png;base64,${b64Json}` : url,
        output_format: "png",
        width,
        height,
        latency_ms: Date.now() - startedAt,
        cost_cents_estimated: this.estimateCost({
          generation_type: "image",
          model_code: model
        }),
        raw_provider_response_json: {
          id: typeof responseJson.id === "string" ? responseJson.id : null,
          model,
          has_b64_json: Boolean(b64Json),
          has_url: Boolean(url)
        },
        status: "succeeded"
      };
    } catch (error) {
      if (isAiGenerationErrorLike(error)) throw error;
      throw createAiGenerationError({
        error_code: "ai_provider_error",
        message: error instanceof Error ? error.message : "OpenAI image request failed.",
        retryable: true
      });
    }
  }

  async generateText(_input: GenerateTextInput): Promise<GenerateTextOutput> {
    throw createAiGenerationError({
      error_code: "ai_provider_not_configured",
      message: "OpenAI adapter skeleton is disabled in Milestone 8.",
      retryable: false
    });
  }

  estimateCost(_input?: { generation_type: "image" | "text"; model_code: string }): number {
    return 30;
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

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function summarizeProviderError(value: Record<string, unknown>): Record<string, unknown> {
  const error = isRecord(value.error) ? value.error : {};
  return {
    type: typeof error.type === "string" ? error.type : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message.slice(0, 240) : undefined
  };
}

function dimensionsFromSize(size: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return { width: 1024, height: 1024 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isAiGenerationErrorLike(error: unknown): boolean {
  return isRecord(error) && isRecord(error.details) && typeof error.details.error_code === "string";
}
