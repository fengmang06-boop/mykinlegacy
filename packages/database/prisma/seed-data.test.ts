import { describe, expect, it } from "vitest";

import {
  adminPermissionSeeds,
  adminRoleSeeds,
  aiProviderSeed,
  deliverableTypeSeeds,
  emailTemplateSeed,
  packageDeliverableSeeds,
  packageSeed,
  productPromptBindingSeeds,
  productSeed,
  promptTemplateSeeds
} from "./seed-data";

describe("baseline seed definitions", () => {
  it("defines the product and premium package", () => {
    expect(productSeed.code).toBe("family_legacy_collection");
    expect(packageSeed.code).toBe("premium");
    expect(packageSeed.priceCents).toBe(4900n);
  });

  it("defines required deliverables and templates", () => {
    expect(deliverableTypeSeeds).toHaveLength(6);
    expect(packageDeliverableSeeds).toHaveLength(7);
    expect(packageDeliverableSeeds.map((deliverable) => deliverable.deliverableCode)).not.toContain(
      "transparent_crest_png"
    );
    expect(packageDeliverableSeeds.every((deliverable) => deliverable.required)).toBe(true);
    expect(promptTemplateSeeds).toHaveLength(4);
    expect(productPromptBindingSeeds).toHaveLength(4);
  });

  it("defines delivery email, RBAC seeds, and disabled AI placeholder", () => {
    expect(emailTemplateSeed.code).toBe("delivery_ready");
    expect(adminRoleSeeds.map((role) => role.code)).toEqual([
      "super_admin",
      "admin",
      "support",
      "finance",
      "viewer"
    ]);
    expect(adminPermissionSeeds).toHaveLength(20);
    expect(aiProviderSeed.code).toBe("openai");
    expect(aiProviderSeed.status).toBe("disabled");
  });
});
