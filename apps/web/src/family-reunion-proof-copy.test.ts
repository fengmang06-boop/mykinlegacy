import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Family Reunion example disclosure", () => {
  it("uses factual design-study wording without changing the examples destination", async () => {
    const source = await readFile(join(__dirname, "app/gifts/[slug]/page.tsx"), "utf8");

    expect(source).toContain('const isFamilyReunion = page.slug === "family-reunion"');
    expect(source).toContain('href={isChristmas ? "/real-examples/05-christmas-family" : "/real-examples"}');
    expect(source).toContain("View Example Designs");
    expect(source).toContain("Example design studies");
    expect(source).toContain("These examples are fictional design studies.");
  });
});
