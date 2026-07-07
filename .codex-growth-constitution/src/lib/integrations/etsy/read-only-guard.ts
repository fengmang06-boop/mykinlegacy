export type EtsyRequestMode = "read_only" | "write";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const etsyGrowthSafetyDefaults = {
  readOnly: true,
  manualApprovalRequired: true,
  versionHistoryRequired: true,
  rollbackSupportRequired: true,
  evidenceRequired: true,
  riskAssessmentRequired: true
} as const;

export function isReadOnlyMode(): boolean {
  return String(process.env.ETSY_READ_ONLY_MODE ?? "true").toLowerCase() === "true";
}

export function assertEtsyReadOnlyRequest(method = "GET"): void {
  const normalized = method.toUpperCase();
  if (isReadOnlyMode() && writeMethods.has(normalized)) {
    throw new Error(`Blocked Etsy ${normalized} request because ETSY_READ_ONLY_MODE=true.`);
  }
}

export function validateEtsyReadOnlyEnv(): { ok: true } | { ok: false; errors: string[] } {
  const required = ["ETSY_CLIENT_ID", "ETSY_CLIENT_SECRET", "ETSY_ACCESS_TOKEN"];
  const errors = required.filter((key) => !process.env[key]).map((key) => `Missing ${key}. Add it to .env.local.`);

  if (!isReadOnlyMode()) {
    errors.push("ETSY_READ_ONLY_MODE must be true for v1.5 read-only sync.");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertNoEtsyWriteCapability(): void {
  if (!isReadOnlyMode()) {
    throw new Error("Etsy write mode is not supported in v1.5. Set ETSY_READ_ONLY_MODE=true.");
  }
}
