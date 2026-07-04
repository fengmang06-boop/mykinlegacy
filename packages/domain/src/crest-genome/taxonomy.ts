import type {
  CrestFrameComponent,
  CrestMeaningTheme,
  CrestTemplate,
  FieldLayoutComponent,
  OrnamentComponent,
  PaletteComponent,
  PrimarySymbolComponent,
  RibbonComponent,
  SecondarySymbolComponent,
  TextureComponent
} from "./types";

export const CORE_MEANING_THEMES: CrestMeaningTheme[] = [
  "protection",
  "continuity",
  "unity",
  "memory",
  "gratitude",
  "resilience",
  "wisdom",
  "guidance",
  "growth",
  "sacrifice",
  "love",
  "journey",
  "belonging",
  "craftsmanship",
  "faith_devotion",
  "home",
  "legacy",
  "renewal"
];

export const SYMBOL_TAXONOMY: Record<CrestMeaningTheme, string[]> = {
  protection: ["shield", "key", "gate", "fortress", "oak_door", "guardian_star"],
  continuity: ["tree", "roots", "rings", "river", "thread", "vine", "spiral"],
  unity: ["knot", "joined_branches", "ring", "woven_cord", "clasp", "bridge"],
  memory: ["candle", "lantern", "book", "archive_box", "star", "photograph_frame"],
  gratitude: ["laurel", "open_hands", "ribbon", "hearth", "morning_star", "vessel"],
  resilience: ["mountain", "oak", "anchor", "ridge", "stone_path", "flame"],
  wisdom: ["book", "owl_silhouette", "compass", "lamp", "quill", "scroll"],
  guidance: ["compass", "north_star", "lantern", "path", "lighthouse", "open_gate"],
  growth: ["tree", "seedling", "vine", "branch", "sunburst", "rings"],
  sacrifice: ["flame", "candle", "clasped_hands", "bridge", "shield", "stone"],
  love: ["heart_knot", "joined_branches", "hearth", "ring", "woven_cord", "open_hands"],
  journey: ["compass", "mountain", "path", "wave", "anchor", "north_star"],
  belonging: ["home", "gate", "hearth", "joined_branches", "circle", "bridge"],
  craftsmanship: ["hammer_mark", "chisel_line", "woven_cord", "maker_seal", "compass", "book"],
  faith_devotion: ["candle", "lamp", "star", "chapel_window", "open_hands", "path"],
  home: ["hearth", "key", "door", "gate", "roofline", "oak_door"],
  legacy: ["tree", "roots", "book", "laurel", "seal", "archive_box"],
  renewal: ["seedling", "sunrise", "river", "branch", "spiral", "open_gate"]
};

export const CREST_FRAMES: CrestFrameComponent[] = [
  component("classic_shield_frame", "outer_frame", "Classic Shield Frame", ["protection", "legacy"], ["classic", "archive"], "shield_frame", 8, {
    frame_family: "shield"
  }),
  component("arched_shield_frame", "outer_frame", "Arched Shield Frame", ["home", "belonging"], ["classic", "soft"], "shield_frame", 7, {
    frame_family: "shield"
  }),
  component("legacy_seal_frame", "outer_frame", "Legacy Seal Frame", ["gratitude", "memory"], ["seal", "recognition"], "seal_frame", 6, {
    frame_family: "seal"
  }),
  component("botanical_crest_frame", "outer_frame", "Botanical Crest Frame", ["continuity", "growth"], ["botanical", "lineage"], "botanical_frame", 6, {
    frame_family: "botanical"
  }),
  component("memory_lantern_frame", "outer_frame", "Memory Lantern Frame", ["memory", "guidance"], ["memorial", "light"], "lantern_frame", 4, {
    frame_family: "lantern"
  }),
  component("compass_journey_frame", "outer_frame", "Compass Journey Frame", ["journey", "guidance"], ["compass", "direction"], "compass_frame", 5, {
    frame_family: "compass"
  }),
  component("book_archive_frame", "outer_frame", "Book Archive Frame", ["wisdom", "legacy"], ["book", "archive"], "book_frame", 4, {
    frame_family: "book"
  }),
  component("mountain_resilience_frame", "outer_frame", "Mountain Resilience Frame", ["resilience", "journey"], ["mountain", "strong"], "mountain_frame", 5, {
    frame_family: "mountain"
  }),
  component("key_protection_frame", "outer_frame", "Key Protection Frame", ["protection", "home"], ["key", "home"], "key_frame", 4, {
    frame_family: "key"
  }),
  component("minimal_luxury_frame", "outer_frame", "Minimal Luxury Frame", ["belonging", "craftsmanship"], ["modern", "minimal"], "shield_frame", 5, {
    frame_family: "monogram"
  })
];

