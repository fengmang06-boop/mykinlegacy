import type { PromptSafetyRules } from "./types";

export const GLOBAL_HERITAGE_DISCLAIMER =
  "This is a personalized, AI-generated, heritage-inspired symbolic design. It is not an official, legally granted, or historically certified coat of arms.";

export const FORBIDDEN_TERMS = [
  "official coat of arms",
  "legally granted arms",
  "authentic ancestral crest",
  "real family crest",
  "historically certified crest",
  "verified family crest",
  "royal grant",
  "granted by the crown",
  "ancient family arms",
  "your true coat of arms",
  "your ancestral arms",
  "certified heraldry",
  "official heraldic record",
  "authentic family arms",
  "genuine ancestral arms",
  "historically verified arms",
  "legally recognized crest"
];

export const NO_TEXT_IMAGE_NEGATIVE_TERMS = [
  "no readable text",
  "no letters",
  "no words",
  "no motto",
  "no surname",
  "no initials",
  "no banner text",
  "no official coat of arms",
  "no royal emblem",
  "no national emblem",
  "no company logo",
  "no copyrighted logo"
];

export const REQUIRED_SAFE_LANGUAGE = [
  "personalized",
  "AI-generated",
  "heritage-inspired",
  "family-inspired",
  "symbolic",
  "custom",
  "inspired by heraldic tradition",
  "designed around your surname, values, symbols, and story",
  "not official",
  "not legally granted",
  "not historically certified"
];

export const COPYRIGHTED_LOGO_TERMS = ["copyrighted logo", "company logo", "trademark", "brand logo"];

export const OFFICIAL_EMBLEM_TERMS = [
  "royal emblem",
  "national emblem",
  "official seal",
  "government seal",
  "granted by the crown"
];

export const DEFAULT_PROMPT_SAFETY_RULES: PromptSafetyRules = {
  forbidden_terms: FORBIDDEN_TERMS,
  required_disclaimer: GLOBAL_HERITAGE_DISCLAIMER,
  required_safe_language: REQUIRED_SAFE_LANGUAGE,
  no_text_image_negative_terms: NO_TEXT_IMAGE_NEGATIVE_TERMS,
  copyrighted_logo_terms: COPYRIGHTED_LOGO_TERMS,
  official_emblem_terms: OFFICIAL_EMBLEM_TERMS
};
