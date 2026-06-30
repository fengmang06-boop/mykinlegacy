import type { KnowledgeContextItem, KnowledgeDefinition } from "./types";

const MVP_ALLOWED_SOURCE_TYPES = new Set(["internal_curated", "admin_created", "user_provided"]);

export function validateKnowledgeSourceAllowed(definition: KnowledgeDefinition): boolean {
  if (!definition.active || definition.confidence_level === "low") {
    return false;
  }

  if (!MVP_ALLOWED_SOURCE_TYPES.has(definition.source_type)) {
    return false;
  }

  if (definition.source_type === "user_provided") {
    return true;
  }

  return definition.reviewed_by_admin;
}

export function filterPromptKnowledgeSources(definitions: KnowledgeDefinition[]): KnowledgeDefinition[] {
  return definitions
    .filter(validateKnowledgeSourceAllowed)
    .sort((left, right) => priority(right) - priority(left));
}

export function buildKnowledgeContext(definitions: KnowledgeDefinition[]): KnowledgeContextItem[] {
  return filterPromptKnowledgeSources(definitions).map((definition) => ({
    key: definition.key,
    label: definition.label,
    content:
      definition.source_type === "user_provided"
        ? `[user_provided] ${definition.content}`
        : definition.content,
    source_type: definition.source_type,
    confidence_level: definition.confidence_level,
    definition_type: definition.definition_type
  }));
}

function priority(definition: KnowledgeDefinition): number {
  if (definition.definition_type === "cultural_sensitivity_rule") {
    return 100;
  }

  if (definition.source_type === "internal_curated") {
    return 50;
  }

  if (definition.source_type === "admin_created") {
    return 40;
  }

  return 10;
}