export const FIELD_LAYOUTS: FieldLayoutComponent[] = [
  component("single_archive_field", "field_layout", "Single Archive Field", CORE_MEANING_THEMES, ["quiet"], "field_layout", 10, {
    layout_family: "single"
  }),
  component("rooted_field", "field_layout", "Rooted Field", ["continuity", "legacy", "growth"], ["rooted"], "field_layout", 7, {
    layout_family: "rooted"
  }),
  component("horizon_field", "field_layout", "Horizon Field", ["journey", "resilience", "renewal"], ["horizon"], "field_layout", 6, {
    layout_family: "horizon"
  }),
  component("arched_archive_panel", "field_layout", "Arched Archive Panel", ["memory", "wisdom", "home"], ["archive"], "field_layout", 6, {
    layout_family: "archive_panel"
  })
];

export const PRIMARY_SYMBOLS: PrimarySymbolComponent[] = [
  symbol("tree", ["continuity", "growth", "legacy"], "tree_symbol", 10),
  symbol("lantern", ["memory", "guidance", "faith_devotion"], "lantern_symbol", 7),
  symbol("book", ["wisdom", "memory", "legacy"], "book_symbol", 7),
  symbol("mountain", ["resilience", "journey"], "mountain_symbol", 7),
  symbol("key", ["protection", "home"], "key_symbol", 6),
  symbol("compass", ["journey", "guidance", "wisdom"], "compass_symbol", 7),
  symbol("laurel", ["gratitude", "legacy"], "laurel_symbol", 6),
  symbol("hearth", ["home", "love", "belonging"], "hearth_symbol", 5)
];

export const SECONDARY_SYMBOLS: SecondarySymbolComponent[] = [
  secondary("knot", ["unity", "love", "continuity"], "knot_symbol", 9),
  secondary("roots", ["continuity", "legacy", "growth"], "root_symbol", 8),
  secondary("ring", ["unity", "love", "legacy"], "knot_symbol", 7),
  secondary("north_star", ["guidance", "journey", "memory"], "star_symbol", 7),
  secondary("branch", ["growth", "renewal", "belonging"], "laurel_or_branch", 7),
  secondary("shield", ["protection", "sacrifice"], "shield_mark", 8),
  secondary("ribbon", ["gratitude", "legacy"], "ribbon_plaque", 4),
  secondary("bridge", ["unity", "journey", "belonging"], "bridge_symbol", 5),
  secondary("candle", ["memory", "sacrifice", "faith_devotion"], "lantern_symbol", 5),
  secondary("woven_cord", ["unity", "craftsmanship", "love"], "knot_symbol", 6)
];

export const ORNAMENTS: OrnamentComponent[] = [
  component("quiet_laurel_sides", "ornament", "Quiet Laurel Sides", ["gratitude", "legacy"], ["laurel"], "laurel_or_branch", 7, {
    ornament_family: "laurel"
  }),
  component("branch_side_marks", "ornament", "Branch Side Marks", ["growth", "renewal"], ["botanical"], "laurel_or_branch", 7, {
    ornament_family: "branch"
  }),
  component("archive_corner_ticks", "ornament", "Archive Corner Ticks", ["memory", "craftsmanship"], ["archive"], "corner_ticks", 6, {
    ornament_family: "archive_tick"
  }),
  component("woven_border_marks", "ornament", "Woven Border Marks", ["unity", "craftsmanship"], ["woven"], "woven_border", 5, {
    ornament_family: "woven_border"
  })
];

