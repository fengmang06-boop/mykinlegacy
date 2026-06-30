import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

interface IntegrationGap {
  gap_name: string;
  blocked_flow: string;
  missing_module: string;
  expected_behavior: string;
  current_behavior: string;
  severity: "low" | "medium" | "high" | "critical";
  recommended_fix: string;
  milestone_to_fix: string;
  status: "closed" | "remaining";
  reason: string;
}

describe("Integration Gap Report", () => {
  it("documents known MVP-to-staging orchestration gaps", async () => {
    const gaps = JSON.parse(
      await readFile("e2e/integration-gap-report.json", "utf8")
    ) as IntegrationGap[];

    expect(gaps.length).toBeGreaterThanOrEqual(5);
    for (const gap of gaps) {
      expect(gap.gap_name).toBeTruthy();
      expect(gap.blocked_flow).toBeTruthy();
      expect(gap.missing_module).toBeTruthy();
      expect(gap.expected_behavior).toBeTruthy();
      expect(gap.current_behavior).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(gap.severity);
      expect(gap.recommended_fix).toBeTruthy();
      expect(gap.milestone_to_fix).toContain("Milestone");
      expect(["closed", "remaining"]).toContain(gap.status);
      expect(gap.reason).toBeTruthy();
    }
    expect(gaps.filter((gap) => gap.status === "closed")).toHaveLength(4);
  });
});
