import type {
  CollectionContent,
  GenerationBrief,
  MeaningConfidence,
  MeaningCustomerInputs,
  MeaningEngineInput,
  MeaningManifestAttachment,
  MeaningProfile,
  MeaningTheme,
  SymbolChoice
} from "./types";

export const BOUNDARY_STATEMENT =
  "This is a personalized symbolic keepsake and customer-informed symbolic interpretation. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";

export const COLLECTION_BOUNDARY_STATEMENT =
  "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";

export const BANNED_MEANING_CLAIMS = [
  "official coat of arms",
  "certified genealogy",
  "noble bloodline",
  "legally granted arms",
  "verified ancestry",
  "authentic ancient family arms",
  "royal lineage",
  "proves your ancestry",
  "official family crest",
  "real family arms",
  "ancestral proof",
  "legally recognized heraldry"
] as const;

const THEME_RULES: Array<{
  theme: string;
  keywords: string[];
  symbols: Array<{ symbol: string; meaning: string }>;
}> = [
  {
    theme: "protection",
    keywords: ["protection", "protect", "protector", "safe", "safety", "guard", "guardianship", "responsibility", "held the family together"],
    symbols: [
      { symbol: "shield", meaning: "protection and guardianship" },
      { symbol: "gate", meaning: "a safe threshold for family and home" },
      { symbol: "lion", meaning: "courageous family guardianship" }
    ]
  },
  {
    theme: "resilience",
    keywords: ["resilience", "resilient", "endurance", "endure", "difficult years", "hard times", "strength", "strong", "survived"],
    symbols: [
      { symbol: "oak branch", meaning: "endurance and family roots" },
      { symbol: "mountain", meaning: "steadiness through hardship" },
      { symbol: "stone", meaning: "quiet permanence and strength" }
    ]
  },
  {
    theme: "memory",
    keywords: ["memory", "remember", "remembered", "passed away", "memorial", "honor", "stories", "story"],
    symbols: [
      { symbol: "book", meaning: "family memory and preserved story" },
      { symbol: "key", meaning: "opening the private archive of family memory" },
      { symbol: "candle", meaning: "remembrance and enduring presence" }
    ]
  },
  {
    theme: "guidance",
    keywords: ["guidance", "guide", "guided", "mentor", "wisdom", "direction", "future", "hope"],
    symbols: [
      { symbol: "compass", meaning: "direction across generations" },
      { symbol: "star", meaning: "guidance and future hope" },
      { symbol: "lantern", meaning: "wisdom carried forward" }
    ]
  },
  {
    theme: "continuity",
    keywords: ["continuity", "roots", "generations", "legacy", "pass down", "family tree", "heritage", "tradition"],
    symbols: [
      { symbol: "tree", meaning: "family roots and generational continuity" },
      { symbol: "ring", meaning: "unbroken family connection" },
      { symbol: "river", meaning: "a story that continues across time" }
    ]
  },
  {
    theme: "gratitude",
    keywords: ["gratitude", "thankful", "thanks", "appreciation", "honor", "father", "mother", "parents", "grandparents"],
    symbols: [
      { symbol: "laurel", meaning: "honor and gratitude" },
      { symbol: "ribbon", meaning: "a gift of recognition" },
      { symbol: "warm gold", meaning: "dignity, warmth, and appreciation" }
    ]
  },
  {
    theme: "craftsmanship",
    keywords: ["craft", "craftsmanship", "work", "worker", "builder", "made", "hands", "skill"],
    symbols: [
      { symbol: "hammer", meaning: "work, craft, and durable effort" },
      { symbol: "chisel", meaning: "careful shaping over time" },
      { symbol: "hand", meaning: "service, making, and personal care" }
    ]
  },
  {
    theme: "journey",
    keywords: ["migration", "journey", "immigration", "moved", "crossed", "country", "road", "ship"],
    symbols: [
      { symbol: "compass", meaning: "the courage to move toward a future" },
      { symbol: "road", meaning: "the path a family has traveled" },
      { symbol: "ship", meaning: "migration, crossing, and new beginnings" }
    ]
  },
  {
    theme: "unity",
    keywords: ["unity", "together", "connection", "belonging", "family bond", "loyalty"],
    symbols: [
      { symbol: "knot", meaning: "family unity and connection" },
      { symbol: "ring", meaning: "shared belonging" },
      { symbol: "braided branch", meaning: "many lives woven into one family line" }
    ]
  },
  {
    theme: "growth",
    keywords: ["growth", "grow", "new baby", "child", "children", "beginning", "future", "sunrise"],
    symbols: [
      { symbol: "seed", meaning: "new family growth" },
      { symbol: "sunrise", meaning: "future hope" },
      { symbol: "vine", meaning: "life extending through generations" }
    ]
  },
  {
    theme: "sacrifice",
    keywords: ["sacrifice", "gave up", "worked hard", "provided", "served", "open hand"],
    symbols: [
      { symbol: "open hand", meaning: "service and sacrifice" },
      { symbol: "flame", meaning: "devotion carried through difficulty" },
      { symbol: "laurel", meaning: "honor for what was given" }
    ]
  }
];

