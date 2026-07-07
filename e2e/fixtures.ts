import type {
  AiImageGenerationJobInput,
  AiTextGenerationJobInput
} from "../packages/ai/src/generation/types";

export const E2E_NOW = new Date("2026-06-29T00:00:00.000Z");

export const sampleHouseDna = {
  contract_version: "1.1",
  schema_version: "house_dna.v1",
  created_at: E2E_NOW.toISOString(),
  updated_at: E2E_NOW.toISOString(),
  source: "e2e_fixture",
  locale: "en-US",
  output_language: "en",
  fallback_language: "en",
  house_name: "House Alder",
  surname: "Alder",
  origin_country: "Ireland",
  heritage_regions: [],
  family_values: ["courage", "loyalty"],
  guardian_animals: ["lion"],
  symbols: ["oak tree"],
  colors: { primary: ["black", "gold"] },
  motto: "Stand True",
  visual_style: "gothic",
  forbidden_elements: [],
  preferred_elements: [],
  privacy_preferences: {
    public_showcase: false,
    external_model_training: false
  },
  generation_preferences: {
    text_strategy: {
      include_text_in_image: false,
      render_text_server_side: true,
      text_fields: ["house_name", "motto"],
      text_render_targets: ["certificate_pdf", "poster_pdf", "social_kit", "wallpaper"]
    }
  }
};

export const sampleInterviewAnswers = [
  { step_code: "name_your_house", raw_answer: "House Alder" },
  { step_code: "where_story_begins", raw_answer: "Ireland" },
  { step_code: "define_house_values", raw_answer: "Courage and loyalty" },
  { step_code: "choose_guardian_symbol", raw_answer: "Lion" },
  { step_code: "select_colors_and_visual_style", raw_answer: "Black and gold gothic" },
  { step_code: "create_or_refine_motto", raw_answer: "Stand True" }
];

export const sampleOrder = {
  order_id: "01H00000000000000000000001",
  order_item_id: "01H00000000000000000000002",
  order_number: "AHL-20260629-E2E",
  product_code: "family_legacy_collection",
  package_code: "premium",
  total_cents: 4900,
  currency: "USD",
  customer_email: "customer@example.test"
};

export const sampleConsent = {
  terms_accepted: true,
  privacy_policy_accepted: true,
  heritage_disclaimer_accepted: true,
  ai_generation_consent: true,
  email_delivery_consent: true,
  marketing_opt_in: false,
  gallery_opt_in: false,
  consent_version: "2026-06-29"
};

export const sampleStripeEvent = {
  id: "evt_e2e_checkout",
  type: "checkout.session.completed",
  amount_total: 4900,
  currency: "usd",
  order_number: sampleOrder.order_number
};

export const sampleAdminUser = {
  id: "admin_e2e",
  email: "admin@example.test",
  password: "correct horse battery staple",
  roles: ["super_admin" as const],
  permissions: ["view_private_family_data"]
};

export const sampleEmailTemplate = {
  id: "email_template_e2e",
  code: "delivery_ready",
  locale: "en-US",
  version: 1,
  status: "active" as const,
  subject_template: "Your MyKinLegacy files are ready",
  body_template: "Your download vault is ready: {{download_vault_link}}"
};

export const expectedMvpDeliverables = [
  "crest_variant_1_png",
  "crest_variant_2_png",
  "crest_variant_3_png",
  "symbol_explanation_pdf",
  "heritage_certificate_pdf",
  "family_story_pdf",
  "download_package_zip"
];

export const sampleImageCandidate = {
  candidate_id: "image_candidate_e2e",
  candidate_type: "image",
  deliverable_code: "crest_variant_1_png",
  temporary_output_ref: "mock://image/crest_variant_1_png.png",
  validation_status: "pending_or_passed",
  ai_generation_run_id: "ai_run_e2e",
  ready_for_next_step: true
};

export const sampleTextCandidates = [
  {
    candidate_id: "text_candidate_story",
    candidate_type: "text",
    deliverable_code: "family_story_pdf",
    output_text:
      "A personalized, heritage-inspired symbolic family text for this collection.\nThis is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms."
  }
];

export function sampleImageJob(
  deliverableCode = "crest_variant_1_png",
  override: Partial<AiImageGenerationJobInput> = {}
): AiImageGenerationJobInput {
  return {
    job_id: `job_${deliverableCode}`,
    generation_job_id: "generation_job_e2e",
    generation_step_id: null,
    rendered_prompt_id: `rendered_${deliverableCode}`,
    rendered_prompt:
      "Create a personalized heritage-inspired symbolic crest. Do not render text, names, motto, letters, or words in the image.",
    negative_prompt: "no readable text, no letters, no words",
    prompt_template_version_id: "prompt_version_e2e",
    identity_version_id: "01H00000000000000000000003",
    product_code: sampleOrder.product_code,
    package_code: sampleOrder.package_code,
    deliverable_code: deliverableCode,
    provider_code: "mock",
    model_code: "mock-image-model",
    output_requirements: {
      text_must_be_rendered_server_side: true,
      format: "png"
    },
    safety_metadata: {
      origin_country: sampleHouseDna.origin_country,
      visual_style: sampleHouseDna.visual_style,
      guardian_animals: sampleHouseDna.guardian_animals,
      symbols: sampleHouseDna.symbols,
      colors: sampleHouseDna.colors.primary,
      include_text_in_image: false,
      forbidden_elements_injected: true
    },
    ai_provider_id: "mock_provider_id",
    ai_model_id: "mock_image_model_id",
    ...override
  };
}

export function sampleTextJob(
  deliverableCode = "family_story_pdf",
  override: Partial<AiTextGenerationJobInput> = {}
): AiTextGenerationJobInput {
  return {
    job_id: `job_${deliverableCode}`,
    generation_job_id: "generation_job_text_e2e",
    generation_step_id: null,
    rendered_prompt_id: `rendered_${deliverableCode}`,
    rendered_prompt:
      "Write personalized, AI-generated, heritage-inspired symbolic text with the required disclaimer.",
    prompt_template_version_id: "prompt_version_text_e2e",
    identity_version_id: "01H00000000000000000000003",
    product_code: sampleOrder.product_code,
    package_code: sampleOrder.package_code,
    deliverable_code: deliverableCode,
    provider_code: "mock",
    model_code: "mock-text-model",
    output_requirements: { format: "pdf_text" },
    safety_metadata: {
      origin_country: sampleHouseDna.origin_country,
      visual_style: sampleHouseDna.visual_style,
      guardian_animals: sampleHouseDna.guardian_animals,
      symbols: sampleHouseDna.symbols,
      colors: sampleHouseDna.colors.primary
    },
    ai_provider_id: "mock_provider_id",
    ai_model_id: "mock_text_model_id",
    ...override
  };
}
