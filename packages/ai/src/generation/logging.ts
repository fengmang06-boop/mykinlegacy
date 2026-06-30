export function buildAiGenerationLog(input: {
  level: "info" | "warn" | "error";
  message: string;
  job_id?: string;
  provider_code?: string;
  model_code?: string;
  deliverable_code?: string;
  error_code?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level: input.level,
    message: input.message,
    job_id: input.job_id ?? null,
    provider_code: input.provider_code ?? null,
    model_code: input.model_code ?? null,
    deliverable_code: input.deliverable_code ?? null,
    error_code: input.error_code ?? null,
    extra: sanitizeLogExtra(input.extra ?? {})
  };
}

function sanitizeLogExtra(extra: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(extra).filter(([key, value]) => {
      const normalized = key.toLowerCase();
      if (normalized.includes("prompt") || normalized.includes("api_key") || normalized.includes("secret")) {
        return false;
      }

      return typeof value !== "string" || !value.startsWith("sk-");
    })
  );
}