export function buildMeaningProfile(input: MeaningEngineInput = {}, now = new Date()): MeaningProfile {
  const timestamp = now.toISOString();
  const customerInputs = normalizeCustomerInputs(input);
  const meaningThemes = extractMeaningThemes(customerInputs);
  const symbolChoices = selectSymbols(meaningThemes, customerInputs);
  const profile: Omit<MeaningProfile, "validation"> = {
    contract_version: "1.0",
    schema_version: "meaning_profile.v1",
    created_at: timestamp,
    updated_at: timestamp,
    source: "rule_based_meaning_engine",
    source_level: input.source_level ?? inferSourceLevel(customerInputs),
    customer_inputs: customerInputs,
    meaning_themes: meaningThemes,
    symbol_choices: symbolChoices,
    design_rationale: buildDesignRationale(meaningThemes, symbolChoices, customerInputs),
    story_direction: buildStoryDirection(meaningThemes, customerInputs),
    certificate_direction:
      "The certificate should read like a private archival keepsake shaped by family values and memory, not as an official heraldic or genealogical document.",
    boundary_statement: BOUNDARY_STATEMENT
  };
  const validation = validateMeaningProfile(profile);
  return { ...profile, validation };
}

export function buildGenerationBrief(input: MeaningEngineInput = {}, now = new Date()): GenerationBrief {
  const meaningProfile = buildMeaningProfile(input, now);
  return {
    contract_version: "1.0",
    schema_version: "generation_brief.v1",
    created_at: now.toISOString(),
    source: "rule_based_meaning_engine",
    source_level: meaningProfile.source_level,
    meaning_profile: meaningProfile,
    art_direction: {
      composition: [
        "Use a stable heraldry-inspired shield composition as a symbolic keepsake structure.",
        "Prioritize the selected symbols only when they have a clear rationale.",
        "Keep the design dignified, private, and archival rather than loud or decorative."
      ],
      palette: customerPalette(meaningProfile.customer_inputs),
      avoid: [
        "readable text inside AI-generated images",
        "copyrighted logos",
        "trademarked symbols",
        "visual claims of official heraldic authority"
      ]
    },
    text_strategy: {
      include_text_in_image: false,
      render_text_server_side: true,
      text_fields: ["house_name", "motto"]
    }
  };
}

export function createMeaningManifestAttachment(
  input: MeaningEngineInput = {},
  now = new Date()
): MeaningManifestAttachment {
  const generationBrief = buildGenerationBrief(input, now);
  return {
    attachment_type: "meaning_engine",
    version: "1.0",
    meaning_profile: generationBrief.meaning_profile,
    generation_brief: generationBrief,
    collection_content: buildCollectionContent(generationBrief, now)
  };
}

