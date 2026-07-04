import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";

import {
  CREST_FRAMES,
  CREST_TEMPLATES,
  FIELD_LAYOUTS,
  getSymbolFamiliesForThemes,
  ORNAMENTS,
  PALETTES,
  PRIMARY_SYMBOLS,
  RIBBONS,
  SECONDARY_SYMBOLS,
  SYMBOL_TAXONOMY,
  TEXTURES
} from "./taxonomy";
import type {
  CrestComposerInput,
  CrestGenomeManifest,
  CrestGenomeOutput,
  CrestMeaningTheme,
  CrestQualityReport,
  PaletteComponent
} from "./types";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const CANVAS_SIZE = 640;
const MAX_SUPPORTING_SYMBOLS = 2;
const PROHIBITED_SYMBOLS = new Set(["random_line", "mechanical_mask", "sci_fi_insignia", "game_clan_mark"]);

interface RenderPlan {
  manifest: CrestGenomeManifest;
  frameFamily: string;
  primarySymbol: string;
  secondarySymbols: string[];
  ornamentIds: string[];
  palette: PaletteComponent;
  transparent: boolean;
  variant: "primary" | "close" | "print" | "transparent";
  seedNumber: number;
}

interface PngMetadata {
  width: number;
  height: number;
  has_alpha: boolean;
  has_transparent_pixels: boolean;
  text: string;
}

export function composeCrestGenome(input: CrestComposerInput): CrestGenomeOutput {
  const themes = normalizeThemes(input.meaning_themes);
  const seedSalt = input.seed_salt ?? stableHash(`${input.order_seed}:crest-genome:v1`).slice(0, 16);
  const rng = createRng(`${input.order_seed}:${seedSalt}:${themes.join(",")}:${input.style_preference ?? ""}`);
  const symbolFamilies = getSymbolFamiliesForThemes(themes);
  const requestedSymbols = normalizeSymbols(input.selected_symbols ?? []);
  const template = selectWeighted(
    CREST_TEMPLATES.filter((item) => item.active),
    (item) => scoreTags(item.meaning_tags, themes) + (input.style_preference && item.id.includes(slug(input.style_preference)) ? 8 : 0),
    rng
  );
  const frame = selectWeighted(
    CREST_FRAMES.filter((item) => item.active && template.preferred_frames.includes(item.id)),
    (item) => scoreTags(item.meaning_tags, themes) + item.rarity_weight,
    rng
  );
  const field = selectWeighted(
    FIELD_LAYOUTS.filter((item) => item.active && template.preferred_layouts.includes(item.id)),
    (item) => scoreTags(item.meaning_tags, themes) + item.rarity_weight,
    rng
  );
  const primary = selectPrimarySymbol(requestedSymbols, symbolFamilies, themes, rng);
  const secondary = selectSecondarySymbols(requestedSymbols, symbolFamilies, themes, primary.id, rng);
  const ornaments = selectManyWeighted(
    ORNAMENTS.filter((item) => item.active && template.preferred_ornaments.includes(item.id)),
    1 + Math.floor(rng() * 2),
    (item) => scoreTags(item.meaning_tags, themes) + item.rarity_weight,
    rng
  );
  const ribbon = selectWeighted(
    RIBBONS.filter((item) => item.active && template.preferred_ribbons.includes(item.id)),
    (item) => scoreTags(item.meaning_tags, themes) + item.rarity_weight,
    rng
  );
  const texture = selectWeighted(
    TEXTURES.filter((item) => item.active && template.preferred_textures.includes(item.id)),
    (item) => scoreTags(item.meaning_tags, themes) + item.rarity_weight,
    rng
  );
  const palette = selectWeighted(
    PALETTES.filter((item) => item.active && template.preferred_palettes.includes(item.id)),
    (item) => item.rarity_weight + (input.variant === "print" && item.palette_family === "print_contrast" ? 10 : 0),
    rng
  );
  const lineStyleId = input.variant === "print" ? "line_bold_print" : input.variant === "close" ? "line_clean_close" : "line_archive_gold";
  const signatureInput = [
    template.id,
    frame.id,
    field.id,
    primary.id,
    secondary.map((item) => item.id).join(","),
    ornaments.map((item) => item.id).join(","),
    palette.id,
    texture.id,
    lineStyleId,
    seedSalt
  ].join("|");
  const visualSignature = stableHash(signatureInput);
  const generatedAt = "2026-07-04T00:00:00.000Z";
  const manifest: CrestGenomeManifest = {
    schema_version: "crest_genome_manifest.v1",
    generated_at: generatedAt,
    template_id: template.id,
    frame_id: frame.id,
    field_layout_id: field.id,
    primary_symbol_id: primary.id,
    secondary_symbol_ids: secondary.map((item) => item.id),
    ornament_ids: ornaments.map((item) => item.id),
    ribbon_id: ribbon.id,
    texture_id: texture.id,
    palette_id: palette.id,
    line_style_id: lineStyleId,
    meaning_themes: themes,
    seed_salt: seedSalt,
    visual_signature: visualSignature,
    uniqueness_input_hash: stableHash(signatureInput).slice(0, 32),
    metadata: {
      artwork_system: "crest_genome_library",
      artwork_mode: "deterministic_parametric_composer",
      production_status: "internal_review_only",
      dominant_symbol_rule: "one_main_symbol"
    }
  };
  const variant = input.transparent ? "transparent" : input.variant ?? "primary";
  const plan: RenderPlan = {
    manifest,
    frameFamily: frame.frame_family,
    primarySymbol: primary.id,
    secondarySymbols: secondary.map((item) => item.id),
    ornamentIds: ornaments.map((item) => item.id),
    palette,
    transparent: input.transparent === true,
    variant,
    seedNumber: hashNumber(`${visualSignature}:${variant}`)
  };

  return {
    manifest,
    svg: renderCrestSvg(plan),
    pngBuffer: renderCrestPng({ ...plan, transparent: false }),
    transparentPngBuffer: renderCrestPng({ ...plan, transparent: true, variant: "transparent" }),
    visual_signature: visualSignature
  };
}

