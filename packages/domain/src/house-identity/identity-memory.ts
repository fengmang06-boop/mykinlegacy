import { createContractMetadata } from "./defaults";
import type { IdentityMemory, IdentityMemoryItem, MemoryLayer } from "./types";

export interface AddMemoryInput {
  memory_type: string;
  value: unknown;
  source_event: string;
  confidence?: number;
  weight?: number;
  affects_prompt?: boolean;
  affects_recommendation?: boolean;
  user_visible?: boolean;
  user_editable?: boolean;
  timestamp?: Date;
}

export function createEmptyIdentityMemory(
  houseId: string,
  identityVersionId: string | null,
  source = "identity_memory_logic",
  timestamp = new Date()
): IdentityMemory {
  return {
    ...createContractMetadata(source, timestamp),
    house_id: houseId,
    identity_version_id: identityVersionId,
    explicit_memory: [],
    behavioral_memory: [],
    system_memory: []
  };
}

export function addExplicitMemory(memory: IdentityMemory, input: AddMemoryInput): IdentityMemory {
  return addMemoryItem(memory, "explicit_memory", {
    confidence: 1,
    weight: 1,
    affects_prompt: true,
    affects_recommendation: true,
    user_visible: true,
    user_editable: true,
    ...input
  });
}

export function addBehavioralMemory(memory: IdentityMemory, input: AddMemoryInput): IdentityMemory {
  return addMemoryItem(memory, "behavioral_memory", {
    confidence: input.confidence ?? 0.6,
    weight: input.weight ?? 0.4,
    affects_prompt: input.affects_prompt ?? false,
    affects_recommendation: input.affects_recommendation ?? true,
    user_visible: input.user_visible ?? false,
    user_editable: input.user_editable ?? false,
    ...input
  });
}

export function addSystemMemory(memory: IdentityMemory, input: AddMemoryInput): IdentityMemory {
  return addMemoryItem(memory, "system_memory", {
    confidence: input.confidence ?? 0.8,
    weight: input.weight ?? 0.5,
    affects_prompt: input.affects_prompt ?? false,
    affects_recommendation: input.affects_recommendation ?? false,
    user_visible: input.user_visible ?? false,
    user_editable: input.user_editable ?? false,
    ...input
  });
}

export function resolveMemoryConflict(
  memory: IdentityMemory,
  memoryType: string
): IdentityMemoryItem | undefined {
  const explicit = findLastByType(memory.explicit_memory, memoryType);
  if (explicit) {
    return explicit;
  }

  const behavioral = findLastByType(memory.behavioral_memory, memoryType);
  if (behavioral) {
    return behavioral;
  }

  return findLastByType(memory.system_memory, memoryType);
}

function addMemoryItem(
  memory: IdentityMemory,
  layer: MemoryLayer,
  input: Required<Omit<AddMemoryInput, "timestamp">> & Pick<AddMemoryInput, "timestamp">
): IdentityMemory {
  const timestamp = (input.timestamp ?? new Date()).toISOString();
  const item: IdentityMemoryItem = {
    memory_type: input.memory_type,
    value: input.value,
    source_event: input.source_event,
    confidence: input.confidence,
    weight: input.weight,
    created_at: timestamp,
    last_used_at: null,
    affects_prompt: input.affects_prompt,
    affects_recommendation: input.affects_recommendation,
    user_visible: input.user_visible,
    user_editable: input.user_editable
  };

  return {
    ...memory,
    updated_at: timestamp,
    [layer]: [...memory[layer], item]
  };
}

function findLastByType(items: IdentityMemoryItem[], memoryType: string): IdentityMemoryItem | undefined {
  return [...items].reverse().find((item) => item.memory_type === memoryType);
}
