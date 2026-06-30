const OFFICIAL_PATTERN = /\bofficial coat of arms|legally granted|certified heraldry|authentic ancestral crest\b/i;
const PROTECTED_PATTERN = /\bcopyrighted logo|royal emblem|official emblem|trademarked logo\b/i;

export function getSafetyMessage(value: string): string | null {
  if (OFFICIAL_PATTERN.test(value)) {
    return "We can create a personalized symbolic heritage-inspired design, not an official coat of arms.";
  }
  if (PROTECTED_PATTERN.test(value)) {
    return "We can't copy protected logos or official emblems, but we can create a symbolic alternative.";
  }
  return null;
}