export function validateCrestGenomeOutput(output: CrestGenomeOutput, knownSignatures = new Set<string>()): CrestQualityReport {
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  const png = readCrestPngMetadata(output.pngBuffer);
  const transparent = readCrestPngMetadata(output.transparentPngBuffer);

  if (!png) hardFailures.push("png_invalid");
  if (!transparent) hardFailures.push("transparent_png_invalid");
  if (png && (png.width < 512 || png.height < 512)) hardFailures.push("dimensions_too_small");
  if (transparent && !transparent.has_transparent_pixels) hardFailures.push("transparent_png_has_no_alpha");
  if (!output.manifest.primary_symbol_id) hardFailures.push("no_main_symbol");
  if (!output.manifest.frame_id) hardFailures.push("no_frame");
  if (!output.visual_signature) hardFailures.push("visual_signature_missing");
  if (knownSignatures.has(output.visual_signature)) hardFailures.push("duplicate_signature");
  if (output.manifest.secondary_symbol_ids.length > MAX_SUPPORTING_SYMBOLS) hardFailures.push("too_many_symbols");
  if ([output.manifest.primary_symbol_id, ...output.manifest.secondary_symbol_ids].some((symbol) => PROHIBITED_SYMBOLS.has(symbol))) {
    hardFailures.push("random_geometry_used");
  }
  if (output.pngBuffer.equals(output.transparentPngBuffer)) hardFailures.push("variants_identical");
  if (output.manifest.metadata.production_status === "internal_review_only") warnings.push("internal_review_only");
  if (output.manifest.template_id.includes("modern") && output.manifest.secondary_symbol_ids.length === 0) warnings.push("output_too_minimal");
  if (output.manifest.secondary_symbol_ids.length > 1 && output.manifest.ornament_ids.length > 1) warnings.push("output_may_be_visually_dense");

  return {
    passed: hardFailures.length === 0,
    hard_failures: hardFailures,
    warnings
  };
}

