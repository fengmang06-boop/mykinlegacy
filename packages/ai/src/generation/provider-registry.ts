import { MockAiProvider, type MockAiMode } from "./mock-provider";
import { OpenAiAdapterSkeleton } from "./openai-adapter";
import { createAiGenerationError } from "./errors";
import type { AiProviderAdapter } from "./types";

export interface AiProviderRegistry {
  getProvider(providerCode: string): AiProviderAdapter;
}

export class DefaultAiProviderRegistry implements AiProviderRegistry {
  private readonly providers = new Map<string, AiProviderAdapter>();

  constructor(input: {
    mockMode?: MockAiMode;
    openAiEnabled?: boolean;
    openAiApiKey?: string;
    openAiModelCode?: string;
    openAiImageSize?: string;
    openAiImageQuality?: string;
  } = {}) {
    this.register(new MockAiProvider(input.mockMode));
    this.register(
      new OpenAiAdapterSkeleton({
        enabled: input.openAiEnabled ?? false,
        apiKey: input.openAiApiKey,
        modelCode: input.openAiModelCode,
        size: input.openAiImageSize,
        quality: input.openAiImageQuality
      })
    );
  }

  register(provider: AiProviderAdapter): void {
    this.providers.set(provider.provider_code, provider);
  }

  getProvider(providerCode: string): AiProviderAdapter {
    const provider = this.providers.get(providerCode);

    if (!provider) {
      throw createAiGenerationError({
        error_code: "missing_ai_provider",
        message: `AI provider is not registered: ${providerCode}`,
        retryable: false,
        debug_context: { provider_code: providerCode }
      });
    }

    return provider;
  }
}
