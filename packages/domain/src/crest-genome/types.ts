export type CrestMeaningTheme =
  | "protection"
  | "continuity"
  | "unity"
  | "memory"
  | "gratitude"
  | "resilience"
  | "wisdom"
  | "guidance"
  | "growth"
  | "sacrifice"
  | "love"
  | "journey"
  | "belonging"
  | "craftsmanship"
  | "faith_devotion"
  | "home"
  | "legacy"
  | "renewal";

export type CrestComponentCategory =
  | "outer_frame"
  | "field_layout"
  | "primary_symbol"
  | "secondary_symbol"
  | "ornament"
  | "ribbon"
  | "texture"
  | "palette";

export interface CrestComponentConstraints {
  max_per_crest?: number;
  requires?: string[];
  excludes?: string[];
  min_canvas_size?: number;
  notes?: string;
}

export interface CrestBaseComponent {
  id: string;
  category: CrestComponentCategory;
  display_name: string;
  meaning_tags: CrestMeaningTheme[];
  style_tags: string[];
  compatible_positions: string[];
  rarity_weight: number;
  svg_generator_id: string;
  svg_path?: string;
  visual_weight: number;
  constraints: CrestComponentConstraints;
  active: boolean;
}

export interface CrestFrameComponent extends CrestBaseComponent {
  category: "outer_frame";
  frame_family: "shield" | "seal" | "botanical" | "lantern" | "compass" | "book" | "mountain" | "key" | "monogram";
}

export interface FieldLayoutComponent extends CrestBaseComponent {
  category: "field_layout";
  layout_family: "single" | "split" | "arched" | "rooted" | "horizon" | "archive_panel";
}

export interface PrimarySymbolComponent extends CrestBaseComponent {
  category: "primary_symbol";
  symbol_family: string;
}

export interface SecondarySymbolComponent extends CrestBaseComponent {
  category: "secondary_symbol";
  symbol_family: string;
}

export interface OrnamentComponent extends CrestBaseComponent {
  category: "ornament";
  ornament_family: "laurel" | "branch" | "corner" | "dot" | "woven_border" | "archive_tick";
}

export interface RibbonComponent extends CrestBaseComponent {
  category: "ribbon";
  ribbon_family: "plaque" | "ribbon" | "seal_base" | "quiet_bar";
}

export interface TextureComponent extends CrestBaseComponent {
  category: "texture";
  texture_family: "archive_grain" | "soft_vignette" | "diagonal_fiber" | "clean_print";
}

export interface PaletteComponent extends CrestBaseComponent {
  category: "palette";
  palette_family: "black_gold" | "ivory_gold" | "print_contrast" | "warm_archive";
  colors: {
    background: string;
    field: string;
    stroke: string;
    accent: string;
    muted: string;
  };
}

export type CrestGenomeComponent =
  | CrestFrameComponent
  | FieldLayoutComponent
  | PrimarySymbolComponent
  | SecondarySymbolComponent
  | OrnamentComponent
  | RibbonComponent
  | TextureComponent
  | PaletteComponent;

export interface CrestTemplate {
  id: string;
  display_name: string;
  style_family: string;
  preferred_frames: string[];
  preferred_layouts: string[];
  preferred_ornaments: string[];
  preferred_ribbons: string[];
  preferred_textures: string[];
  preferred_palettes: string[];
  meaning_tags: CrestMeaningTheme[];
  active: boolean;
}

export interface CrestComposerInput {
  meaning_themes: CrestMeaningTheme[];
  selected_symbols?: string[];
  style_preference?: string | null;
  order_seed: string;
  seed_salt?: string;
  family_name?: string | null;
  recipient_name?: string | null;
  transparent?: boolean;
  variant?: "primary" | "close" | "print" | "transparent";
}

export interface CrestGenomeManifest {
  schema_version: "crest_genome_manifest.v1";
  generated_at: string;
  template_id: string;
  frame_id: string;
  field_layout_id: string;
  primary_symbol_id: string;
  secondary_symbol_ids: string[];
  ornament_ids: string[];
  ribbon_id: string;
  texture_id: string;
  palette_id: string;
  line_style_id: string;
  meaning_themes: CrestMeaningTheme[];
  seed_salt: string;
  visual_signature: string;
  uniqueness_input_hash: string;
  metadata: {
    artwork_system: "crest_genome_library";
    artwork_mode: "deterministic_parametric_composer";
    production_status: "internal_review_only";
    dominant_symbol_rule: "one_main_symbol";
  };
}

export interface CrestVisualSignature {
  signature: string;
  template_id: string;
  frame_id: string;
  field_layout_id: string;
  primary_symbol_id: string;
  secondary_symbol_ids: string[];
  ornament_ids: string[];
  palette_id: string;
  texture_id: string;
  line_style_id: string;
  seed_salt: string;
}

export interface CrestGenomeOutput {
  manifest: CrestGenomeManifest;
  svg: string;
  pngBuffer: Buffer;
  transparentPngBuffer: Buffer;
  visual_signature: string;
}

export interface CrestQualityReport {
  passed: boolean;
  hard_failures: string[];
  warnings: string[];
}
