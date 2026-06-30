import { describe, expect, it } from "vitest";

import { PromptTemplateMissingError, renderPrompt } from "./index";
import type {
  ActivePromptBindingRecord,
  PromptHouseDNA,
  PromptRepository,
  PromptTemplateVersionRecord
} from "./types";

const GLOBAL_HERITAGE_DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

describe("prompt rendering", () => {
  const scenarios = [
    ["Gothic + lion + black/gold", dna({ style: "gothic", animals: ["lion"], colors: ["black", "gold"] })],
    ["Celtic + stag + green/gold", dna({ style: "celtic", animals: ["stag"], colors: ["green", "gold"] })],
    ["Wedding + floral + monogram", dna({ style: "wedding", symbols: ["floral", "monogram"], colors: ["blush", "gold"] })],
    ["Viking + wolf + navy/silver", dna({ style: "viking", animals: ["wolf"], colors: ["navy", "silver"] })],
    ["Modern minimal + oak tree", dna({ style: "modern minimal", symbols: ["oak tree"], colors: ["charcoal", "ivory"] })],
    ["Mixed origin: German + maybe Irish", dna({ origin: "Germany, maybe Irish", animals: ["eagle"], colors: ["blue", "gold"] })],
    ["Unknown origin", dna({ origin: "unknown", animals: ["lion"], colors: ["black", "gold"] })],
    ["User forbids birds", dna({ animals: ["lion"], forbidden: ["birds"] })],
    ["User requests official coat of arms", dna({ preferred: ["official coat of arms"] })],
    ["User requests copyrighted logo or royal emblem", dna({ preferred: ["copyrighted logo", "royal emblem"] })]
  ] as const;

  it.each(scenarios)("renders image prompt safely for %s", async (_name, houseDna) => {
    const repository = new MockPromptRepository();
    const result = await renderPrompt({
      repository,
      context: baseContext(houseDna, "crest_variant_1_png")
    });

    expect(result.rendered_prompt?.prompt_template_version_id).toBe("ptv_image");
    expect(result.rendered_prompt?.rendered_prompt).not.toMatch(/write the motto|render the motto/i);
    expect(result.rendered_prompt?.negative_prompt).toContain("no readable text");
    expect(result.rendered_prompt?.negative_prompt).toContain("no letters");
    expect(result.rendered_prompt?.negative_prompt).toContain("no words");
    expect(result.rendered_prompt?.metadata).not.toHaveProperty("house_dna");
  });

  it("hard fails when HouseDNA include_text_in_image is true", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(
        dna({
          includeTextInImage: true
        }),
        "crest_variant_1_png"
      )
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.hard_failures.join(" ")).toContain("include_text_in_image");
  });

  it("injects full disclaimer into story prompt", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna(), "family_story_pdf")
    });

    expect(result.rendered_prompt?.rendered_prompt).toContain(GLOBAL_HERITAGE_DISCLAIMER);
    expect(result.rendered_prompt?.safety_disclaimers_applied).toContain(GLOBAL_HERITAGE_DISCLAIMER);
  });

  it("injects full disclaimer into certificate prompt", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna(), "heritage_certificate_pdf")
    });

    expect(result.rendered_prompt?.rendered_prompt).toContain(GLOBAL_HERITAGE_DISCLAIMER);
  });

  it("renders symbol explanation with approved knowledge context only", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: {
        ...baseContext(dna(), "symbol_explanation_pdf"),
        knowledge_context: [
          {
            key: "lion",
            label: "Lion",
            content: "Lion means courage.",
            source_type: "internal_curated",
            confidence_level: "high",
            definition_type: "animal_symbol"
          }
        ]
      }
    });

    expect(result.rendered_prompt?.metadata.knowledge_context_count).toBe(1);
    expect(result.rendered_prompt?.rendered_prompt).toContain(GLOBAL_HERITAGE_DISCLAIMER);
  });

  it("marks official coat request unsafe", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna({ preferred: ["official coat of arms"] }), "crest_variant_1_png")
    });

    expect(result.validation.valid).toBe(false);
    expect(result.rendered_prompt?.metadata.official_request_detected).toBe(true);
  });

  it("marks copyrighted logo request unsafe", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna({ preferred: ["copyrighted logo"] }), "crest_variant_1_png")
    });

    expect(result.validation.valid).toBe(false);
    expect(result.rendered_prompt?.metadata.copyrighted_logo_request_detected).toBe(true);
  });

  it("injects user-forbidden birds into negative prompt", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna({ forbidden: ["birds"] }), "crest_variant_1_png")
    });

    expect(result.rendered_prompt?.negative_prompt).toContain("no birds");
  });

  it("uses cautious wording for unknown origin", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna({ origin: "unknown" }), "crest_variant_1_png")
    });

    expect(result.rendered_prompt?.rendered_prompt).toContain("must not be invented");
  });

  it("returns prompt_template_missing when no active binding exists", async () => {
    await expect(
      renderPrompt({
        repository: new MockPromptRepository(false),
        context: baseContext(dna(), "crest_variant_1_png")
      })
    ).rejects.toBeInstanceOf(PromptTemplateMissingError);
  });

  it("does not require a real AI provider", async () => {
    const result = await renderPrompt({
      repository: new MockPromptRepository(),
      context: baseContext(dna(), "crest_variant_1_png")
    });

    expect(result.rendered_prompt?.metadata).toMatchObject({
      binding_id: "binding_image"
    });
  });
});

