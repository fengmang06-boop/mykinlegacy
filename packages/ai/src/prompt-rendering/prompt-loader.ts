import type { ActivePromptBindingRecord, PromptRepository, PromptTemplateVersionRecord } from "./types";

export class PromptTemplateMissingError extends Error {
  constructor(message = "prompt_template_missing") {
    super(message);
    this.name = "PromptTemplateMissingError";
  }
}

export async function loadPromptTemplate(input: {
  repository: PromptRepository;
  product_code: string;
  package_code: string;
  deliverable_code: string;
}): Promise<ActivePromptBindingRecord> {
  const binding = await input.repository.getActivePromptBinding({
    product_code: input.product_code,
    package_code: input.package_code,
    deliverable_code: input.deliverable_code
  });

  if (!binding) {
    throw new PromptTemplateMissingError();
  }

  return binding;
}

export async function getPromptTemplateVersion(input: {
  repository: PromptRepository;
  prompt_template_version_id: string;
}): Promise<PromptTemplateVersionRecord> {
  const version = await input.repository.getPromptTemplateVersion(input.prompt_template_version_id);

  if (!version) {
    throw new PromptTemplateMissingError();
  }

  return version;
}

export async function listPromptTemplatesForProduct(input: {
  repository: PromptRepository;
  product_code: string;
}): Promise<ActivePromptBindingRecord[]> {
  return input.repository.listPromptTemplatesForProduct(input.product_code);
}
