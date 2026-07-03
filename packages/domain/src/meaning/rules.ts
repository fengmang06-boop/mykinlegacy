import type {
  CollectionContent,
  CollectionContentQualityReport,
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

export const ARTIFACT_CONTENT_VERSION = "artifact_content.v1" as const;

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
    legacy_identity: buildLegacyIdentity(customerInputs),
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
  const familyName = profile.legacy_identity.family_display_name;
  const collectionName = profile.legacy_identity.collection_name;
  const recipientLine = inputs.recipient ? inputs.recipient : familyName;
  const occasionPhrase = profile.legacy_identity.occasion_framing;
  const themes = profile.meaning_themes.map((theme) => titleCase(theme.theme));
  const themePhrase = naturalList(themes.slice(0, 3), "family meaning");
  const uniqueSymbols = dedupeSymbols(profile.symbol_choices);
  const symbolNames = uniqueSymbols.map((symbol) => titleCase(symbol.symbol));
  const symbolPhrase = naturalList(symbolNames.slice(0, 3), "chosen symbols");
  const firstMemory = inputs.memories[0];
  const valuePhrase = naturalList(inputs.values.slice(0, 3).map(titleCase), themePhrase);
  const symbolGuide = uniqueSymbols.map((symbol) => ({
    symbol: titleCase(symbol.symbol),
    meaning: sentenceCase(symbol.meaning),
    why_chosen: sentenceCase(symbol.rationale),
    customer_input_basis: sentenceCase(symbol.customer_input_basis),
    visual_role: sentenceCase(symbol.visual_role),
    artifact_role: sentenceCase(symbol.artifact_role),
    emotional_relevance: sentenceCase(symbol.emotional_purpose)
  }));
  const contentBase = {
    contract_version: "1.0",
    schema_version: "collection_content.v1",
    created_at: now.toISOString(),
    source: "rule_based_meaning_engine",
    artifact_content_version: ARTIFACT_CONTENT_VERSION,
    collection_name: collectionName,
    family_display_name: familyName,
    house_meaning_summary: `${collectionName} for ${familyName} was shaped around ${themePhrase.toLowerCase()}. It translates the family's values, memories, and chosen symbols into a private symbolic keepsake, using ${symbolPhrase.toLowerCase()} to recognize what should be honored now and carried forward later.`,
    symbol_guide: symbolGuide,
    family_story: buildFamilyStory({
      familyName,
      collectionName,
      themePhrase,
      valuePhrase,
      firstMemory,
      occasionPhrase,
      symbolPhrase
    }),
    certificate_text: `Presented For: ${recipientLine}\nCollection Name: ${collectionName}\n\nThis private symbolic keepsake honors ${themePhrase.toLowerCase()} as the core meaning of this private family collection. Its symbolic elements, including ${symbolPhrase.toLowerCase()}, were selected to give visible form to values the family can keep, gift, and return to over time.\n\nPreservation Note: This artifact is prepared as a personal keepsake for family recognition, not as a public claim of rank, ancestry, or heraldic authority.\n\n${COLLECTION_BOUNDARY_STATEMENT}`,
    collection_letter: `Dear ${recipientLine},\n\nThis collection was prepared because ordinary gifts often cannot hold the quiet things that make a family meaningful: the values people live by, the memories they return to, and the symbols that help those things be seen.\n\nMay ${collectionName} become something you can open slowly, share with the people closest to you, and keep as a reminder of ${valuePhrase.toLowerCase()}.\n\nWith care,\nMyKinLegacy`,
    design_basis: buildDesignBasis(generationBrief, themePhrase, symbolPhrase),
    boundary_statement: COLLECTION_BOUNDARY_STATEMENT
  } satisfies Omit<CollectionContent, "content_quality">;

  return {
    ...contentBase,
    content_quality: validateCollectionContent(contentBase, profile)
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
    if (!theme.why_inferred.trim()) qualityFlags.push(`theme_reason_missing:${theme.theme}`);
    if (!theme.customer_input_basis.trim()) qualityFlags.push(`theme_customer_basis_missing:${theme.theme}`);
    if (!theme.artifact_effect.trim()) qualityFlags.push(`theme_artifact_effect_missing:${theme.theme}`);
  }
  for (const symbol of profile.symbol_choices) {
    if (!symbol.rationale.trim()) qualityFlags.push(`symbol_rationale_missing:${symbol.symbol}`);
    if (!symbol.customer_input_basis.trim()) qualityFlags.push(`symbol_customer_basis_missing:${symbol.symbol}`);
    if (!symbol.visual_role.trim()) qualityFlags.push(`symbol_visual_role_missing:${symbol.symbol}`);
    if (!symbol.artifact_role.trim()) qualityFlags.push(`symbol_artifact_role_missing:${symbol.symbol}`);
    if (!symbol.emotional_purpose.trim()) qualityFlags.push(`symbol_emotional_purpose_missing:${symbol.symbol}`);
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
    return [buildMeaningTheme(rule.theme, input, keyword, hasValue ? "high" : confidenceFromEvidence(input))];
  });

  if (matched.length > 0) {
    return dedupeThemes(matched).slice(0, 5);
  }

  return [
    buildMeaningTheme("unity", input, "family", "low"),
    buildMeaningTheme("continuity", input, "legacy", "low"),
    buildMeaningTheme("gratitude", input, "keepsake", "low")
  ];
}

