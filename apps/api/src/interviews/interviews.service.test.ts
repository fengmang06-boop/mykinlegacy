import { describe, expect, it } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { InterviewsService } from "./interviews.service";

describe("InterviewsService", () => {
  it("creates an interview", async () => {
    const service = new InterviewsService(createPrismaServiceMock());
    const result = await service.createInterview({ data: { locale: "en-US", source: "web" } });

    expect(result.interview_id).toHaveLength(26);
    expect(result.current_step).toBe("name_your_house");
  });

  it("gets interview state", async () => {
    const service = new InterviewsService(createPrismaServiceMock());
    const result = await service.getInterview("01H00000000000000000000000");

    expect(result.status).toBe("in_progress");
    expect(result.answers_completed).toBe(0);
  });

  it("submits answer and advances step", async () => {
    const service = new InterviewsService(createPrismaServiceMock());
    const result = await service.submitAnswer("01H00000000000000000000000", {
      data: {
        step_code: "choose_guardian_symbol",
        raw_answer: {
          selected_options: ["lion"],
          free_text: "No birds. Strong but elegant."
        }
      }
    });

    expect(result.next_step).toBe("surname_and_origin");
    expect(result.normalized_output.guardian_animals).toEqual(["lion"]);
  });

  it("normalizes Germany / Irish / black gold / lion / no birds", async () => {
    const service = new InterviewsService(createPrismaServiceMock());
    const result = await service.normalizeInput("01H00000000000000000000000", {
      data: {
        raw_input: "Germany, maybe Irish too, black and gold, strong family, lion, no birds"
      }
    });

    expect(result.normalized_house_dna.origin_country).toBe("Germany");
    expect(result.normalized_house_dna.heritage_regions).toContain("Ireland");
    expect(result.normalized_house_dna.colors?.primary).toEqual(["black", "gold"]);
    expect(result.normalized_house_dna.guardian_animals).toEqual(["lion"]);
    expect(result.normalized_house_dna.forbidden_elements).toContain("birds");
  });

  it("confirms HouseDNA and creates identity version", async () => {
    const service = new InterviewsService(createPrismaServiceMock());
    const result = await service.confirm("01H00000000000000000000000", {
      data: {
        house_dna: {
          surname: "Ashford",
          house_name: "House of Ashford",
          family_values: ["unity"],
          colors: { primary: ["gold"] }
        }
      }
    });

    expect(result.house_id).toHaveLength(26);
    expect(result.identity_version_id).toHaveLength(26);
    expect(result.identity_version).toBe(1);
  });
});

function createPrismaServiceMock(): PrismaService {
  const interview = {
    id: "01H00000000000000000000000",
    houseId: null,
    status: "in_progress",
    currentStep: "name_your_house",
    locale: "en-US",
    expiresAt: new Date(Date.now() + 60_000),
    answersJson: [],
    houseDnaDraftJson: null,
    normalizedInputJson: null
  };
  const transactionClient = {
    house: { create: async () => ({ id: "01H00000000000000000000001" }) },
    houseIdentity: {
      create: async () => ({ id: "01H00000000000000000000002" }),
      update: async () => ({})
    },
    houseIdentityVersion: {
      updateMany: async () => ({}),
      create: async () => ({
        id: "01H00000000000000000000003",
        identityVersion: 1,
        activeVersion: true
      })
    },
    houseInterview: {
      update: async () => interview
    }
  };

  return {
    db: {
      houseInterview: {
        create: async (args: { data: typeof interview }) => ({ ...args.data }),
        findUnique: async () => interview,
        update: async () => interview
      },
      $transaction: async <T>(handler: (client: typeof transactionClient) => Promise<T>) =>
        handler(transactionClient)
    }
  } as unknown as PrismaService;
}
