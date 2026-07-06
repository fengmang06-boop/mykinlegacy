import { createHash } from "node:crypto";

import type { AiImageGenerationJobInput } from "./types";

export const LRE_IMAGE_PROMPT_ORDER_ALLOWLIST_ENV = "LRE_IMAGE_PROMPT_ORDER_ALLOWLIST" as const;
export const LRE_IMAGE_PROMPT_PASS_THRESHOLD = 95;

export type LrePromptSource = "old_prompt" | "lre_prompt";

export interface LrePromptReplacementAudit {
  enabled: boolean;
  order_number: string | null;
  source_selected: LrePromptSource;
  reason: string;
  verification_score: number | null;
  pve_passed: boolean;
  old_sha256: string;
  lre_sha256: string | null;
  primary_symbol: string | null;
  secondary_symbols: string[];
  selected_dna: string[];
}

export interface LrePromptReplacementResult {
  input: AiImageGenerationJobInput;
  audit: LrePromptReplacementAudit;
}

interface RuntimeVerificationResult {
  score: number;
  passed: boolean;
  issues: string[];
}

interface RuntimeSymbolDecision {
  primarySymbol: string;
  secondarySymbols: string[];
  supportingSymbols: string[];
  selectedDna: string[];
  dominantThemes: string[];
}

const BASE_NEGATIVE_TERMS = [
  "no readable text",
  "no letters",
  "no words",
  "no motto",
  "no surname",
  "no initials",
  "no banner text",
  "flat line art",
  "children's outline drawing",
  "random geometry",
  "generic heraldic template",
  "simple vector icon",
  "official seal",
  "royal crown",
  "noble title",
  "certified genealogy",
  "watermark",
  "signature"
];

const SYMBOL_DNA: Record<string, string> = {
  tree: "Embossed Legacy Tree DNA: branching canopy, visible roots, warm gold relief, organic asymmetry",
  roots: "Rooted Continuity DNA: interwoven roots, grounded base, ancestral continuity without ancestry claims",
  shield: "Archive Shield DNA: protective frame, bevelled antique gold edge, private keepsake boundary",
  laurel: "Earned Laurel DNA: botanical support, ceremonial restraint, family unity without status claims",
  lantern: "Memory Lantern DNA: warm internal glow, remembrance light, guidance through darkness",
  compass: "Journey Compass DNA: directional star, circular medallion, migration and future path",
  mountain: "Resilience Mountain DNA: layered ridges, upward path, endurance and steadiness",
  book: "Archive Book DNA: open pages, preserved memory, family knowledge and wisdom",
  key: "Home Key DNA: guardianship form, threshold symbolism, private family access",
  path: "Legacy Path DNA: curved route, forward movement, new beginning and continuity"
};

export function applyAllowlistedLrePromptReplacement(
  input: AiImageGenerationJobInput,
  env: NodeJS.ProcessEnv = process.env
): LrePromptReplacementResult {
  const orderNumber = extractOrderNumber(input);
  const allowlist = parseOneOrderAllowlist(env[LRE_IMAGE_PROMPT_ORDER_ALLOWLIST_ENV]);
  const oldHash = sha256(input.rendered_prompt);
  const disabledAudit: LrePromptReplacementAudit = {
    enabled: false,
    order_number: orderNumber,
    source_selected: "old_prompt",
    reason: allowlist.length === 1 ? "order_not_allowlisted" : "allowlist_empty_or_not_single_order",
    verification_score: null,
    pve_passed: false,
    old_sha256: oldHash,
    lre_sha256: null,
    primary_symbol: null,
    secondary_symbols: [],
    selected_dna: []
  };

  if (!orderNumber || allowlist.length !== 1 || allowlist[0] !== orderNumber) {
    return { input, audit: disabledAudit };
  }

  const decision = buildRuntimeSymbolDecision(input);
  const lrePrompt = buildRuntimeLrePrompt(input, decision);
  const negativePrompt = mergeNegativePrompt(input.negative_prompt);
  const verification = verifyRuntimeLrePrompt({
    prompt: lrePrompt,
    negativePrompt,
    decision
  });
  const lreHash = sha256(lrePrompt);
  const commonAudit = {
    enabled: true,
    order_number: orderNumber,
    verification_score: verification.score,
    pve_passed: verification.passed,
    old_sha256: oldHash,
    lre_sha256: lreHash,
    primary_symbol: decision.primarySymbol,
    secondary_symbols: decision.secondarySymbols,
    selected_dna: decision.selectedDna
  };

  if (!verification.passed || verification.score < LRE_IMAGE_PROMPT_PASS_THRESHOLD) {
    return {
      input,
      audit: {
        ...commonAudit,
        source_selected: "old_prompt",
        reason: verification.issues.join("; ") || "pve_failed"
      }
    };
  }

  return {
    input: {
      ...input,
      rendered_prompt: lrePrompt,
      negative_prompt: negativePrompt,
      safety_metadata: {
        ...input.safety_metadata,
        lre_bridge_enabled: true,
        lre_bridge_source_selected: "lre_prompt",
        lre_bridge_verification_score: verification.score,
        lre_bridge_primary_symbol: decision.primarySymbol,
        lre_bridge_secondary_symbols: decision.secondarySymbols,
        lre_bridge_selected_dna: decision.selectedDna
      }
    },
    audit: {
      ...commonAudit,
      source_selected: "lre_prompt",
      reason: "pve_passed"
    }
  };
}

