export const etsySafetyRules = [
  "MENSSKULL Growth Constitution V1.0 is the highest Growth rule",
  "default Etsy mode is read-only",
  "manual approval required for any future Etsy write",
  "evidence required for every title, tag, image, or price recommendation",
  "risk assessment required for every recommendation",
  "expected benefit required for every recommendation",
  "rollback plan required for every recommendation",
  "version history required for every important optimization",
  "never auto publish",
  "never apply API write without approval",
  "never invent material",
  "never invent size",
  "never invent finish",
  "never make medical/healing/religious/energy claims",
  "never keyword stuff",
  "every change needs before/after snapshot",
  "every API write must be logged",
  "rollback required before future live API"
] as const;

const prohibitedClaimPattern =
  /\b(heal|healing|cure|medical|energy|spiritual power|religious power|protects|protection|lucky charm|luck|chakra|anxiety|therapy)\b/i;

export function findSafetyIssues(text: string): string[] {
  const issues: string[] = [];

  if (prohibitedClaimPattern.test(text)) {
    issues.push("Contains prohibited medical, healing, religious, energy, luck, or protection-style claim language.");
  }

  const repeatedWords = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4)
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] ?? 0) + 1;
      return acc;
    }, {});

  const stuffed = Object.entries(repeatedWords).filter(([, count]) => count >= 8);
  if (stuffed.length > 0) {
    issues.push(`Possible keyword stuffing: ${stuffed.map(([word]) => word).join(", ")}.`);
  }

  return issues;
}

export function assertMvpApiWriteDisabled(): never {
  throw new Error("Etsy API integration not enabled in MVP");
}
