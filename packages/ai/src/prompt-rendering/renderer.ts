import { randomUUID } from "node:crypto";

import type {
  ActivePromptBindingRecord,
  PromptRenderContext,
  PromptRenderResult,
  PromptRepository,
  PromptType,
  RenderedPrompt
} from "./types";
import { loadPromptTemplate } from "./prompt-loader";
import { findMissingRequiredVariables, renderTemplate, resolvePromptVariables } from "./variables";

interface ValidationModule {
  DEFAULT_PROMPT_SAFETY_RULES: PromptRenderContext["safety_rules"];
  GLOBAL_HERITAGE_DISCLAIMER: string;
  NO_TEXT_IMAGE_NEGATIVE_TERMS: string[];
  validateRenderedImagePrompt(input: {
    rendered_prompt: RenderedPrompt;
    house_dna: PromptRenderContext["house_dna"];
    safety_rules: PromptRenderContext["safety_rules"];
  }): PromptRenderResult["validation"];
  detectForbiddenTerms(
    text: string,
    safetyRules: PromptRenderContext["safety_rules"],
    location?: string
  ): Array<{ term: string; is_positive_claim: boolean }>;
}

const IMAGE_DELIVERABLES = new Set([
  "crest_variant_1_png",
  "crest_variant_2_png",
  "crest_variant_3_png",
  "transparent_crest_png"
]);

const TEXT_PROMPT_TYPES = new Set<PromptType>(["story", "certificate", "explanation", "readme", "email"]);

export async function renderPrompt(input: {
  repository: PromptRepository;
  context: Omit<PromptRenderContext, "prompt_template_version_id" | "safety_rules"> & {
    safety_rules?: PromptRenderContext["safety_rules"];
  };
}): Promise<PromptRenderResult> {
  const validation = requireValidation();
  const binding = await loadPromptTemplate({
    repository: input.repository,
    product_code: input.context.product_code,
    package_code: input.context.package_code,
    deliverable_code: input.context.deliverable_code
  });
  const version = binding.prompt_template_version;
  const safetyRules = input.context.safety_rules ?? validation.DEFAULT_PROMPT_SAFETY_RULES;
  const context: PromptRenderContext = {
    ...input.context,
    prompt_template_version_id: version.id,
    safety_rules: safetyRules
  };
  const variables = resolvePromptVariables(context.house_dna);
  const requiredVariables = version.variables_schema_json?.required ?? [];
  const missingRequired = findMissingRequiredVariables(requiredVariables, variables);

  if (missingRequired.length > 0) {
    return validationFailure(`Missing required prompt variables: ${missingRequired.join(", ")}`);
  }

  let renderedPrompt = renderTemplate(version.template_body, variables);
  const safetyDisclaimersApplied: string[] = [];

  if (TEXT_PROMPT_TYPES.has(version.prompt_type)) {
    renderedPrompt = injectTextDisclaimer(renderedPrompt, validation.GLOBAL_HERITAGE_DISCLAIMER);
    safetyDisclaimersApplied.push(validation.GLOBAL_HERITAGE_DISCLAIMER);
  }

  if (isImagePrompt(version.prompt_type, context.deliverable_code)) {
    renderedPrompt = enforceImagePromptInstructions(renderedPrompt);
  }

  const negativePrompt = buildNegativePrompt({
    baseNegativePrompt: version.negative_prompt,
    context,
    validation
  });
  const forbiddenTerms = validation.detectForbiddenTerms(renderedPrompt, safetyRules, "rendered_prompt");
  const positiveClaims = forbiddenTerms.filter((match) => match.is_positive_claim);
  const copyrightedRequest = containsAny(
    `${renderedPrompt} ${variables.preferred_elements}`,
    safetyRules.copyrighted_logo_terms
  );
  const officialRequest = containsAny(
    `${renderedPrompt} ${variables.preferred_elements}`,
    safetyRules.official_emblem_terms
  );
  const rendered: RenderedPrompt = {
    rendered_prompt_id: randomUUID(),
    prompt_template_version_id: version.id,
    prompt_type: version.prompt_type,
    product_code: context.product_code,
    package_code: context.package_code,
    deliverable_code: context.deliverable_code,
    rendered_prompt: renderedPrompt,
    negative_prompt: negativePrompt,
    prompt_variables_used: variables,
    forbidden_terms_applied: safetyRules.forbidden_terms,
    safety_disclaimers_applied: safetyDisclaimersApplied,
    expected_output_format: expectedOutputFormat(context.deliverable_code, version.prompt_type),
    quality_requirements: buildQualityRequirements(version.prompt_type),
    metadata: {
      locale: context.locale,
      output_language: context.output_language,
      fallback_language: context.fallback_language,
      identity_version_id: context.identity_version_id,
      binding_id: binding.id,
      knowledge_context_count: context.knowledge_context?.length ?? 0,
      text_must_be_rendered_server_side: isImagePrompt(version.prompt_type, context.deliverable_code),
      forbidden_elements_injected: context.house_dna.forbidden_elements.length > 0,
      official_request_detected: officialRequest || positiveClaims.length > 0,
      copyrighted_logo_request_detected: copyrightedRequest
    }
  };

  if (isImagePrompt(version.prompt_type, context.deliverable_code)) {
    const imageValidation = validation.validateRenderedImagePrompt({
      rendered_prompt: rendered,
      house_dna: context.house_dna,
      safety_rules: safetyRules
    });

    if (copyrightedRequest) {
      imageValidation.valid = false;
      imageValidation.hard_failures.push("User request includes copyrighted logo or trademark language.");
      imageValidation.rewrite_required = true;
      imageValidation.recommended_action = "block";
    }

    if (officialRequest || positiveClaims.length > 0) {
      imageValidation.valid = false;
      imageValidation.hard_failures.push("User request includes official coat, royal, legal, or certified heraldry language.");
      imageValidation.rewrite_required = true;
      imageValidation.recommended_action = "block";
    }

    return {
      rendered_prompt: rendered,
      validation: imageValidation
    };
  }

  if (positiveClaims.length > 0) {
    return {
      rendered_prompt: rendered,
      validation: {
        valid: false,
        hard_failures: ["Rendered prompt contains forbidden positive claim language."],
        soft_warnings: [],
        rewrite_required: true,
        recommended_action: "rewrite"
      }
    };
  }

  return {
    rendered_prompt: rendered,
    validation: {
      valid: true,
      hard_failures: [],
      soft_warnings: [],
      rewrite_required: false,
      recommended_action: "allow"
    }
  };
}