export function parseOneOrderAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractOrderNumber(input: AiImageGenerationJobInput): string | null {
  return (
    stringValue(input.safety_metadata.order_number) ??
    stringValue(input.safety_metadata.orderNumber) ??
    stringValue(input.output_requirements.order_number) ??
    stringValue(input.output_requirements.orderNumber) ??
    null
  );
}

function buildRuntimeSymbolDecision(input: AiImageGenerationJobInput): RuntimeSymbolDecision {
  const metadata = input.safety_metadata;
  const symbols = arrayOfStrings(metadata.symbols).map(normalizeSymbol).filter(Boolean);
  const values = [
    ...arrayOfStrings(metadata.family_values),
    ...arrayOfStrings(metadata.values),
    ...arrayOfStrings(metadata.themes),
    ...arrayOfStrings(metadata.dominant_themes)
  ];
  const dominantThemes = values.length > 0 ? values.slice(0, 4) : ["family continuity", "private legacy", "recognition"];
  const primarySymbol = choosePrimarySymbol(symbols, dominantThemes);
  const secondarySymbols = chooseSecondarySymbols(symbols, primarySymbol, dominantThemes);
  const supportingSymbols = chooseSupportingSymbols(primarySymbol, secondarySymbols, dominantThemes);
  const selectedDna = [primarySymbol, ...secondarySymbols, ...supportingSymbols]
    .map((symbol) => SYMBOL_DNA[symbol])
    .filter((value): value is string => Boolean(value));

  return {
    primarySymbol,
    secondarySymbols,
    supportingSymbols,
    selectedDna,
    dominantThemes
  };
}

function choosePrimarySymbol(symbols: string[], themes: string[]): string {
  const joined = `${symbols.join(" ")} ${themes.join(" ")}`.toLowerCase();
  if (/root|continuity|unity|family/.test(joined)) return "tree";
  if (/remembrance|memory|grandparent|guidance|light|loss/.test(joined)) return "lantern";
  if (/migration|journey|new beginning|path/.test(joined)) return "compass";
  if (/resilience|hardship|endurance|strength/.test(joined)) return "mountain";
  if (/wisdom|education|knowledge|learning/.test(joined)) return "book";
  if (/protection|home|guardian|safety/.test(joined)) return "key";
  return symbols.find((symbol) => SYMBOL_DNA[symbol]) ?? "tree";
}

function chooseSecondarySymbols(symbols: string[], primary: string, themes: string[]): string[] {
  const candidates = [...symbols, ...themeSymbols(themes), "shield", "laurel", "roots"]
    .map(normalizeSymbol)
    .filter((symbol) => symbol && symbol !== primary && SYMBOL_DNA[symbol]);
  return [...new Set(candidates)].slice(0, 2);
}

function chooseSupportingSymbols(primary: string, secondary: string[], themes: string[]): string[] {
  const candidates = [...themeSymbols(themes), "shield", "laurel", "roots", "path"]
    .map(normalizeSymbol)
    .filter((symbol) => symbol && symbol !== primary && !secondary.includes(symbol) && SYMBOL_DNA[symbol]);
  return [...new Set(candidates)].slice(0, 3);
}

function themeSymbols(themes: string[]): string[] {
  const joined = themes.join(" ").toLowerCase();
  const symbols: string[] = [];
  if (/root|continuity|unity|family/.test(joined)) symbols.push("tree", "roots");
  if (/remembrance|memory|guidance/.test(joined)) symbols.push("lantern", "book");
  if (/migration|journey|new beginning/.test(joined)) symbols.push("compass", "path");
  if (/resilience|hardship|endurance/.test(joined)) symbols.push("mountain", "roots");
  if (/wisdom|education|knowledge/.test(joined)) symbols.push("book", "lantern");
  if (/protection|home|future/.test(joined)) symbols.push("key", "shield");
  return symbols;
}