export function readCrestPngMetadata(buffer: Buffer): PngMetadata | null {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let text = "";
  const idat: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === "tEXt") {
      text += data.toString("utf8");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  let hasTransparentPixels = false;
  if (colorType === 6 && idat.length > 0) {
    const raw = inflateSync(Buffer.concat(idat));
    const rowLength = width * 4 + 1;
    for (let y = 0; y < height && !hasTransparentPixels; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = raw[y * rowLength + 1 + x * 4 + 3] ?? 255;
        if (alpha < 255) {
          hasTransparentPixels = true;
          break;
        }
      }
    }
  }
  return {
    width,
    height,
    has_alpha: colorType === 6,
    has_transparent_pixels: hasTransparentPixels,
    text
  };
}

export function createCrestGenomeContactSheet(buffers: Buffer[], columns = 10, cellSize = 180): Buffer {
  const rows = Math.ceil(buffers.length / columns);
  const width = columns * cellSize;
  const height = rows * cellSize;
  const raw = createBlankRaw(width, height, [8, 7, 6, 255]);
  buffers.forEach((buffer, index) => {
    const image = decodePngRgba(buffer);
    if (!image) return;
    const originX = (index % columns) * cellSize;
    const originY = Math.floor(index / columns) * cellSize;
    compositeNearest(raw, width, height, image, originX + 10, originY + 10, cellSize - 20, cellSize - 20);
  });
  return encodePng(width, height, raw, "MyKinLegacy Crest Genome contact sheet");
}

