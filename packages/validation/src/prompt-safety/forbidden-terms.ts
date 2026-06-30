import type { ForbiddenTermMatch, PromptSafetyRules } from "./types";

const NEGATION_PATTERNS = [
  /\bnot\s+(an?\s+)?official\b/i,
  /\bnot\s+legally\s+granted\b/i,
  /\bnot\s+historically\s+certified\b/i,
  /\bnot\s+official,\s+legally\s+granted,\s+or\s+historically\s+certified\b/i,
  /\bdoes\s+not\s+claim\b/i,
  /\bdo\s+not\s+claim\b/i
];

export function detectForbiddenTerms(
  text: string,
  safetyRules: PromptSafetyRules,
  location = "text"
): ForbiddenTermMatch[] {
  return safetyRules.forbidden_terms.flatMap((term) => findTermMatches(text, term, location));
}

function findTermMatches(text: string, term: string, location: string): ForbiddenTermMatch[] {
  const matches: ForbiddenTermMatch[] = [];
  const normalizedTerm = escapeRegExp(term);
  const expression = new RegExp(`\\b${normalizedTerm}\\b`, "gi");
  let match: RegExpExecArray | null;

  while ((match = expression.exec(text)) !== null) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(text.length, match.index + term.length + 80);
    const context = text.slice(start, end);
    const allowedInDisclaimer = isAllowedDisclaimerNegation(context);
    const isPositiveClaim = !allowedInDisclaimer;

    matches.push({
      term,
      match_context: context,
      severity: isPositiveClaim ? "hard_failure" : "soft_warning",
      allowed_in_disclaimer: allowedInDisclaimer,
      is_positive_claim: isPositiveClaim,
      location
    });
  }

  return matches;
}

export function isAllowedDisclaimerNegation(context: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(context));
}

export function hasPositiveForbiddenClaim(text: string, safetyRules: PromptSafetyRules): boolean {
  return detectForbiddenTerms(text, safetyRules).some((match) => match.is_positive_claim);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
