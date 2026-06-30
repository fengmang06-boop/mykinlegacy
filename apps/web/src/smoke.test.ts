import { describe, expect, it } from "vitest";

import { appName } from "./index";

describe("web scaffold", () => {
  it("exports the app name", () => {
    expect(appName).toBe("MyKinLegacy Web");
  });
});