export function buildPromptRenderContext(input: {
  house_dna: PromptRenderContext["house_dna"];
  identity_version_id: string;
  product_code: string;
  package_code: string;
  deliverable_code: string;
  binding: ActivePromptBindingRecord;
  output_requirements?: Record<string, unknown>;
  knowledge_context?: PromptRenderContext["knowledge_context"];
  safety_rules?: PromptRenderContext["safety_rules"];
}): PromptRenderContext {
  const validation = requireValidation();

  return {
    house_dna: input.house_dna,
    identity_version_id: input.identity_version_id,
    product_code: input.product_code,
    package_code: input.package_code,
    deliverable_code: input.deliverable_code,
    prompt_template_version_id: input.binding.prompt_template_version.id,
    locale: input.house_dna.locale || "en-US",
    output_language: input.house_dna.output_language || "en",
    fallback_language: input.house_dna.fallback_language || "en",
    safety_rules: input.safety_rules ?? validation.DEFAULT_PROMPT_SAFETY_RULES,
    output_requirements: input.output_requirements ?? {},
    knowledge_context: input.knowledge_context
  };
}

function injectTextDisclaimer(prompt: string, disclaimer: string): string {
  if (prompt.includes(disclaimer)) {
    return prompt;
  }

  return `${prompt}\n\nRequired disclaimer to include verbatim in the output:\n${disclaimer}`;
}

function enforceImagePromptInstructions(prompt: string): string {
  if (/do not render text/i.test(prompt)) {
    return prompt;
  }

  return `${prompt}\nNo-text image rule: do not render text, names, surname, motto, initials, readable letters, words, or banner text in the image. House name and motto are internal context only and must be rendered server-side later.`;
}

function buildNegativePrompt(input: {
  baseNegativePrompt: string | null;
  context: PromptRenderContext;
  validation: ValidationModule;
}): string | null {
  const terms = [
    ...(input.baseNegativePrompt ? input.baseNegativePrompt.split(",").map((term) => term.trim()) : []),
    ...input.validation.NO_TEXT_IMAGE_NEGATIVE_TERMS,
    ...input.context.house_dna.forbidden_elements.map((element) => `no ${element}`)
  ];
  const uniqueTerms = [...new Set(terms.filter(Boolean))];

  return uniqueTerms.length > 0 ? uniqueTerms.join(", ") : null;
}

function expectedOutputFormat(deliverableCode: string, promptType: PromptType): string {
  if (IMAGE_DELIVERABLES.has(deliverableCode)) {
    return "private_png_image_prompt";
  }

  if (promptType === "email") {
    return "transactional_email_text";
  }

  return "structured_text_for_server_side_document";
}

