import { describe, expect, it } from "vitest";

import { validateConsentRecord, validateHouseDNA } from "./index";

describe("House Identity validation", () => {
  it("validates HouseDNA successfully", () => {
    const houseDna = createValidHouseDna();

    expect(validateHouseDNA(houseDna).valid).toBe(true);
  });

  it("blocks include_text_in_image true", () => {
    const houseDna = {
      ...createValidHouseDna(),
      generation_preferences: {
        text_strategy: {
          include_text_in_image: true,
          render_text_server_side: true,
          text_fields: ["house_name", "motto"],
          text_render_targets: ["certificate_pdf"]
        }
      }
    };

    expect(validateHouseDNA(houseDna).valid).toBe(false);
  });

  it("fails consent validation when heritage disclaimer is missing", () => {
    const result = validateConsentRecord({
      terms_accepted: true,
      privacy_policy_accepted: true,
      heritage_disclaimer_accepted: false,
      ai_generation_consent: true,
      email_delivery_consent: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("heritage_disclaimer_accepted");
  });
});

function createValidHouseDna() {
  return {
    contract_version: "1.1",
    surname: "Ashford",
    house_name: "House of Ashford",
    family_values: ["unity"],
    colors: { primary: ["gold"] },
    visual_style: "classic_heritage",
    locale: "en-US",
    output_language: "en",
    generation_preferences: {
      text_strategy: {
        include_text_in_image: false,
        render_text_server_side: true
      }
    },
    privacy_preferences: {
      private_by_default: true
    }
  };
}
