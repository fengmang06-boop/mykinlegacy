import { randomUlidLike } from "./ulid";
import type {
  AiGenerationRunCreateInput,
  AiGenerationRunRecord,
  AiGenerationRunRepository
} from "./types";

interface PrismaRunClient {
  aiGenerationRun: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export class InMemoryAiGenerationRunRepository implements AiGenerationRunRepository {
  public readonly runs: AiGenerationRunRecord[] = [];

  async createRun(input: AiGenerationRunCreateInput): Promise<AiGenerationRunRecord> {
    const run: AiGenerationRunRecord = {
      ...input,
      id: randomUlidLike(),
      created_at: input.created_at ?? new Date()
    };
    this.runs.push(run);
    return run;
  }
}

export class PrismaAiGenerationRunRepository implements AiGenerationRunRepository {
  constructor(private readonly prisma: PrismaRunClient) {}

  async createRun(input: AiGenerationRunCreateInput): Promise<AiGenerationRunRecord> {
    const record = await this.prisma.aiGenerationRun.create({
      data: {
        id: randomUlidLike(),
        generationJobId: input.generation_job_id,
        generationStepId: input.generation_step_id,
        aiProviderId: input.ai_provider_id,
        aiModelId: input.ai_model_id,
        promptTemplateVersionId: input.prompt_template_version_id,
        renderedPrompt: input.rendered_prompt,
        negativePrompt: input.negative_prompt,
        inputPayloadJson: input.input_payload_json,
        outputPayloadJson: input.output_payload_json ?? undefined,
        status: input.status,
        providerRequestId: input.provider_request_id,
        costCentsEstimated:
          input.cost_cents_estimated === null || input.cost_cents_estimated === undefined
            ? undefined
            : BigInt(input.cost_cents_estimated),
        latencyMs: input.latency_ms,
        errorCode: input.error_code,
        errorMessage: input.error_message,
        createdAt: input.created_at ?? new Date(),
        completedAt: input.completed_at
      }
    });

    return mapRunRecord(record, input);
  }
}

function mapRunRecord(record: unknown, fallback: AiGenerationRunCreateInput): AiGenerationRunRecord {
  if (!record || typeof record !== "object") {
    return {
      ...fallback,
      id: randomUlidLike(),
      created_at: fallback.created_at ?? new Date()
    };
  }

  const value = record as Record<string, unknown>;

  return {
    ...fallback,
    id: String(value.id),
    created_at: value.createdAt instanceof Date ? value.createdAt : fallback.created_at ?? new Date()
  };
}