function renderCrestSvg(plan: RenderPlan): string {
  const colors = plan.palette.colors;
  const secondary = plan.secondarySymbols.join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="MyKinLegacy crest genome sample">
  <rect width="640" height="640" fill="${plan.transparent ? "none" : colors.background}"/>
  <path d="${shieldPath(plan.frameFamily)}" fill="${colors.field}" stroke="${colors.stroke}" stroke-width="10"/>
  <path d="${shieldPath(plan.frameFamily, 30)}" fill="none" stroke="${colors.muted}" stroke-width="3"/>
  ${svgPrimarySymbol(plan.primarySymbol, colors)}
  ${plan.secondarySymbols.map((symbol, index) => svgSecondarySymbol(symbol, colors, index)).join("\n  ")}
  ${plan.ornamentIds.includes("quiet_laurel_sides") || plan.ornamentIds.includes("branch_side_marks") ? svgLaurel(colors) : ""}
  <path d="M214 522 L426 522 L448 548 L426 574 L214 574 L192 548 Z" fill="#24170f" stroke="${colors.stroke}" stroke-width="4"/>
  <metadata>visual_signature=${plan.manifest.visual_signature}; template=${plan.manifest.template_id}; main=${plan.primarySymbol}; secondary=${secondary}</metadata>
</svg>`;
}

function renderCrestPng(plan: RenderPlan): Buffer {
  const width = CANVAS_SIZE;
  const height = CANVAS_SIZE;
  const colors = toRgbPalette(plan.palette);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const texture = textureValue(x, y, plan.seedNumber);
      const shield = inFrame(x, y, plan.frameFamily, plan.variant);
      const border = shield && !inFrame(x, y, plan.frameFamily, plan.variant, 11);
      const innerBorder = inFrame(x, y, plan.frameFamily, plan.variant, 34) && !inFrame(x, y, plan.frameFamily, plan.variant, 39);
      const primary = inPrimarySymbol(x, y, plan.primarySymbol, plan.variant);
      const secondary = inSecondarySymbols(x, y, plan.secondarySymbols, plan.variant);
      const ornament = inOrnaments(x, y, plan.ornamentIds, plan.variant);
      const plaque = inPlaque(x, y, plan.variant);
      const plaqueFill = inPlaqueFill(x, y, plan.variant);
      if (!shield && plan.transparent) {
        writeRgba(raw, offset, 0, 0, 0, 0);
      } else if (border || primary || secondary || ornament || plaque) {
        writeRgba(raw, offset, ...jitter(colors.accent, texture, 14), 255);
      } else if (innerBorder) {
        writeRgba(raw, offset, ...jitter(colors.muted, texture, 9), 255);
      } else if (plaqueFill) {
        writeRgba(raw, offset, 37, 25, 15, 255);
      } else if (shield) {
        writeRgba(raw, offset, ...jitter(colors.field, texture, 8), 255);
      } else {
        const vignette = Math.min(38, Math.hypot(x - 320, y - 320) / 12);
        writeRgba(raw, offset, ...shade(jitter(colors.background, texture, 5), -vignette), 255);
      }
    }
  }
  const text = [
    "MyKinLegacy Crest Genome internal review sample",
    `artwork_system=crest_genome_library`,
    `artwork_mode=deterministic_parametric_composer`,
    `production_status=internal_review_only`,
    `template_id=${plan.manifest.template_id}`,
    `frame_id=${plan.manifest.frame_id}`,
    `main_symbol=${plan.manifest.primary_symbol_id}`,
    `supporting_symbols=${plan.manifest.secondary_symbol_ids.join(",")}`,
    `themes=${plan.manifest.meaning_themes.join(",")}`,
    `visual_signature=${plan.manifest.visual_signature}`
  ].join("; ");
  return encodePng(width, height, raw, text);
}

function selectPrimarySymbol(requested: string[], mappedFamilies: string[], themes: CrestMeaningTheme[], rng: () => number) {
  const requestedPrimary = PRIMARY_SYMBOLS.find((item) => requested.includes(item.id));
  if (requestedPrimary) return requestedPrimary;
  return selectWeighted(
    PRIMARY_SYMBOLS.filter((item) => item.active),
    (item) => scoreTags(item.meaning_tags, themes) + (mappedFamilies.includes(item.id) ? 12 : 0) + item.rarity_weight,
    rng
  );
}

function selectSecondarySymbols(
  requested: string[],
  mappedFamilies: string[],
  themes: CrestMeaningTheme[],
  primaryId: string,
  rng: () => number
) {
  const candidates = SECONDARY_SYMBOLS.filter(
    (item) => item.active && item.id !== primaryId && (requested.includes(item.id) || mappedFamilies.includes(item.id) || scoreTags(item.meaning_tags, themes) > 0)
  );
  return selectManyWeighted(candidates, Math.min(MAX_SUPPORTING_SYMBOLS, Math.max(1, Math.floor(rng() * 3))), (item) => {
    return scoreTags(item.meaning_tags, themes) + (requested.includes(item.id) ? 12 : 0) + item.rarity_weight;
  }, rng);
}

function normalizeThemes(themes: CrestMeaningTheme[]): CrestMeaningTheme[] {
  const supported = new Set(Object.keys(SYMBOL_TAXONOMY));
  const normalized = themes.filter((theme) => supported.has(theme));
  const fallback: CrestMeaningTheme[] = ["legacy", "continuity", "unity"];
  return [...new Set(normalized.length > 0 ? normalized : fallback)];
}

function normalizeSymbols(symbols: string[]): string[] {
  return symbols.map((symbol) => slug(symbol)).filter((symbol) => !PROHIBITED_SYMBOLS.has(symbol));
}

function scoreTags(componentTags: CrestMeaningTheme[], themes: CrestMeaningTheme[]): number {
  return componentTags.reduce((score, tag) => score + (themes.includes(tag) ? 10 : 0), 0);
}

function selectWeighted<T>(items: T[], score: (item: T) => number, rng: () => number): T {
  if (items.length === 0) throw new Error("Cannot select from an empty Crest Genome component set.");
  const weighted = items.map((item) => ({ item, weight: Math.max(1, score(item)) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.item;
  }
  return weighted[weighted.length - 1]!.item;
}

function selectManyWeighted<T extends { id: string }>(items: T[], count: number, score: (item: T) => number, rng: () => number): T[] {
  const selected: T[] = [];
  let remaining = [...items];
  for (let index = 0; index < count && remaining.length > 0; index += 1) {
    const picked = selectWeighted(remaining, score, rng);
    selected.push(picked);
    remaining = remaining.filter((item) => item.id !== picked.id);
  }
  return selected;
}

function createRng(seed: string): () => number {
  let state = hashNumber(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashNumber(value: string): number {
  return parseInt(stableHash(value).slice(0, 8), 16);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function shieldPath(frameFamily: string, inset = 0): string {
  if (frameFamily === "seal") {
    const r = 220 - inset;
    return `M320 ${100 + inset} A${r} ${r} 0 1 1 319.9 ${100 + inset} Z`;
  }
  if (frameFamily === "compass") {
    return `M320 ${76 + inset} L520 320 L320 ${590 - inset} L120 320 Z`;
  }
  if (frameFamily === "book") {
    return `M156 ${92 + inset} Q320 ${52 + inset} 484 ${92 + inset} L484 ${546 - inset} Q320 ${506 - inset} 156 ${546 - inset} Z`;
  }
  if (frameFamily === "lantern") {
    return `M230 ${88 + inset} L410 ${88 + inset} Q468 ${170 + inset} 450 520 L320 ${590 - inset} L190 520 Q172 ${170 + inset} 230 ${88 + inset} Z`;
  }
  return `M164 ${84 + inset} L476 ${84 + inset} Q500 ${260 + inset} 454 ${472 - inset} Q400 ${552 - inset} 320 ${592 - inset} Q240 ${552 - inset} 186 ${472 - inset} Q140 ${260 + inset} 164 ${84 + inset} Z`;
}

function svgPrimarySymbol(symbol: string, colors: PaletteComponent["colors"]): string {
  if (symbol === "book") {
    return `<path d="M214 236 Q284 214 320 254 Q356 214 426 236 L426 430 Q356 404 320 438 Q284 404 214 430 Z" fill="none" stroke="${colors.accent}" stroke-width="12"/>`;
  }
  if (symbol === "mountain") {
    return `<path d="M172 420 L272 260 L330 356 L374 296 L476 420 Z" fill="none" stroke="${colors.accent}" stroke-width="13"/>`;
  }
  if (symbol === "key") {
    return `<circle cx="278" cy="292" r="50" fill="none" stroke="${colors.accent}" stroke-width="12"/><path d="M322 326 L444 448 M392 396 L430 358 M416 420 L450 386" stroke="${colors.accent}" stroke-width="14" stroke-linecap="round"/>`;
  }
  if (symbol === "compass") {
    return `<circle cx="320" cy="334" r="118" fill="none" stroke="${colors.accent}" stroke-width="8"/><path d="M320 186 L354 334 L320 482 L286 334 Z" fill="none" stroke="${colors.accent}" stroke-width="11"/>`;
  }
  if (symbol === "lantern" || symbol === "hearth") {
    return `<path d="M250 250 Q320 202 390 250 L376 432 Q320 470 264 432 Z" fill="none" stroke="${colors.accent}" stroke-width="11"/><path d="M320 286 Q354 340 320 392 Q286 340 320 286 Z" fill="none" stroke="${colors.accent}" stroke-width="9"/>`;
  }
  if (symbol === "laurel") {
    return svgLaurel(colors);
  }
  return `<path d="M320 214 C296 270 292 330 320 438 C348 330 344 270 320 214 Z" fill="${colors.accent}"/><path d="M320 270 C256 238 214 274 194 324 C256 326 304 316 320 270 Z" fill="none" stroke="${colors.accent}" stroke-width="11"/><path d="M320 270 C384 238 426 274 446 324 C384 326 336 316 320 270 Z" fill="none" stroke="${colors.accent}" stroke-width="11"/><path d="M320 404 C286 452 260 470 224 476 M320 404 C354 452 380 470 416 476" stroke="${colors.accent}" stroke-width="9" stroke-linecap="round"/>`;
}

function svgSecondarySymbol(symbol: string, colors: PaletteComponent["colors"], index: number): string {
  const y = index === 0 ? 476 : 176;
  if (symbol.includes("star")) {
    return `<path d="M320 ${y - 36} L332 ${y - 8} L362 ${y - 8} L338 ${y + 10} L348 ${y + 40} L320 ${y + 22} L292 ${y + 40} L302 ${y + 10} L278 ${y - 8} L308 ${y - 8} Z" fill="${colors.accent}"/>`;
  }
  if (symbol.includes("bridge")) {
    return `<path d="M238 ${y + 18} Q320 ${y - 44} 402 ${y + 18}" fill="none" stroke="${colors.accent}" stroke-width="9"/><path d="M250 ${y + 22} L390 ${y + 22}" stroke="${colors.accent}" stroke-width="7"/>`;
  }
  return `<ellipse cx="320" cy="${y}" rx="64" ry="28" fill="none" stroke="${colors.accent}" stroke-width="9"/><ellipse cx="320" cy="${y}" rx="28" ry="64" fill="none" stroke="${colors.accent}" stroke-width="9"/>`;
}

function svgLaurel(colors: PaletteComponent["colors"]): string {
  return `<path d="M170 410 C126 338 132 246 194 174 M470 410 C514 338 508 246 446 174" fill="none" stroke="${colors.muted}" stroke-width="8"/><g fill="${colors.accent}"><ellipse cx="178" cy="364" rx="12" ry="23" transform="rotate(-28 178 364)"/><ellipse cx="164" cy="318" rx="12" ry="23" transform="rotate(-18 164 318)"/><ellipse cx="170" cy="270" rx="12" ry="23" transform="rotate(4 170 270)"/><ellipse cx="190" cy="224" rx="12" ry="23" transform="rotate(20 190 224)"/><ellipse cx="462" cy="364" rx="12" ry="23" transform="rotate(28 462 364)"/><ellipse cx="476" cy="318" rx="12" ry="23" transform="rotate(18 476 318)"/><ellipse cx="470" cy="270" rx="12" ry="23" transform="rotate(-4 470 270)"/><ellipse cx="450" cy="224" rx="12" ry="23" transform="rotate(-20 450 224)"/></g>`;
}

function inFrame(x: number, y: number, frameFamily: string, variant: string, inset = 0): boolean {
  const cx = 320;
  const cy = frameFamily === "seal" ? 320 : 330;
  const closeScale = variant === "close" ? 1.08 : 1;
  if (frameFamily === "seal") {
    return Math.hypot(x - cx, y - cy) <= (222 - inset) * closeScale;
  }
  if (frameFamily === "compass") {
    return Math.abs(x - cx) / (210 - inset) + Math.abs(y - cy) / (252 - inset) <= closeScale;
  }
  if (frameFamily === "book") {
    return x >= 150 + inset && x <= 490 - inset && y >= 86 + inset && y <= 552 - inset;
  }
  const top = 76 + inset;
  const bottom = 590 - inset;
  if (y < top || y > bottom) return false;
  const t = (y - top) / (bottom - top);
  const half = (162 + 36 * Math.sin(t * Math.PI) - 72 * Math.max(0, t - 0.48)) * closeScale - inset;
  return Math.abs(x - cx) <= half;
}

function inPrimarySymbol(x: number, y: number, symbol: string, variant: string): boolean {
  const scale = variant === "close" ? 1.12 : variant === "print" ? 1.03 : 1;
  if (symbol === "book") return bookShape(x, y, scale);
  if (symbol === "mountain") return mountainShape(x, y, scale);
  if (symbol === "key") return keyShape(x, y, scale);
  if (symbol === "compass") return compassShape(x, y, scale);
  if (symbol === "lantern" || symbol === "hearth") return lanternShape(x, y, scale);
  if (symbol === "laurel") return laurelShape(x, y);
  return treeShape(x, y, scale);
}

function inSecondarySymbols(x: number, y: number, symbols: string[], variant: string): boolean {
  return symbols.some((symbol, index) => {
    const cy = index === 0 ? 476 : 178;
    if (symbol.includes("star")) return starShape(x, y, 320, cy, 32);
    if (symbol.includes("bridge")) return Math.abs(y - (cy + 18 + Math.pow(x - 320, 2) / -5500)) < 5 && x > 240 && x < 400;
    const rx = variant === "close" ? 54 : 64;
    const ring1 = Math.abs((Math.pow((x - 320) / rx, 2) + Math.pow((y - cy) / 26, 2)) - 1) < 0.12;
    const ring2 = Math.abs((Math.pow((x - 320) / 26, 2) + Math.pow((y - cy) / rx, 2)) - 1) < 0.12;
    return ring1 || ring2;
  });
}

function inOrnaments(x: number, y: number, ornaments: string[], variant: string): boolean {
  if (variant === "close") return false;
  if (ornaments.includes("quiet_laurel_sides") || ornaments.includes("branch_side_marks")) return laurelShape(x, y);
  if (ornaments.includes("archive_corner_ticks")) {
    return (Math.abs(x - 206) < 4 || Math.abs(x - 434) < 4) && (y > 126 && y < 178);
  }
  return false;
}

function treeShape(x: number, y: number, scale: number): boolean {
  const cx = 320;
  const trunk = Math.abs(x - cx) < 14 * scale && y > 260 && y < 432;
  const leftLeaf = ellipse(x, y, 272, 292, 80 * scale, 48 * scale);
  const rightLeaf = ellipse(x, y, 368, 292, 80 * scale, 48 * scale);
  const topLeaf = ellipse(x, y, 320, 238, 58 * scale, 74 * scale);
  const branchLeft = Math.abs(y - (360 - (x - 236) * 0.32)) < 5 && x > 230 && x < 320;
  const branchRight = Math.abs(y - (258 + (x - 320) * 0.38)) < 5 && x > 320 && x < 438;
  const roots = (Math.abs(y - (432 + Math.abs(x - cx) * 0.24)) < 6 && Math.abs(x - cx) < 104) || ellipse(x, y, 320, 472, 46, 16);
  return trunk || leftLeaf || rightLeaf || topLeaf || branchLeft || branchRight || roots;
}

function bookShape(x: number, y: number, scale: number): boolean {
  return (
    (x > 210 && x < 320 && y > 238 && y < 432 && Math.abs(y - (430 - (x - 210) * 0.16)) < 10 * scale) ||
    (x > 320 && x < 430 && y > 238 && y < 432 && Math.abs(y - (412 + (x - 320) * 0.16)) < 10 * scale) ||
    (Math.abs(x - 320) < 7 && y > 250 && y < 430)
  );
}

function mountainShape(x: number, y: number, scale: number): boolean {
  const left = Math.abs(y - (420 - (x - 180) * 1.52)) < 7 * scale && x > 180 && x < 276;
  const down = Math.abs(y - (274 + (x - 276) * 1.16)) < 7 * scale && x > 276 && x < 402;
  const right = Math.abs(y - (420 - (456 - x) * 1.32)) < 7 * scale && x > 356 && x < 456;
  const base = Math.abs(y - 420) < 7 && x > 178 && x < 462;
  return left || down || right || base;
}

function keyShape(x: number, y: number, scale: number): boolean {
  const ring = Math.abs(Math.hypot(x - 278, y - 292) - 50 * scale) < 7;
  const shaft = Math.abs(y - (326 + (x - 322) * 1.0)) < 8 && x > 316 && x < 446;
  const tooth1 = Math.abs(y - (398 - (x - 392) * 1.0)) < 7 && x > 388 && x < 432;
  const tooth2 = Math.abs(y - (422 - (x - 414) * 1.0)) < 7 && x > 410 && x < 452;
  return ring || shaft || tooth1 || tooth2;
}

function compassShape(x: number, y: number, scale: number): boolean {
  const ring = Math.abs(Math.hypot(x - 320, y - 334) - 118 * scale) < 5;
  const needle = Math.abs(x - 320) < 20 && y > 188 && y < 482 && Math.abs(x - 320) < 22 - Math.abs(y - 334) * 0.11;
  return ring || needle;
}

function lanternShape(x: number, y: number, scale: number): boolean {
  const body = Math.abs(Math.pow((x - 320) / (78 * scale), 2) + Math.pow((y - 344) / (118 * scale), 2) - 1) < 0.12;
  const flame = Math.pow((x - 320) / 30, 2) + Math.pow((y - 344) / 58, 2) < 1 && y > 284;
  return body || flame;
}

function laurelShape(x: number, y: number): boolean {
  const leftStem = Math.abs(x - (174 + (410 - y) * -0.22)) < 4 && y > 178 && y < 420;
  const rightStem = Math.abs(x - (466 + (410 - y) * 0.22)) < 4 && y > 178 && y < 420;
  const leaf = [230, 278, 326, 374].some((cy) => ellipse(x, y, 184 - (cy - 230) * 0.08, cy, 11, 24) || ellipse(x, y, 456 + (cy - 230) * 0.08, cy, 11, 24));
  return leftStem || rightStem || leaf;
}

function inPlaque(x: number, y: number, variant: string): boolean {
  if (variant === "close") return false;
  return x > 194 && x < 446 && y > 520 && y < 576 && (Math.abs(y - 522) < 5 || Math.abs(y - 574) < 5 || Math.abs(x - 202) < 5 || Math.abs(x - 438) < 5);
}

function inPlaqueFill(x: number, y: number, variant: string): boolean {
  return variant !== "close" && x > 206 && x < 434 && y > 528 && y < 568;
}

function starShape(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const d = Math.hypot(x - cx, y - cy);
  const angle = Math.atan2(y - cy, x - cx);
  const radius = r * (0.72 + 0.28 * Math.cos(5 * angle));
  return d < radius && d > radius - 8;
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const value = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
  return value < 1 && value > 0.76;
}

function textureValue(x: number, y: number, seed: number): number {
  return (x * 17 + y * 31 + seed + ((x ^ y) % 19)) % 43;
}

function toRgbPalette(palette: PaletteComponent) {
  return {
    background: hexToRgb(palette.colors.background),
    field: hexToRgb(palette.colors.field),
    stroke: hexToRgb(palette.colors.stroke),
    accent: hexToRgb(palette.colors.accent),
    muted: hexToRgb(palette.colors.muted)
  };
}

function hexToRgb(value: string): [number, number, number] {
  const clean = value.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function jitter(color: [number, number, number], texture: number, amount: number): [number, number, number] {
  return [clamp(color[0] + (texture % amount)), clamp(color[1] + (texture % Math.max(2, amount - 3))), clamp(color[2] + (texture % Math.max(2, amount - 5)))];
}

function shade(color: [number, number, number], amount: number): [number, number, number] {
  return [clamp(color[0] + amount), clamp(color[1] + amount), clamp(color[2] + amount)];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function writeRgba(raw: Buffer, offset: number, r: number, g: number, b: number, a: number): void {
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
  raw[offset + 3] = a;
}

function createBlankRaw(width: number, height: number, color: [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      writeRgba(raw, rowOffset + 1 + x * 4, color[0], color[1], color[2], color[3]);
    }
  }
  return raw;
}

function encodePng(width: number, height: number, raw: Buffer, text: string): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", Buffer.from(`Description\0${text}`, "utf8")),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function decodePngRgba(buffer: Buffer): { width: number; height: number; raw: Buffer } | null {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  const chunks: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  return { width, height, raw: inflateSync(Buffer.concat(chunks)) };
}

function compositeNearest(
  target: Buffer,
  targetWidth: number,
  targetHeight: number,
  source: { width: number; height: number; raw: Buffer },
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  for (let y = 0; y < dh; y += 1) {
    const ty = dy + y;
    if (ty < 0 || ty >= targetHeight) continue;
    const sy = Math.floor((y / dh) * source.height);
    for (let x = 0; x < dw; x += 1) {
      const tx = dx + x;
      if (tx < 0 || tx >= targetWidth) continue;
      const sx = Math.floor((x / dw) * source.width);
      const sourceOffset = sy * (source.width * 4 + 1) + 1 + sx * 4;
      const targetOffset = ty * (targetWidth * 4 + 1) + 1 + tx * 4;
      const alpha = (source.raw[sourceOffset + 3] ?? 255) / 255;
      target[targetOffset] = clamp((source.raw[sourceOffset] ?? 0) * alpha + (target[targetOffset] ?? 0) * (1 - alpha));
      target[targetOffset + 1] = clamp((source.raw[sourceOffset + 1] ?? 0) * alpha + (target[targetOffset + 1] ?? 0) * (1 - alpha));
      target[targetOffset + 2] = clamp((source.raw[sourceOffset + 2] ?? 0) * alpha + (target[targetOffset + 2] ?? 0) * (1 - alpha));
      target[targetOffset + 3] = 255;
    }
  }
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