export function buildCollectionContent(
  generationBrief: GenerationBrief,
  now = new Date()
): CollectionContent {
  const profile = generationBrief.meaning_profile;
  const inputs = profile.customer_inputs;
  const familyName = displayFamilyName(inputs);
  const recipientPhrase = inputs.recipient ? ` for ${inputs.recipient}` : "";
  const occasionPhrase = inputs.occasion ? ` for ${inputs.occasion}` : "";
  const themes = profile.meaning_themes.map((theme) => titleCase(theme.theme));
  const themePhrase = naturalList(themes.slice(0, 3), "family meaning");
  const symbolNames = profile.symbol_choices.map((symbol) => titleCase(symbol.symbol));
  const symbolPhrase = naturalList(symbolNames.slice(0, 3), "chosen symbols");
  const firstMemory = inputs.memories[0];
  const valuePhrase = naturalList(inputs.values.slice(0, 3).map(titleCase), themePhrase);

  return {
    contract_version: "1.0",
    schema_version: "collection_content.v1",
    created_at: now.toISOString(),
    source: "rule_based_meaning_engine",
    house_meaning_summary: `${familyName} was shaped around ${themePhrase.toLowerCase()}. This collection brings those qualities into a private symbolic keepsake${recipientPhrase}, using ${symbolPhrase.toLowerCase()} to express what the family wants to remember, honor, and carry forward.`,
    symbol_guide: profile.symbol_choices.map((symbol) => ({
      symbol: titleCase(symbol.symbol),
      meaning: sentenceCase(symbol.meaning),
      why_chosen: sentenceCase(symbol.rationale),
      emotional_relevance: `${titleCase(symbol.symbol)} gives the collection a visible reminder of ${symbol.meaning.toLowerCase()}, so the design feels connected to the family's lived values rather than decoration alone.`
    })),
    family_story: buildFamilyStory({
      familyName,
      themePhrase,
      valuePhrase,
      firstMemory,
      occasionPhrase
    }),
    certificate_text: `Presented as a private symbolic keepsake for ${familyName}. This certificate honors the values of ${themePhrase.toLowerCase()} and the family story carried through ${symbolPhrase.toLowerCase()}. It is prepared for personal keeping, gifting, and remembrance.`,
    collection_letter: `To the family,\n\nThis collection was created to recognize what ordinary gifts often cannot hold: the values, memories, and symbols that make a family feel like itself. May it serve as a private reminder of ${valuePhrase.toLowerCase()} and a keepsake you can return to, share, and pass forward.\n\nWith care,\nMyKinLegacy`,
    design_basis: buildDesignBasis(generationBrief, themePhrase, symbolPhrase),
    boundary_statement: COLLECTION_BOUNDARY_STATEMENT
  };
}

export function validateMeaningProfile(
  profile: Omit<MeaningProfile, "validation"> | MeaningProfile
) {
  const qualityFlags: string[] = [];
  const text = JSON.stringify(profile).toLowerCase();
  const bannedClaimsFound = BANNED_MEANING_CLAIMS.filter((phrase) =>
    hasUnnegatedRiskPhrase(text, phrase)
  );

  if (!profile.source_level) qualityFlags.push("source_level_missing");
  if (!profile.boundary_statement) qualityFlags.push("boundary_statement_missing");
  if (profile.meaning_themes.length === 0) qualityFlags.push("meaning_themes_empty");
  if (profile.symbol_choices.length === 0) qualityFlags.push("symbol_choices_empty");
  if (profile.design_rationale.length === 0) qualityFlags.push("design_rationale_empty");
  if (!profile.story_direction.trim()) qualityFlags.push("story_direction_empty");
  if (!profile.certificate_direction.trim()) qualityFlags.push("certificate_direction_empty");

  for (const theme of profile.meaning_themes) {
    if (!theme.evidence.trim()) qualityFlags.push(`theme_evidence_missing:${theme.theme}`);
  }
  for (const symbol of profile.symbol_choices) {
    if (!symbol.rationale.trim()) qualityFlags.push(`symbol_rationale_missing:${symbol.symbol}`);
    if (!/(customer|symbolic|selected|chosen|value|memory|theme|input)/i.test(symbol.rationale)) {
      qualityFlags.push(`symbol_rationale_source_unclear:${symbol.symbol}`);
    }
  }

  if (isPurelyGeneric(profile)) qualityFlags.push("output_too_generic");

  return {
    valid: qualityFlags.length === 0 && bannedClaimsFound.length === 0,
    quality_flags: [...new Set(qualityFlags)],
    banned_claims_found: bannedClaimsFound
  };
}

function normalizeCustomerInputs(input: MeaningEngineInput): MeaningCustomerInputs {
  return {
    recipient: cleanOptional(input.recipient),
    occasion: cleanOptional(input.occasion),
    values: cleanList(input.values),
    memories: cleanList(input.memories),
    preferred_tone: cleanList(input.preferred_tone),
    symbols: cleanList(input.symbols),
    colors: cleanList(input.colors),
    surname: cleanOptional(input.surname),
    house_name: cleanOptional(input.house_name),
    motto: cleanOptional(input.motto)
  };
}

