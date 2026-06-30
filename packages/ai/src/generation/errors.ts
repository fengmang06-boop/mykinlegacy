import type { AiErrorCode, AiGenerationErrorDetails } from "./types";

export class AiGenerationError extends Error {
  public readonly details: AiGenerationErrorDetails;

  constructor(details: AiGenerationErrorDetails) {
    super(details.message);
    this.name = "AiGenerationError";
    this.details = sanitizeErrorDetails(details);
  }
}

export function createAiGenerationError(input: {
  error_code: AiErrorCode;
  message: string;
  retryable: boolean;
  severity?: "warning" | "error" | "critical";
  debug_context?: Record<string, unknown>;
}): AiGenerationError {
  return new AiGenerationError({
    error_code: input.error_code,
    message: input.message,
    retryable: input.retryable,
    severity: input.severity ?? "error",
    debug_context: input.debug_context ?? {}
  });
}

export function normalizeAiProviderError(error: unknown): AiGenerationError {
  if (error instanceof AiGenerationError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "AI provider error";
  const code = /timeout/i.test(message) ? "ai_provider_timeout" : "ai_provider_error";

  return createAiGenerationError({
    error_code: code,
    message,
    retryable: true,
    debug_context: {
      normalized_from: error instanceof Error ? error.name : typeof error
    }
  });
}

export function sanitizeErrorDetails(details: AiGenerationErrorDetails): AiGenerationErrorDetails {
  return {
    ...details,
    debug_context: sanitizeObject(details.debug_context)
  };
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("api_key") || normalizedKey.includes("secret") || normalizedKey.includes("prompt")) {
        return false;
      }

      return typeof entry !== "string" || !entry.startsWith("sk-");
    })
  );
}