function buildMeaningTheme(
  theme: string,
  input: MeaningCustomerInputs,
  keyword: string | undefined,
  confidence: MeaningConfidence
): MeaningTheme {
  const evidence = evidenceForTheme(theme, input, keyword);
  return {
    theme,
    evidence,
    confidence,
    why_inferred: whyThemeWasInferred(theme, input, keyword, confidence),
    customer_input_basis: customerBasisForTheme(theme, input, keyword),
    artifact_effect: artifactEffectForTheme(theme)
  };
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
      source: theme.confidence === "low" ? "symbolic_interpretation" : "customer_input",
      customer_input_basis: theme.customer_input_basis,
      visual_role: visualRoleForSymbol(selected.symbol, theme.theme),
      artifact_role: artifactRoleForSymbol(selected.symbol, theme.theme),
      emotional_purpose: emotionalPurposeForSymbol(selected.symbol, theme.theme)
    });
  }

  if (!choices.some((item) => item.symbol === "shield")) {
    choices.unshift({
      symbol: "shield",
      meaning: "protection and a stable family identity frame",
      rationale:
        "Selected as a symbolic interpretation for a private family legacy collection because it gives the design a clear protective structure without claiming official status.",
      source: "symbolic_interpretation",
      customer_input_basis:
        "A shield is used as the collection frame because the product is a private symbolic keepsake centered on family protection and recognition.",
      visual_role: "Forms the outer structure of the crest artwork and gives the design a clear family identity frame.",
      artifact_role: "Connects the artwork, certificate, and symbol guide into one recognizable legacy collection.",
      emotional_purpose: "Helps the recipient feel that the family story is being held with care, not simply decorated."
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
    `The design basis is built around ${primaryThemes}, using ${primarySymbols} as symbolic anchors tied to the customer's values and memories.`,
    `The palette direction is ${palette}, chosen to keep the collection dignified, gift-ready, and archival rather than decorative or loud.`,
    "The crest is treated as a private symbolic emblem. It does not claim official heraldry, legal arms, noble status, or certified genealogy.",
    "Text such as the house name or motto should be rendered server-side in the finished collection artifacts, not inside generated image artwork."
  ];
}

function buildStoryDirection(themes: MeaningTheme[], input: MeaningCustomerInputs): string {
  const recipient = input.recipient ? ` for ${input.recipient}` : "";
  const occasion = input.occasion ? ` in the context of ${input.occasion}` : "";
  const themeList = themes.map((theme) => theme.theme).join(", ");
  const memory = input.memories[0];
  return memory
    ? `The family story should honor ${themeList}${recipient}${occasion}, grounded in the customer-provided memory: "${memory}".`
    : `The family story should honor ${themeList}${recipient}${occasion}, using careful symbolic interpretation without inventing family history or genealogical facts.`;
}

function buildFamilyStory(input: {
  familyName: string;
  collectionName: string;
  themePhrase: string;
  valuePhrase: string;
  firstMemory?: string;
  occasionPhrase: string;
  symbolPhrase: string;
}): string {
  const memorySentence = input.firstMemory
    ? `One remembered detail gives the collection its human center: ${input.firstMemory}.`
    : `Because only a small amount of family detail was provided, the story stays honest and works from symbolic interpretation instead of inventing history.`;

  return `${input.collectionName} honors ${input.familyName} as a family shaped by ${input.themePhrase.toLowerCase()}. ${memorySentence} The values carried forward here are ${input.valuePhrase.toLowerCase()}, expressed through ${input.symbolPhrase.toLowerCase()} so the collection has both language and visible memory. ${input.occasionPhrase} gives the keepsake its present-day reason: this is something to open now, share with care, and preserve for the people who may one day ask what this family stood for. It is not a claim of public status or certified ancestry. It is a quiet recognition of the private meaning this family already holds.`;
}

function buildDesignBasis(
  generationBrief: GenerationBrief,
  themePhrase: string,
  symbolPhrase: string
): string {
  const palette = naturalList(generationBrief.art_direction.palette.map(titleCase), "antique gold and ivory");
  const composition = generationBrief.art_direction.composition[0] ?? "The composition should feel stable and archival.";
  const identity = generationBrief.meaning_profile.legacy_identity;
  return `${composition} The design direction uses ${symbolPhrase.toLowerCase()} to express ${themePhrase.toLowerCase()} for ${identity.family_display_name}. The palette direction is ${palette.toLowerCase()}, with a dark archive base, antique gold accents, and an ivory document tone so the collection feels private, ceremonial, gift-ready, and suitable for long-term keeping. The shield and emblem structure provide a recognizable family frame; the selected symbols carry the meaning; the written artifacts explain why those choices belong. Text is treated as part of the finished collection layout rather than placed inside generated artwork, and the design remains a personalized symbolic keepsake rather than official heraldry.`;
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

function buildLegacyIdentity(input: MeaningCustomerInputs): MeaningProfile["legacy_identity"] {
  const familyDisplayName = displayFamilyName(input);
  const collectionName = input.recipient
    ? `${input.recipient}'s Legacy Collection`
    : input.house_name
      ? `${input.house_name} Legacy Collection`
      : input.surname
        ? `The ${input.surname} Family Legacy Collection`
        : "A Private Family Legacy Collection";
  const values = naturalList(input.values.slice(0, 3).map(titleCase), "family meaning");
  const occasion = input.occasion
    ? `Prepared for ${input.occasion}, so the collection has a clear reason to be opened now.`
    : "Prepared as a private keepsake for family recognition, gifting, and long-term keeping.";
  const tone = input.preferred_tone.length > 0
    ? naturalList(input.preferred_tone.slice(0, 3).map(titleCase), "warm and dignified")
    : "Warm, dignified, private, and archival.";

  return {
    collection_name: safeVisibleText(collectionName, "A Private Family Legacy Collection"),
    family_display_name: safeVisibleText(familyDisplayName, "Your Family Legacy"),
    short_identity_statement: `${safeVisibleText(familyDisplayName, "Your Family Legacy")} is interpreted through ${values.toLowerCase()}, with symbols chosen to make those qualities visible without inventing history.`,
    tone_direction: tone,
    occasion_framing: occasion
  };
}

function whyThemeWasInferred(
  theme: string,
  input: MeaningCustomerInputs,
  keyword: string | undefined,
  confidence: MeaningConfidence
): string {
  if (input.values.map((value) => value.toLowerCase()).includes(theme)) {
    return `${titleCase(theme)} was inferred because the customer explicitly selected it as a family value.`;
  }
  if (keyword) {
    return `${titleCase(theme)} was inferred because the interview included "${keyword}", which is treated as a symbolic signal for this theme.`;
  }
  return confidence === "low"
    ? `${titleCase(theme)} is used as a careful symbolic fallback because the interview did not include enough specific detail yet.`
    : `${titleCase(theme)} is supported by the combined interview details.`;
}

function customerBasisForTheme(theme: string, input: MeaningCustomerInputs, keyword?: string): string {
  const memory = input.memories.find((item) => keyword && item.toLowerCase().includes(keyword));
  if (memory) return `Customer memory: "${memory}".`;
  if (input.values.map((value) => value.toLowerCase()).includes(theme)) {
    return `Customer-selected family value: "${theme}".`;
  }
  if (keyword) return `Customer wording included "${keyword}".`;
  if (input.occasion) return `Customer occasion: "${input.occasion}".`;
  if (input.recipient) return `Customer recipient: "${input.recipient}".`;
  return "Symbolic interpretation from limited interview detail.";
}

function artifactEffectForTheme(theme: string): string {
  const effects: Record<string, string> = {
    protection: "Makes the certificate and crest feel like a guarded family frame.",
    resilience: "Gives the story a tone of steadiness, endurance, and respect.",
    memory: "Moves the collection toward remembrance, preservation, and private archive language.",
    guidance: "Adds a future-facing tone, especially in the family story and certificate close.",
    continuity: "Connects the artwork and documents to generations, roots, and what can be passed down.",
    gratitude: "Makes the collection feel gift-ready and suited to parents, grandparents, or family milestones.",
    craftsmanship: "Adds respect for work, skill, making, and the dignity of effort.",
    journey: "Frames the collection around movement, courage, and the road a family has traveled.",
    unity: "Keeps the collection centered on belonging and shared family identity.",
    growth: "Gives the collection a hopeful tone for children, new beginnings, and future memory.",
    sacrifice: "Adds reverence for service, provision, and quiet devotion."
  };
  return effects[theme] ?? "Shapes the tone, symbol hierarchy, and written artifacts around family meaning.";
}

function visualRoleForSymbol(symbol: string, theme: string): string {
  const lower = symbol.toLowerCase();
  if (lower.includes("shield")) return "Forms the main protective family frame of the crest artwork.";
  if (lower.includes("oak") || lower.includes("tree") || lower.includes("branch")) {
    return "Adds rooted structure and generational weight around the central emblem.";
  }
  if (lower.includes("compass") || lower.includes("star") || lower.includes("lantern")) {
    return "Provides a guiding focal point that draws the eye toward future direction.";
  }
  if (lower.includes("book") || lower.includes("key") || lower.includes("candle")) {
    return "Introduces a private archive motif connected to memory and remembrance.";
  }
  if (lower.includes("laurel") || lower.includes("ribbon")) {
    return "Frames the piece with honor, recognition, and a gift-ready ceremonial note.";
  }
  return `Acts as a visible anchor for ${theme}, placed within the crest structure rather than used as decoration alone.`;
}

function artifactRoleForSymbol(symbol: string, theme: string): string {
  return `${titleCase(symbol)} connects the crest artwork to the written Symbol Guide, where ${theme} is explained as family meaning rather than official heraldry.`;
}

function emotionalPurposeForSymbol(symbol: string, theme: string): string {
  return `${titleCase(symbol)} helps the recipient recognize ${theme} as something the family can see, name, and preserve.`;
}

function validateCollectionContent(
  content: Omit<CollectionContent, "content_quality">,
  profile: MeaningProfile
): CollectionContentQualityReport {
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];
  const visibleText = [
    content.collection_name,
    content.family_display_name,
    content.house_meaning_summary,
    ...content.symbol_guide.flatMap((symbol) => [
      symbol.symbol,
      symbol.meaning,
      symbol.why_chosen,
      symbol.customer_input_basis,
      symbol.visual_role,
      symbol.artifact_role,
      symbol.emotional_relevance
    ]),
    content.family_story,
    content.certificate_text,
    content.collection_letter,
    content.design_basis,
    content.boundary_statement
  ].join("\n");
  const repeatedSymbolCount =
    content.symbol_guide.length - new Set(content.symbol_guide.map((symbol) => symbol.symbol.toLowerCase())).size;
  const fallback = fallbackUsed(profile.customer_inputs);
  const strongThemeCount = profile.meaning_themes.filter((theme) => theme.confidence !== "low").length;

  if (/\bHouse of Unknown\b/i.test(visibleText)) hardFailures.push("house_of_unknown");
  if (/\b(null|undefined)\b/i.test(visibleText)) hardFailures.push("null_or_undefined_visible");
  if (/[{[]\s*"[^"]+"\s*:/s.test(visibleText)) hardFailures.push("raw_json_visible");
  if (/\b(debug|placeholder|sample|test artifact)\b/i.test(visibleText)) hardFailures.push("debug_label_visible");
  if (!visibleText.includes(COLLECTION_BOUNDARY_STATEMENT)) hardFailures.push("boundary_statement_missing");
  if (content.symbol_guide.length === 0) hardFailures.push("symbol_guide_empty");
  if (repeatedSymbolCount > 0) hardFailures.push("repeated_symbol_blocks");
  if (content.house_meaning_summary.length < 140) hardFailures.push("summary_too_short");
  if (content.family_story.length < 420) hardFailures.push("family_story_too_short");
  if (content.certificate_text.length < 320) hardFailures.push("certificate_too_short");
  if (content.collection_letter.length < 220) hardFailures.push("collection_letter_too_short");
  if (content.design_basis.length < 320) hardFailures.push("design_basis_too_short");
  if (!/customer|symbolic|selected|chosen|value|memory|occasion|recipient/i.test(visibleText)) {
    hardFailures.push("customer_or_symbolic_basis_missing");
  }

  if (fallback) softWarnings.push("generic_fallback_used");
  if (strongThemeCount < 3) softWarnings.push("fewer_than_three_strong_themes");
  if (!profile.customer_inputs.recipient) softWarnings.push("recipient_missing");
  if (profile.customer_inputs.memories.length === 0) softWarnings.push("personal_memory_missing");
  softWarnings.push("mvp_artwork_template_internal_beta");

  return {
    content_quality_status: hardFailures.length > 0 ? "failed" : "passed",
    hard_failures: [...new Set(hardFailures)],
    soft_warnings: [...new Set(softWarnings)],
    theme_count: profile.meaning_themes.length,
    symbol_count: content.symbol_guide.length,
    repeated_symbol_count: Math.max(0, repeatedSymbolCount),
    fallback_used: fallback,
    boundary_statement_present: visibleText.includes(COLLECTION_BOUNDARY_STATEMENT),
    artifact_content_version: ARTIFACT_CONTENT_VERSION
  };
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
    const prefix = text.slice(Math.max(0, index - 160), index);
    const sentenceStart = Math.max(
      prefix.lastIndexOf("."),
      prefix.lastIndexOf("!"),
      prefix.lastIndexOf("?"),
      prefix.lastIndexOf("\n")
    );
    const localPrefix = prefix.slice(sentenceStart + 1);
    if (!/(not an?|not provide|does not provide|does not claim|without claiming|rather than)/i.test(localPrefix)) {
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
  if (input.recipient) return `${input.recipient} Legacy Collection`;
  return "Your Family Legacy";
}

function safeVisibleText(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || /^(unknown|null|undefined|n\/a|none|test|sample|placeholder)$/i.test(cleaned)) {
    return fallback;
  }
  if (/house of unknown/i.test(cleaned)) return fallback;
  return cleaned.slice(0, 120);
}

function fallbackUsed(input: MeaningCustomerInputs): boolean {
  return !input.house_name && !input.surname && !input.recipient;
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
