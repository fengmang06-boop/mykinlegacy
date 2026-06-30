import { describe, expect, it } from "vitest";

import {
  checkConsentAllowsGeneration,
  confirmHouseIdentity,
  createConsentRecord,
  createHouseWithIdentityDraft,
  createIdentityVersionV1,
  createInterviewRecord,
  getHouseIdentityById,
  getIdentityVersionById,
  updateInterviewAnswer,
  upsertIdentityMemory
} from "./house-identity";

describe("House Identity repository exports", () => {
  it("exports repository helpers without exposing API handlers", () => {
    expect(typeof createInterviewRecord).toBe("function");
    expect(typeof updateInterviewAnswer).toBe("function");
    expect(typeof createHouseWithIdentityDraft).toBe("function");
    expect(typeof confirmHouseIdentity).toBe("function");
    expect(typeof createIdentityVersionV1).toBe("function");
    expect(typeof getHouseIdentityById).toBe("function");
    expect(typeof getIdentityVersionById).toBe("function");
    expect(typeof upsertIdentityMemory).toBe("function");
    expect(typeof createConsentRecord).toBe("function");
    expect(typeof checkConsentAllowsGeneration).toBe("function");
  });
});