export const RIBBONS: RibbonComponent[] = [
  component("quiet_gold_plaque", "ribbon", "Quiet Gold Plaque", CORE_MEANING_THEMES, ["plaque"], "ribbon_plaque", 9, {
    ribbon_family: "plaque"
  }),
  component("archive_base_bar", "ribbon", "Archive Base Bar", ["memory", "legacy"], ["archive"], "ribbon_plaque", 7, {
    ribbon_family: "quiet_bar"
  }),
  component("recognition_ribbon", "ribbon", "Recognition Ribbon", ["gratitude", "love"], ["gift"], "ribbon_plaque", 6, {
    ribbon_family: "ribbon"
  })
];

export const TEXTURES: TextureComponent[] = [
  component("archive_grain_soft", "texture", "Soft Archive Grain", CORE_MEANING_THEMES, ["grain"], "archive_texture", 10, {
    texture_family: "archive_grain"
  }),
  component("diagonal_fiber_subtle", "texture", "Subtle Diagonal Fiber", ["craftsmanship", "memory"], ["fiber"], "archive_texture", 7, {
    texture_family: "diagonal_fiber"
  }),
  component("clean_print_texture", "texture", "Clean Print Texture", ["wisdom", "legacy"], ["print"], "archive_texture", 6, {
    texture_family: "clean_print"
  })
];

export const PALETTES: PaletteComponent[] = [
  palette("black_gold_archive", "Black Gold Archive", "black_gold", "#090807", "#17120d", "#d6aa52", "#e3bd72", "#8f6b36"),
  palette("warm_ivory_gold", "Warm Ivory Gold", "ivory_gold", "#15120e", "#221a12", "#d9bd86", "#f0ddae", "#a88955"),
  palette("print_contrast_gold", "Print Contrast Gold", "print_contrast", "#0b0a08", "#0e0d0b", "#e4bf69", "#f4d98d", "#b08845"),
  palette("soft_archive_gold", "Soft Archive Gold", "warm_archive", "#100d0a", "#20170f", "#cfa65b", "#e2c47d", "#8d6a3e")
];

export const CREST_TEMPLATES: CrestTemplate[] = [
  template("classic_shield_archive", "Classic Shield Archive", ["classic_shield_frame", "arched_shield_frame"], ["protection", "legacy", "continuity"]),
  template("circular_legacy_seal", "Circular Legacy Seal", ["legacy_seal_frame"], ["gratitude", "memory", "legacy"]),
  template("botanical_lineage_crest", "Botanical Lineage Crest", ["botanical_crest_frame", "arched_shield_frame"], ["continuity", "growth", "renewal"]),
  template("memory_lantern_emblem", "Memory Lantern Emblem", ["memory_lantern_frame", "legacy_seal_frame"], ["memory", "guidance"]),
  template("compass_journey_emblem", "Compass / Journey Emblem", ["compass_journey_frame"], ["journey", "guidance"]),
  template("book_wisdom_archive", "Book / Wisdom Archive", ["book_archive_frame"], ["wisdom", "memory"]),
  template("mountain_resilience_crest", "Mountain / Resilience Crest", ["mountain_resilience_frame"], ["resilience", "journey"]),
  template("key_protection_emblem", "Key / Protection Emblem", ["key_protection_frame", "classic_shield_frame"], ["protection", "home"]),
  template("laurel_recognition_seal", "Laurel Recognition Seal", ["legacy_seal_frame"], ["gratitude", "love"]),
  template("minimal_luxury_monogram", "Minimal Luxury Monogram", ["minimal_luxury_frame"], ["craftsmanship", "belonging"]),
  template("gothic_archive_crest", "Gothic Archive Crest", ["classic_shield_frame"], ["legacy", "memory"]),
  template("modern_black_gold_symbolic_crest", "Modern Black-Gold Symbolic Crest", ["minimal_luxury_frame", "arched_shield_frame"], ["belonging", "home"])
];

