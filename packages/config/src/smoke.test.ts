import { describe, expect, it } from "vitest";

import { readConfig } from "./index";

describe("config package", () => {
  it("reads default config without secrets", () => {
    expect(readConfig({}).apiPort).toBe(4000);
  });
});