function buildRuntimeLrePrompt(input: AiImageGenerationJobInput, decision: RuntimeSymbolDecision): string {
  const metadata = input.safety_metadata;
  const houseName = stringValue(metadata.house_name) ?? stringValue(metadata.houseName) ?? "this family";
  const style = stringValue(metadata.visual_style) ?? "premium private archive";
  const colors = arrayOfStrings(metadata.colors);
  const palette = colors.length > 0 ? colors.join(", ") : "near-black, antique gold, warm ivory highlights";

  return [
    `LRE Prompt Builder: create a premium symbolic family keepsake artwork for ${houseName}.`,
    `Evidence summary: use the paid order context, values, selected symbols, and family meaning only; do not invent history.`,
    `Dominant meaning themes: ${decision.dominantThemes.join(", ")}.`,
    `Primary composition: ${titleCase(decision.primarySymbol)} must be visually dominant and clearly recognizable.`,
    `Primary Symbol DNA: ${SYMBOL_DNA[decision.primarySymbol]}.`,
    `Secondary symbols: ${decision.secondarySymbols.map(titleCase).join(", ") || "none"}; keep them subordinate and integrated into the frame.`,
    `Supporting symbols: ${decision.supportingSymbols.map(titleCase).join(", ") || "none"}; use as quiet accents only.`,
    `Hierarchy rule: one primary symbol only; secondary symbols remain smaller; supporting symbols never become the focal point; ornament never becomes the meaning.`,
    `Composition layout: centered crest or medallion, strong silhouette, clear primary focal point, shield/archive framing when useful, balanced lower plaque or ribbon shape without readable text.`,
    `Symbol DNA fragments: ${decision.selectedDna.join("; ")}.`,
    `Material direction: embossed antique gold metal, bevelled edges, engraved relief, tactile depth, premium keepsake finish, not flat line art.`,
    `Lighting direction: warm directional highlights, deep shadows, subtle rim light, realistic metallic reflections, cinematic but restrained.`,
    `Background direction: black archival surface, subtle paper/leather texture, private vault mood, no public institutional seal.`,
    `Palette: ${palette}. Style preference: ${style}.`,
    `Production constraints: high-fidelity raster artwork, premium depth, no readable text, no watermark, no signatures, no fake Latin, no official seal.`,
    `Boundary: personalized symbolic keepsake only; not official heraldry, not certified genealogy, not a status claim.`
  ].join("\n");
}

function verifyRuntimeLrePrompt(input: {
  prompt: string;
  negativePrompt: string | null;
  decision: RuntimeSymbolDecision;
}): RuntimeVerificationResult {
  const prompt = input.prompt.toLowerCase();
  const negative = (input.negativePrompt ?? "").toLowerCase();
  const issues: string[] = [];
  const checks = [
    prompt.includes(input.decision.primarySymbol),
    input.decision.selectedDna.length > 0 && prompt.includes("symbol dna fragments"),
    prompt.includes("one primary symbol only") && prompt.includes("secondary symbols remain smaller"),
    prompt.includes("material direction") && prompt.includes("lighting direction"),
    prompt.includes("not official heraldry") && prompt.includes("not certified genealogy"),
    prompt.includes("no readable text"),
    negative.includes("no readable text") && negative.includes("flat line art"),
    negative.includes("generic heraldic template") && negative.includes("royal crown"),
    !/(official coat of arms|legally granted|royal lineage|noble lineage|bloodline|true ancestral arms)/i.test(input.prompt),
    !/(show the motto|write the surname|display family name|include visible words)/i.test(input.prompt)
  ];

  if (!checks[0]) issues.push("primary_symbol_missing");
  if (!checks[1]) issues.push("dna_missing");
  if (!checks[2]) issues.push("hierarchy_missing_or_weak");
  if (!checks[3]) issues.push("material_or_lighting_missing");
  if (!checks[4]) issues.push("boundary_language_missing");
  if (!checks[5] || !checks[6]) issues.push("negative_prompt_safety_missing");
  if (!checks[8]) issues.push("fake_claim_language_detected");
  if (!checks[9]) issues.push("readable_text_risk_detected");

  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return {
    score,
    passed: issues.length === 0 && score >= LRE_IMAGE_PROMPT_PASS_THRESHOLD,
    issues
  };
}

function mergeNegativePrompt(base: string | null): string {
  const terms = [...(base ? base.split(",").map((item) => item.trim()) : []), ...BASE_NEGATIVE_TERMS];
  return [...new Set(terms.map((item) => item.toLowerCase()).filter(Boolean))].join(", ");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeSymbol(value: string): string {
  return value.toLowerCase().replace(/[^a-z/ ]/g, "").split("/")[0]?.trim().replace(/\s+/g, "_") ?? "";
}

function titleCase(value: string): string {
  return value
    .split(/[_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
