import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";

describe("api scaffold", () => {
  it("exports the Nest app module", () => {
    expect(AppModule).toBeDefined();
  });
});