export function getSymbolFamiliesForThemes(themes: CrestMeaningTheme[]): string[] {
  return [...new Set(themes.flatMap((theme) => SYMBOL_TAXONOMY[theme] ?? []))];
}

function symbol(id: string, themes: CrestMeaningTheme[], generator: string, rarity: number): PrimarySymbolComponent {
  return {
    id,
    category: "primary_symbol",
    display_name: title(id),
    meaning_tags: themes,
    style_tags: ["symbolic"],
    compatible_positions: ["center"],
    rarity_weight: rarity,
    svg_generator_id: generator,
    visual_weight: rarity,
    constraints: { max_per_crest: 1 },
    active: true,
    symbol_family: id
  };
}

function secondary(id: string, themes: CrestMeaningTheme[], generator: string, rarity: number): SecondarySymbolComponent {
  return {
    id,
    category: "secondary_symbol",
    display_name: title(id),
    meaning_tags: themes,
    style_tags: ["supporting"],
    compatible_positions: ["support", "base", "field"],
    rarity_weight: rarity,
    svg_generator_id: generator,
    visual_weight: Math.max(1, rarity - 2),
    constraints: { max_per_crest: 2 },
    active: true,
    symbol_family: id
  };
}

function palette(
  id: string,
  displayName: string,
  family: PaletteComponent["palette_family"],
  background: string,
  field: string,
  stroke: string,
  accent: string,
  muted: string
): PaletteComponent {
  return {
    id,
    category: "palette",
    display_name: displayName,
    meaning_tags: CORE_MEANING_THEMES,
    style_tags: [family],
    compatible_positions: ["global"],
    rarity_weight: 8,
    svg_generator_id: "palette",
    visual_weight: 1,
    constraints: {},
    active: true,
    palette_family: family,
    colors: { background, field, stroke, accent, muted }
  };
}

function template(id: string, displayName: string, frames: string[], themes: CrestMeaningTheme[]): CrestTemplate {
  return {
    id,
    display_name: displayName,
    style_family: displayName,
    preferred_frames: frames,
    preferred_layouts: ["single_archive_field", "rooted_field", "horizon_field", "arched_archive_panel"],
    preferred_ornaments: ["quiet_laurel_sides", "branch_side_marks", "archive_corner_ticks", "woven_border_marks"],
    preferred_ribbons: ["quiet_gold_plaque", "archive_base_bar", "recognition_ribbon"],
    preferred_textures: ["archive_grain_soft", "diagonal_fiber_subtle", "clean_print_texture"],
    preferred_palettes: ["black_gold_archive", "warm_ivory_gold", "print_contrast_gold", "soft_archive_gold"],
    meaning_tags: themes,
    active: true
  };
}

function component<T extends object>(
  id: string,
  category: CrestFrameComponent["category"],
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
): CrestFrameComponent & T;
function component<T extends object>(
  id: string,
  category: FieldLayoutComponent["category"],
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
): FieldLayoutComponent & T;
function component<T extends object>(
  id: string,
  category: OrnamentComponent["category"],
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
): OrnamentComponent & T;
function component<T extends object>(
  id: string,
  category: RibbonComponent["category"],
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
): RibbonComponent & T;
function component<T extends object>(
  id: string,
  category: TextureComponent["category"],
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
): TextureComponent & T;
function component<T extends object>(
  id: string,
  category: "outer_frame" | "field_layout" | "ornament" | "ribbon" | "texture",
  displayName: string,
  themes: CrestMeaningTheme[],
  styleTags: string[],
  generator: string,
  rarityWeight: number,
  extra: T
) {
  return {
    id,
    category,
    display_name: displayName,
    meaning_tags: themes,
    style_tags: styleTags,
    compatible_positions: ["center", "support", "border", "base"],
    rarity_weight: rarityWeight,
    svg_generator_id: generator,
    visual_weight: Math.max(1, Math.min(10, rarityWeight)),
    constraints: {},
    active: true,
    ...extra
  };
}

function title(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