function extractMeaningThemes(input: MeaningCustomerInputs): MeaningTheme[] {
  const corpus = [
    input.recipient,
    input.occasion,
    input.surname,
    input.house_name,
    input.motto,
    ...input.values,
    ...input.memories,
    ...input.preferred_tone,
    ...input.symbols
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const directValues = new Set(input.values.map((value) => value.toLowerCase()));
  const matched = THEME_RULES.flatMap((rule): MeaningTheme[] => {
    const hasValue = directValues.has(rule.theme);
    const keyword = rule.keywords.find((item) => corpus.includes(item));
    if (!hasValue && !keyword) return [];
    return [
      {
        theme: rule.theme,
        evidence: evidenceForTheme(rule.theme, input, keyword),
        confidence: hasValue ? "high" : confidenceFromEvidence(input)
      }
    ];
  });

  if (matched.length > 0) {
    return dedupeThemes(matched).slice(0, 5);
  }

  return [
    {
      theme: "unity",
      evidence:
        "The order did not include enough specific memory detail, so the first brief starts with the safe family theme of unity.",
      confidence: "low"
    },
    {
      theme: "continuity",
      evidence:
        "The collection is a family legacy keepsake, so continuity is used as a low-confidence default until richer interview details are available.",
      confidence: "low"
    }
  ];
}

function selectSymbols(themes: MeaningTheme[], input: MeaningCustomerInputs): SymbolChoice[] {
  const preferred = new Set(input.symbols.map((symbol) => symbol.toLowerCase()));
  const choices: SymbolChoice[] = [];

  for (const theme of themes) {
    const rule = THEME_RULES.find((item) => item.theme === theme.theme);
    if (!rule) continue;
    const preferredSymbol = rule.symbols.find((item) => preferred.has(item.symbol.toLowerCase()));
    const selected = preferredSymbol ?? rule.symbols[0];
    if (!selected) continue;
    choices.push({
      symbol: selected.symbol,
      meaning: selected.meaning,
      rationale: `Chosen because the ${theme.confidence === "low" ? "symbolic interpretation" : "customer input"} points toward ${theme.theme}: ${theme.evidence}`,
      source: theme.confidence === "low" ? "symbolic_interpretation" : "customer_input"
    });
  }

  if (!choices.some((item) => item.symbol === "shield")) {
    choices.unshift({
      symbol: "shield",
      meaning: "protection and a stable family identity frame",
      rationale:
        "Selected as a symbolic interpretation for a private family legacy collection because it gives the design a clear protective structure without claiming official status.",
      source: "symbolic_interpretation"
    });
  }

  return dedupeSymbols(choices).slice(0, 5);
}

function buildDesignRationale(
  themes: MeaningTheme[],
  symbols: SymbolChoice[],
  input: MeaningCustomerInputs
): string[] {
  const primaryThemes = themes.map((theme) => theme.theme).join(", ");
  const primarySymbols = symbols.map((symbol) => symbol.symbol).join(", ");
  const palette = customerPalette(input).join(", ");
  return [
    `The design basis is built around ${primaryThemes}, using ${primarySymbols} as symbolic anchors.`,
    `The palette direction is ${palette}, chosen to keep the collection dignified, gift-ready, and archival.`,
    "Text such as the house name or motto should be rendered server-side in collection artifacts, not inside generated image artwork."
  ];
}

function buildStoryDirection(themes: MeaningTheme[], input: MeaningCustomerInputs): string {
  const recipient = input.recipient ? ` for the ${input.recipient}` : "";
  const occasion = input.occasion ? ` connected to ${input.occasion}` : "";
  const themeList = themes.map((theme) => theme.theme).join(", ");
  const memory = input.memories[0];
  return memory
    ? `The family story should emphasize ${themeList}${recipient}${occasion}, grounded in the memory: "${memory}".`
    : `The family story should emphasize ${themeList}${recipient}${occasion}, while staying clear that this is a symbolic interpretation rather than a genealogical claim.`;
}

function buildFamilyStory(input: {
  familyName: string;
  themePhrase: string;
  valuePhrase: string;
  firstMemory?: string;
  occasionPhrase: string;
}): string {
  const memorySentence = input.firstMemory
    ? `At the heart of the story is a remembered detail: ${input.firstMemory}`
    : `At the heart of the story is the desire to name what this family has carried quietly over time.`;

  return `${input.familyName} is represented here as a family shaped by ${input.themePhrase.toLowerCase()}. ${memorySentence} This collection gathers those qualities into a private keepsake${input.occasionPhrase}, so the family can see its values reflected with dignity, warmth, and continuity. It is less about claiming a public title and more about recognizing the private meaning a family already holds.`;
}

function buildDesignBasis(
  generationBrief: GenerationBrief,
  themePhrase: string,
  symbolPhrase: string
): string {
  const palette = naturalList(generationBrief.art_direction.palette.map(titleCase), "antique gold and ivory");
  const composition = generationBrief.art_direction.composition[0] ?? "The composition should feel stable and archival.";
  return `${composition} The design direction uses ${symbolPhrase.toLowerCase()} to express ${themePhrase.toLowerCase()}, with a palette of ${palette.toLowerCase()} so the collection feels private, ceremonial, and suitable for long-term keeping. Text is treated as part of the finished collection layout rather than placed inside generated artwork.`;
}

function customerPalette(input: MeaningCustomerInputs): string[] {
  if (input.colors.length > 0) return input.colors;
  if (input.preferred_tone.some((tone) => /warm|gratitude|honor/i.test(tone))) {
    return ["warm gold", "deep charcoal", "ivory"];
  }
  return ["antique gold", "deep charcoal", "ivory"];
}

function evidenceForTheme(theme: string, input: MeaningCustomerInputs, keyword?: string): string {
  const memory = input.memories.find((item) => keyword && item.toLowerCase().includes(keyword));
  if (memory) return `The customer memory says: "${memory}".`;
  if (input.values.map((value) => value.toLowerCase()).includes(theme)) {
    return `The customer selected "${theme}" as a family value.`;
  }
  if (keyword) return `The customer input included "${keyword}", which maps to ${theme}.`;
  return `The available customer input supports ${theme}.`;
}

function confidenceFromEvidence(input: MeaningCustomerInputs): MeaningConfidence {
  if (input.memories.length > 0 && input.values.length > 0) return "medium";
  return "low";
}

function inferSourceLevel(input: MeaningCustomerInputs): "minimal" | "customer_informed" | "customer_confirmed" {
  if (input.memories.length > 0 || input.values.length > 1 || input.recipient || input.occasion) {
    return "customer_informed";
  }
  if (input.values.length > 0 || input.surname || input.house_name) {
    return "minimal";
  }
  return "minimal";
}

function dedupeThemes(themes: MeaningTheme[]): MeaningTheme[] {
  const seen = new Set<string>();
  return themes.filter((theme) => {
    if (seen.has(theme.theme)) return false;
    seen.add(theme.theme);
    return true;
  });
}

function dedupeSymbols(symbols: SymbolChoice[]): SymbolChoice[] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    if (seen.has(symbol.symbol)) return false;
    seen.add(symbol.symbol);
    return true;
  });
}

function hasUnnegatedRiskPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = phrase.toLowerCase();
  let index = text.indexOf(normalizedPhrase);
  while (index >= 0) {
    const prefix = text.slice(Math.max(0, index - 40), index);
    if (!/(not an?|not provide|does not provide|without claiming|rather than)/i.test(prefix)) {
      return true;
    }
    index = text.indexOf(normalizedPhrase, index + normalizedPhrase.length);
  }
  return false;
}

function isPurelyGeneric(profile: Omit<MeaningProfile, "validation"> | MeaningProfile): boolean {
  const hasSpecificInput =
    profile.customer_inputs.values.length > 0 ||
    profile.customer_inputs.memories.length > 0 ||
    Boolean(profile.customer_inputs.recipient) ||
    Boolean(profile.customer_inputs.occasion) ||
    Boolean(profile.customer_inputs.surname);
  return !hasSpecificInput && profile.meaning_themes.every((theme) => theme.confidence === "low");
}

function displayFamilyName(input: MeaningCustomerInputs): string {
  if (input.house_name) return input.house_name;
  if (input.surname) return `The ${input.surname} family`;
  return "This family";
}

function naturalList(values: string[], fallback: string): string {
  const clean = values.map((value) => value.trim()).filter(Boolean);
  if (clean.length === 0) return fallback;
  if (clean.length === 1) return clean[0] ?? fallback;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed[0]?.toUpperCase()}${trimmed.slice(1)}`;
}

function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 240) : null;
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 12);
}
