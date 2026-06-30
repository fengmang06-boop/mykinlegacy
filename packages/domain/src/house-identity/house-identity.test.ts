import { describe, expect, it } from "vitest";

import {
  addBehavioralMemory,
  addExplicitMemory,
  buildHouseDNA,
  buildHouseDNAFromInterviewAnswers,
  createEmptyIdentityMemory,
  createInitialIdentityVersion,
  diffHouseDNAFields,
  normalizeHouseIdentityText,
  resolveMemoryConflict
} from "./index";
import type { InterviewAnswer } from "./types";

describe("House Identity domain core", () => {
  it("uses surname fallback for house_name", () => {
    const houseDna = buildHouseDNA({ surname: "Ashford" });

    expect(houseDna.house_name).toBe("House of Ashford");
  });

  it("uses unknown origin fallback", () => {
    const houseDna = buildHouseDNA({ surname: "Ashford" });

    expect(houseDna.origin_country).toBe("unknown");
  });

  it("forces no image text strategy and private privacy defaults", () => {
    const houseDna = buildHouseDNA({
      surname: "Ashford",
      generation_preferences: {
        text_strategy: {
          include_text_in_image: false,
          render_text_server_side: true,
          text_fields: ["house_name"],
          text_render_targets: []
        }
      },
      privacy_preferences: {
        private_by_default: true
      }
    });

    expect(houseDna.generation_preferences.text_strategy.include_text_in_image).toBe(false);
    expect(houseDna.generation_preferences.text_strategy.render_text_server_side).toBe(true);
    expect(houseDna.privacy_preferences.private_by_default).toBe(true);
  });

  it("normalizes simple heritage text without AI", () => {
    const result = normalizeHouseIdentityText(
      "Germany, maybe Irish too, black and gold, strong family, lion, no birds"
    ).normalized_input;

    expect(result.normalized_house_dna.origin_country).toBe("Germany");
    expect(result.normalized_house_dna.heritage_regions).toContain("Ireland");
    expect(result.normalized_house_dna.colors?.primary).toEqual(["black", "gold"]);
    expect(result.normalized_house_dna.family_values).toEqual(["strength"]);
    expect(result.normalized_house_dna.guardian_animals).toEqual(["lion"]);
    expect(result.normalized_house_dna.forbidden_elements).toContain("birds");
    expect(result.user_confirm_required_fields).toContain("heritage_regions");
  });

  it("builds HouseDNA from interview answers", () => {
    const answer: InterviewAnswer = {
      contract_version: "1.1",
      schema_version: "interview_answer.v1",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      source: "test",
      step_code: "surname",
      raw_answer: "Ashford",
      maps_to_house_dna: ["surname"]
    };

    const houseDna = buildHouseDNAFromInterviewAnswers([answer], {
      timestamp: new Date(0)
    });

    expect(houseDna.surname).toBe("Ashford");
    expect(houseDna.house_name).toBe("House of Ashford");
  });

  it("creates initial identity version v1", () => {
    const houseDna = buildHouseDNA({ surname: "Ashford" });
    const version = createInitialIdentityVersion("house_1", "identity_1", houseDna);

    expect(version.identity_version).toBe(1);
    expect(version.version_reason).toBe("initial_create");
    expect(version.active_version).toBe(true);
  });

  it("diffs motto, colors, and symbols changes", () => {
    const before = buildHouseDNA({
      surname: "Ashford",
      motto: "Hold Fast",
      colors: { primary: ["black"] },
      symbols: ["oak"]
    });
    const after = buildHouseDNA({
      surname: "Ashford",
      motto: "Rise Together",
      colors: { primary: ["gold"] },
      symbols: ["lion"]
    });

    const fields = diffHouseDNAFields(before, after).map((change) => change.field);

    expect(fields).toEqual(expect.arrayContaining(["motto", "colors", "symbols"]));
  });

  it("resolves memory conflict with explicit memory winning", () => {
    const memory = addExplicitMemory(
      addBehavioralMemory(createEmptyIdentityMemory("house_1", null), {
        memory_type: "preferred_style",
        value: "gothic",
        source_event: "style_clicked"
      }),
      {
        memory_type: "preferred_style",
        value: "classic_heritage",
        source_event: "user_selected_style"
      }
    );

    expect(resolveMemoryConflict(memory, "preferred_style")?.value).toBe("classic_heritage");
  });
});