class MockPromptRepository implements PromptRepository {
  constructor(private readonly hasBinding = true) {}

  async getActivePromptBinding(input: { deliverable_code: string }) {
    if (!this.hasBinding) {
      return null;
    }

    return bindingFor(input.deliverable_code);
  }

  async getPromptTemplateVersion(id: string) {
    return Object.values(versions).find((version) => version.id === id) ?? null;
  }

  async listPromptTemplatesForProduct() {
    return Object.keys(versions).map(bindingFor);
  }
}

const versions: Record<string, PromptTemplateVersionRecord> = {
  crest_variant_1_png: {
    id: "ptv_image",
    prompt_type: "image",
    template_body: [
      "Create a personalized heritage-inspired symbolic crest for {{house_name}}.",
      "Internal context only: surname {{surname}}, motto {{motto}}, origin {{heritage_country}}.",
      "Style {{style}}, symbols {{animal_symbols}}, colors {{colors}}, preferred {{preferred_elements}}.",
      "{{cautious_origin_note}}"
    ].join("\n"),
    negative_prompt: "no readable text, no letters, no words",
    variables_schema_json: {
      required: ["house_name", "surname", "heritage_country", "family_values", "animal_symbols", "colors", "style"]
    },
    params_json: {
      text_in_image_allowed: false
    }
  },
  family_story_pdf: {
    id: "ptv_story",
    prompt_type: "story",
    template_body: "Write a personalized heritage-inspired symbolic family story for {{house_name}}.",
    negative_prompt: null,
    variables_schema_json: {
      required: ["house_name", "surname", "heritage_country", "family_values"]
    },
    params_json: {}
  },
  heritage_certificate_pdf: {
    id: "ptv_certificate",
    prompt_type: "certificate",
    template_body: "Draft AI-generated heritage-inspired symbolic certificate copy for {{house_name}}.",
    negative_prompt: null,
    variables_schema_json: {
      required: ["house_name", "surname"]
    },
    params_json: {}
  },
  symbol_explanation_pdf: {
    id: "ptv_explanation",
    prompt_type: "explanation",
    template_body: "Explain symbolic personalized meanings for {{animal_symbols}} and {{colors}}.",
    negative_prompt: null,
    variables_schema_json: {
      required: ["house_name", "animal_symbols", "colors"]
    },
    params_json: {}
  }
};

function bindingFor(deliverableCode: string): ActivePromptBindingRecord {
  const version = versions[deliverableCode] ?? versions.crest_variant_1_png;

  if (!version) {
    throw new Error("missing_test_version");
  }

  return {
    id: version.prompt_type === "image" ? "binding_image" : `binding_${version.prompt_type}`,
    product_code: "family_legacy_collection",
    package_code: "standard",
    deliverable_code: deliverableCode,
    prompt_template_version: version
  };
}

function baseContext(houseDna: PromptHouseDNA, deliverableCode: string) {
  return {
    house_dna: houseDna,
    identity_version_id: "identity_version_1",
    product_code: "family_legacy_collection",
    package_code: "standard",
    deliverable_code: deliverableCode,
    locale: "en-US",
    output_language: "en",
    fallback_language: "en",
    output_requirements: {
      text_must_be_rendered_server_side: true
    }
  };
}

function dna(input: {
  style?: string;
  origin?: string;
  animals?: string[];
  symbols?: string[];
  colors?: string[];
  forbidden?: string[];
  preferred?: string[];
  includeTextInImage?: boolean;
} = {}): PromptHouseDNA {
  return {
    locale: "en-US",
    output_language: "en",
    fallback_language: "en",
    house_name: "House Alder",
    surname: "Alder",
    origin_country: input.origin ?? "Ireland",
    heritage_regions: [],
    family_values: ["courage", "loyalty"],
    guardian_animals: input.animals ?? ["lion"],
    symbols: input.symbols ?? [],
    colors: {
      primary: input.colors ?? ["black", "gold"]
    },
    motto: "Stand True",
    visual_style: input.style ?? "gothic",
    forbidden_elements: input.forbidden ?? [],
    preferred_elements: input.preferred ?? [],
    generation_preferences: {
      text_strategy: {
        include_text_in_image: input.includeTextInImage ?? false,
        render_text_server_side: true,
        text_fields: ["house_name", "motto"],
        text_render_targets: ["certificate_pdf", "poster_pdf", "social_kit", "wallpaper"]
      }
    }
  };
}
