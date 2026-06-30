import type { ActivePromptBindingRecord, PromptRepository } from "./types";

interface PrismaPromptClient {
  productPromptBinding: {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
  };
  promptTemplateVersion: {
    findUnique(args: unknown): Promise<unknown>;
  };
}

export class PrismaPromptRepository implements PromptRepository {
  constructor(private readonly prisma: PrismaPromptClient) {}

  async getActivePromptBinding(input: {
    product_code: string;
    package_code: string;
    deliverable_code: string;
  }): Promise<ActivePromptBindingRecord | null> {
    const record = await this.prisma.productPromptBinding.findFirst({
      where: {
        status: "active",
        product: { code: input.product_code },
        package: { code: input.package_code },
        deliverableType: { code: mapDeliverableCodeToTypeCode(input.deliverable_code) }
      },
      orderBy: { priority: "asc" },
      include: {
        product: true,
        package: true,
        deliverableType: true,
        promptTemplateVersion: {
          include: {
            promptTemplate: true
          }
        }
      }
    });

    return mapPromptBinding(record);
  }

  async getPromptTemplateVersion(id: string) {
    const record = await this.prisma.promptTemplateVersion.findUnique({
      where: { id },
      include: {
        promptTemplate: true
      }
    });

    const binding = mapPromptVersion(record);
    return binding;
  }

  async listPromptTemplatesForProduct(productCode: string): Promise<ActivePromptBindingRecord[]> {
    const records = await this.prisma.productPromptBinding.findMany({
      where: {
        product: { code: productCode }
      },
      include: {
        product: true,
        package: true,
        deliverableType: true,
        promptTemplateVersion: {
          include: {
            promptTemplate: true
          }
        }
      }
    });

    return records.map(mapPromptBinding).filter((record): record is ActivePromptBindingRecord => Boolean(record));
  }
}

export function mapDeliverableCodeToTypeCode(deliverableCode: string): string {
  if (deliverableCode.startsWith("crest_variant_")) {
    return "crest_variant_png";
  }

  if (deliverableCode === "transparent_crest_png") {
    return "transparent_crest_png";
  }

  return deliverableCode;
}

function mapPromptBinding(record: unknown): ActivePromptBindingRecord | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = record as Record<string, unknown>;
  const version = mapPromptVersion(value.promptTemplateVersion);

  if (!version) {
    return null;
  }

  return {
    id: String(value.id),
    product_code: getNestedCode(value.product),
    package_code: value.package ? getNestedCode(value.package) : null,
    deliverable_code: value.deliverableType ? getNestedCode(value.deliverableType) : null,
    prompt_template_version: version
  };
}

function mapPromptVersion(record: unknown) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = record as Record<string, unknown>;
  const template = value.promptTemplate as Record<string, unknown> | undefined;

  return {
    id: String(value.id),
    prompt_type: String(template?.promptType ?? "image") as never,
    template_body: String(value.templateBody ?? ""),
    negative_prompt: typeof value.negativePrompt === "string" ? value.negativePrompt : null,
    variables_schema_json: isObject(value.variablesSchemaJson)
      ? (value.variablesSchemaJson as { required?: string[]; optional?: string[] })
      : null,
    params_json: isObject(value.paramsJson) ? (value.paramsJson as Record<string, unknown>) : null
  };
}

function getNestedCode(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  return String((value as Record<string, unknown>).code ?? "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