function buildQualityRequirements(promptType: PromptType): string[] {
  if (promptType === "image") {
    return [
      "heritage-inspired symbolic design",
      "no readable text",
      "not official heraldry",
      "server-side text compositor compatible"
    ];
  }

  return [
    "include required disclaimer",
    "use symbolic and heritage-inspired language",
    "avoid official, legal, certified, or verified ancestry claims"
  ];
}

function validationFailure(message: string): PromptRenderResult {
  return {
    rendered_prompt: null,
    validation: {
      valid: false,
      hard_failures: [message],
      soft_warnings: [],
      rewrite_required: true,
      recommended_action: "block"
    }
  };
}

function isImagePrompt(promptType: PromptType, deliverableCode: string): boolean {
  return promptType === "image" || IMAGE_DELIVERABLES.has(deliverableCode);
}

function containsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();

  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function requireValidation(): ValidationModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const validation = require("@ai-heritage/validation") as Partial<ValidationModule>;
    if (Array.isArray(validation.NO_TEXT_IMAGE_NEGATIVE_TERMS)) {
      return validation as ValidationModule;
    }
  } catch {
    return requireValidationSource();
  }

  return requireValidationSource();
}

function requireValidationSource(): ValidationModule {
  return LOCAL_VALIDATION;
}

const LOCAL_DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

const LOCAL_NO_TEXT_TERMS = [
  "no readable text",
  "no letters",
  "no words",
  "no motto",
  "no surname",
  "no initials",
  "no banner text",
  "no official coat of arms",
  "no royal emblem",
  "no national emblem",
  "no company logo",
  "no copyrighted logo"
];

const LOCAL_FORBIDDEN_TERMS = [
  "official coat of arms",
  "legally granted arms",
  "authentic ancestral crest",
  "real family crest",
  "historically certified crest",
  "verified family crest",
  "royal grant",
  "granted by the crown",
  "ancient family arms",
  "your true coat of arms",
  "your ancestral arms",
  "certified heraldry",
  "official heraldic record",
  "authentic family arms",
  "genuine ancestral arms",
  "historically verified arms",
  "legally recognized crest"
];

const LOCAL_VALIDATION: ValidationModule = {
  DEFAULT_PROMPT_SAFETY_RULES: {
    forbidden_terms: LOCAL_FORBIDDEN_TERMS,
    required_disclaimer: LOCAL_DISCLAIMER,
    required_safe_language: ["personalized", "AI-generated", "heritage-inspired", "symbolic"],
    no_text_image_negative_terms: LOCAL_NO_TEXT_TERMS,
    copyrighted_logo_terms: ["copyrighted logo", "company logo", "trademark", "brand logo"],
    official_emblem_terms: ["official coat of arms", "royal emblem", "national emblem", "official seal", "granted by the crown"]
  },
  GLOBAL_HERITAGE_DISCLAIMER: LOCAL_DISCLAIMER,
  NO_TEXT_IMAGE_NEGATIVE_TERMS: LOCAL_NO_TEXT_TERMS,
  detectForbiddenTerms(text, safetyRules, location = "text") {
    return safetyRules.forbidden_terms
      .filter((term) => text.toLowerCase().includes(term.toLowerCase()))
      .map((term) => ({
        term,
        is_positive_claim: !/not\s+(an?\s+)?official|not\s+legally|not\s+historically/i.test(text),
        location
      }));
  },
  validateRenderedImagePrompt(input) {
    const hardFailures: string[] = [];
    const negativePrompt = input.rendered_prompt.negative_prompt ?? "";

    if (input.house_dna.generation_preferences.text_strategy.include_text_in_image) {
      hardFailures.push("include_text_in_image is not allowed for MVP image prompts.");
    }

    if (/\b(write|render|display|show|include|add)\s+(the\s+)?(motto|surname|house name|family name|initials|letters|words|banner text)\b/i.test(input.rendered_prompt.rendered_prompt)) {
      hardFailures.push("Image prompt appears to request visible text generation.");
    }

    for (const term of LOCAL_NO_TEXT_TERMS) {
      if (!negativePrompt.toLowerCase().includes(term)) {
        hardFailures.push(`Image negative prompt is missing no-text term: ${term}`);
      }
    }

    return {
      valid: hardFailures.length === 0,
      hard_failures: hardFailures,
      soft_warnings: [],
      rewrite_required: hardFailures.length > 0,
      recommended_action: hardFailures.length > 0 ? "block" : "allow"
    };
  }
};
