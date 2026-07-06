import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

export function createMockPngBuffer(): Buffer {
  return createMvpCrestPngBuffer({
    variant: "mock",
    house_name: "MyKinLegacy",
    symbols: ["shield", "oak", "star"]
  });
}

export function createMvpCrestPngBuffer(input: {
  variant: string;
  house_name?: string;
  symbols?: string[];
  transparent?: boolean;
  prompt_metadata?: {
    prompt_source?: "old_prompt" | "lre_prompt";
    pve_score?: number | null;
    pve_passed?: boolean;
    old_prompt_sha256?: string | null;
    lre_prompt_sha256?: string | null;
    selected_prompt?: string | null;
    negative_prompt?: string | null;
    primary_symbol?: string | null;
    secondary_symbols?: string[];
    selected_dna?: string[];
  };
}): Buffer {
  const width = 640;
  const height = 640;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const seed = hashSeed(`${input.variant}:${input.house_name ?? "house"}:${(input.symbols ?? []).join(",")}`);
  const centerX = width / 2;
  const symbolMapping = resolveSymbolMapping(input.symbols ?? [], input.prompt_metadata);
  const style = resolveCrestVariant(input.variant, input.transparent === true);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const localY = y - style.verticalOffset;
      const half = shieldHalfWidth(localY, style);
      const distanceFromCenter = Math.abs(x - centerX);
      const shield = localY >= style.shieldTop && localY <= style.shieldBottom && distanceFromCenter <= half;
      const innerHalf = Math.max(0, half - style.innerInset);
      const innerField = shield && localY > style.shieldTop + 52 && localY < style.shieldBottom - 46 && distanceFromCenter < innerHalf - 14;
      const border =
        shield &&
        (Math.abs(distanceFromCenter - half) < style.outerStroke ||
          Math.abs(localY - style.shieldTop) < style.outerStroke ||
          (localY > style.shieldBottom - 34 && distanceFromCenter < 42 + (style.shieldBottom - localY) * 0.55));
      const innerBorder =
        shield &&
        (Math.abs(distanceFromCenter - innerHalf) < style.innerStroke ||
          Math.abs(localY - (style.shieldTop + 40)) < style.innerStroke);
      const medallion = style.showMedallion && Math.abs(Math.hypot((x - centerX) / 1.04, localY - 306) - 116) < 4;
      const tree = treeShape(x, localY, centerX, style);
      const roots = rootShape(x, localY, centerX, style);
      const knot = knotShape(x, localY, centerX, style);
      const plaque = plaqueShape(x, localY, centerX, style);
      const plaqueBorder = plaque.border;
      const plaqueFill = plaque.fill;
      const laurel = style.showLaurel && laurelShape(x, localY, centerX);
      const archivePin =
        style.showPins &&
        (Math.hypot(x - (centerX - 116), localY - 132) < 8 ||
          Math.hypot(x - (centerX + 116), localY - 132) < 8 ||
          Math.hypot(x - centerX, localY - 522) < 8);
      const texture = (x * 13 + y * 17 + seed) % 47;
      const vignette = Math.min(34, Math.hypot(x - centerX, y - height / 2) / 13);

      if (!shield && input.transparent) {
        writeRgba(raw, offset, 0, 0, 0, 0);
        continue;
      }

      if (tree || roots || knot || plaqueBorder || medallion || laurel || border || archivePin) {
        writeRgba(raw, offset, style.gold[0] + (texture % 18), style.gold[1] + (texture % 12), style.gold[2] + (texture % 8), 255);
      } else if (innerBorder) {
        writeRgba(raw, offset, style.mutedGold[0] + (texture % 12), style.mutedGold[1] + (texture % 10), style.mutedGold[2] + (texture % 8), 255);
      } else if (plaqueFill) {
        writeRgba(raw, offset, style.plaque[0] + (texture % 8), style.plaque[1] + (texture % 6), style.plaque[2] + (texture % 6), 255);
      } else if (innerField) {
        writeRgba(raw, offset, style.inner[0] + (texture % 8), style.inner[1] + (texture % 6), style.inner[2] + (texture % 6), 255);
      } else if (shield) {
        writeRgba(raw, offset, style.shield[0] + (texture % 8), style.shield[1] + (texture % 6), style.shield[2] + (texture % 5), 255);
      } else {
        writeRgba(
          raw,
          offset,
          Math.max(0, style.background[0] + (texture % 7) - vignette),
          Math.max(0, style.background[1] + (texture % 6) - vignette),
          Math.max(0, style.background[2] + (texture % 6) - vignette),
          255
        );
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const text = Buffer.from(
      `Description\0MyKinLegacy symbolic crest artwork. artwork_template=shield_legacy_crest_v1; artwork_mode=deterministic_symbolic_template; ` +
      `main_symbol=${symbolMapping.main_symbol}; supporting_symbols=${symbolMapping.supporting_symbols.join(",")}; ` +
      `theme_mapping=continuity,unity; artwork_quality=internal_beta; variant=${style.name}; ` +
      promptMetadataText(input.prompt_metadata) +
      `House ${input.house_name ?? "family"}. Mapped symbols shield, tree, knot. `.repeat(220)
  );

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", text),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

interface CrestStyle {
  name: "full_shield" | "emblem_close" | "print_contrast" | "transparent_emblem";
  shieldTop: number;
  shieldBottom: number;
  shieldHalf: number;
  shieldTaper: number;
  outerStroke: number;
  innerInset: number;
  innerStroke: number;
  verticalOffset: number;
  treeScale: number;
  showMedallion: boolean;
  showLaurel: boolean;
  showPins: boolean;
  background: [number, number, number];
  shield: [number, number, number];
  inner: [number, number, number];
  plaque: [number, number, number];
  gold: [number, number, number];
  mutedGold: [number, number, number];
}

function resolveCrestVariant(variant: string, transparent: boolean): CrestStyle {
  if (transparent) {
    return {
      name: "transparent_emblem",
      shieldTop: 58,
      shieldBottom: 584,
      shieldHalf: 184,
      shieldTaper: 0.37,
      outerStroke: 9,
      innerInset: 32,
      innerStroke: 3,
      verticalOffset: 0,
      treeScale: 1.05,
      showMedallion: false,
      showLaurel: true,
      showPins: false,
      background: [0, 0, 0],
      shield: [25, 21, 17],
      inner: [14, 13, 12],
      plaque: [35, 25, 16],
      gold: [207, 162, 76],
      mutedGold: [136, 101, 52]
    };
  }
  if (variant.includes("2")) {
    return {
      name: "emblem_close",
      shieldTop: 48,
      shieldBottom: 590,
      shieldHalf: 198,
      shieldTaper: 0.39,
      outerStroke: 10,
      innerInset: 34,
      innerStroke: 3,
      verticalOffset: 0,
      treeScale: 1.11,
      showMedallion: false,
      showLaurel: false,
      showPins: false,
      background: [9, 8, 7],
      shield: [27, 22, 17],
      inner: [13, 12, 11],
      plaque: [36, 26, 17],
      gold: [214, 170, 82],
      mutedGold: [140, 104, 54]
    };
  }
  if (variant.includes("3")) {
    return {
      name: "print_contrast",
      shieldTop: 72,
      shieldBottom: 572,
      shieldHalf: 178,
      shieldTaper: 0.38,
      outerStroke: 11,
      innerInset: 30,
      innerStroke: 4,
      verticalOffset: 0,
      treeScale: 0.98,
      showMedallion: false,
      showLaurel: true,
      showPins: true,
      background: [15, 13, 11],
      shield: [20, 17, 14],
      inner: [6, 6, 5],
      plaque: [28, 20, 13],
      gold: [226, 184, 92],
      mutedGold: [154, 116, 58]
    };
  }
  return {
    name: "full_shield",
    shieldTop: 70,
    shieldBottom: 574,
    shieldHalf: 182,
    shieldTaper: 0.38,
    outerStroke: 9,
    innerInset: 31,
    innerStroke: 3,
    verticalOffset: 0,
    treeScale: 1,
    showMedallion: false,
    showLaurel: true,
    showPins: true,
    background: [8, 8, 7],
    shield: [26, 22, 17],
    inner: [15, 14, 12],
    plaque: [34, 24, 15],
    gold: [205, 160, 75],
    mutedGold: [132, 98, 50]
  };
}

function resolveSymbolMapping(symbols: string[], promptMetadata?: Parameters<typeof createMvpCrestPngBuffer>[0]["prompt_metadata"]): {
  main_symbol: string;
  supporting_symbols: string[];
} {
  const lrePrimary = normalizeSymbol(promptMetadata?.primary_symbol ?? "");
  const lreSupporting = (promptMetadata?.secondary_symbols ?? []).map(normalizeSymbol).filter(Boolean);
  if (promptMetadata?.prompt_source === "lre_prompt" && lrePrimary) {
    return {
      main_symbol: lrePrimary,
      supporting_symbols: lreSupporting.length > 0 ? lreSupporting.slice(0, 3) : ["shield", "laurel"]
    };
  }
  const normalized = symbols.join(" ").toLowerCase();
  const hasTreeSignal = /\b(tree|oak|branch|root|heritage|legacy)\b/.test(normalized);
  return {
    main_symbol: hasTreeSignal ? "tree" : "tree",
    supporting_symbols: ["shield", "knot"]
  };
}

function promptMetadataText(metadata?: Parameters<typeof createMvpCrestPngBuffer>[0]["prompt_metadata"]): string {
  if (!metadata) return "prompt_source=old_prompt; ";
  const parts = [
    ["prompt_source", metadata.prompt_source ?? "old_prompt"],
    ["pve_score", metadata.pve_score === null || metadata.pve_score === undefined ? "none" : String(metadata.pve_score)],
    ["pve_passed", metadata.pve_passed === true ? "true" : "false"],
    ["old_prompt_sha256", metadata.old_prompt_sha256 ?? "none"],
    ["lre_prompt_sha256", metadata.lre_prompt_sha256 ?? "none"],
    ["primary_symbol", normalizeSymbol(metadata.primary_symbol ?? "") || "none"],
    ["secondary_symbols", (metadata.secondary_symbols ?? []).map(normalizeSymbol).filter(Boolean).join(",") || "none"],
    ["selected_dna", (metadata.selected_dna ?? []).map(safeMetadataValue).join("|") || "none"],
    ["selected_prompt", safeMetadataValue(metadata.selected_prompt ?? "") || "none"],
    ["negative_prompt", safeMetadataValue(metadata.negative_prompt ?? "") || "none"]
  ];
  return `${parts.map(([key, value]) => `${key}=${value}`).join("; ")}; `;
}

function normalizeSymbol(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_ -]/g, "").trim().replace(/\s+/g, "_");
}

function safeMetadataValue(value: string): string {
  return value.replace(/[;\0\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
}

function shieldHalfWidth(y: number, style: CrestStyle): number {
  if (y < style.shieldTop || y > style.shieldBottom) return 0;
  if (y < style.shieldTop + 104) return style.shieldHalf;
  return Math.max(22, style.shieldHalf - (y - (style.shieldTop + 104)) * style.shieldTaper);
}

function treeShape(x: number, y: number, centerX: number, style: CrestStyle): boolean {
  const scale = style.treeScale;
  const trunk = Math.abs(x - centerX) < 8 * scale && y > 230 && y < 392;
  const branchA = distanceToSegment(x, y, centerX, 286, centerX - 78 * scale, 238) < 4.2;
  const branchB = distanceToSegment(x, y, centerX, 286, centerX + 78 * scale, 238) < 4.2;
  const branchC = distanceToSegment(x, y, centerX, 318, centerX - 62 * scale, 294) < 3.8;
  const branchD = distanceToSegment(x, y, centerX, 318, centerX + 62 * scale, 294) < 3.8;
  const branchE = distanceToSegment(x, y, centerX, 260, centerX - 32 * scale, 220) < 3.6;
  const branchF = distanceToSegment(x, y, centerX, 260, centerX + 32 * scale, 220) < 3.6;
  const leafClusterCenters: Array<[number, number, number, number]> = [
    [centerX, 206, 24, 16],
    [centerX - 44 * scale, 232, 25, 15],
    [centerX + 44 * scale, 232, 25, 15],
    [centerX - 72 * scale, 262, 20, 13],
    [centerX + 72 * scale, 262, 20, 13],
    [centerX - 35 * scale, 294, 21, 13],
    [centerX + 35 * scale, 294, 21, 13]
  ];
  const leafClusters = leafClusterCenters.some(([cx, cy, rx, ry]) => Math.hypot((x - cx) / rx, (y - cy) / ry) < 1);
  return trunk || branchA || branchB || branchC || branchD || branchE || branchF || leafClusters;
}

function rootShape(x: number, y: number, centerX: number, style: CrestStyle): boolean {
  const scale = style.treeScale;
  return (
    distanceToSegment(x, y, centerX, 386, centerX - 84 * scale, 430) < 4 ||
    distanceToSegment(x, y, centerX, 386, centerX + 84 * scale, 430) < 4 ||
    distanceToSegment(x, y, centerX, 392, centerX - 42 * scale, 446) < 3.4 ||
    distanceToSegment(x, y, centerX, 392, centerX + 42 * scale, 446) < 3.4
  );
}

function knotShape(x: number, y: number, centerX: number, style: CrestStyle): boolean {
  const scale = style.treeScale;
  const leftRing = Math.abs(Math.hypot((x - (centerX - 14 * scale)) / 1.08, y - 430) - 16 * scale) < 3.2;
  const rightRing = Math.abs(Math.hypot((x - (centerX + 14 * scale)) / 1.08, y - 430) - 16 * scale) < 3.2;
  const centerJoin = Math.abs(y - 430) < 2.6 && Math.abs(x - centerX) < 22 * scale;
  return leftRing || rightRing || centerJoin;
}

function plaqueShape(x: number, y: number, centerX: number, style: CrestStyle): { border: boolean; fill: boolean } {
  const width = style.name === "emblem_close" ? 136 : 154;
  const top = style.name === "emblem_close" ? 492 : 486;
  const bottom = top + 34;
  const fill = y > top && y < bottom && Math.abs(x - centerX) < width - Math.abs(y - (top + bottom) / 2) * 1.3;
  const border =
    (Math.abs(y - top) < 3 || Math.abs(y - bottom) < 3) && Math.abs(x - centerX) < width - Math.abs(y - (top + bottom) / 2) * 1.3;
  return { fill, border };
}

function laurelShape(x: number, y: number, centerX: number): boolean {
  const leftStem = distanceToSegment(x, y, centerX - 132, 346, centerX - 88, 484) < 2.4;
  const rightStem = distanceToSegment(x, y, centerX + 132, 346, centerX + 88, 484) < 2.4;
  const leafPairs = [356, 382, 408, 434, 460].some((cy, index) => {
    const spread = 126 - index * 8;
    const leftLeaf = Math.hypot((x - (centerX - spread)) / 13, (y - cy) / 7) < 1;
    const rightLeaf = Math.hypot((x - (centerX + spread)) / 13, (y - cy) / 7) < 1;
    return leftLeaf || rightLeaf;
  });
  return leftStem || rightStem || leafPairs;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function writeRgba(raw: Buffer, offset: number, r: number, g: number, b: number, a: number): void {
  raw[offset] = clampByte(r);
  raw[offset + 1] = clampByte(g);
  raw[offset + 2] = clampByte(b);
  raw[offset + 3] = clampByte(a);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export async function materializeMockImageCandidate(input: {
  temporary_output_ref: string;
  output_file_path: string;
}): Promise<{ file_path: string; width: number; height: number; has_alpha: boolean }> {
  if (!input.temporary_output_ref.startsWith("mock://image/")) {
    throw new Error("unsupported_candidate_ref");
  }

  await mkdir(dirname(input.output_file_path), { recursive: true });
  const body = createMockPngBuffer();
  await writeFile(input.output_file_path, body);

  return {
    file_path: input.output_file_path,
    ...readPngMetadata(body)
  };
}

export async function createTransparentPng(input: {
  output_file_path: string;
}): Promise<{ file_path: string; width: number; height: number; has_alpha: boolean; transparent: true }> {
  const body = createMvpCrestPngBuffer({
    variant: "transparent",
    house_name: "MyKinLegacy",
    symbols: ["shield", "oak", "star"],
    transparent: true
  });
  await mkdir(dirname(input.output_file_path), { recursive: true });
  await writeFile(input.output_file_path, body);
  return {
    file_path: input.output_file_path,
    ...readPngMetadata(body),
    transparent: true
  };
}

export function readPngMetadata(buffer: Buffer): { width: number; height: number; has_alpha: boolean; has_transparent_pixels: boolean } {
  if (buffer.subarray(1, 4).toString() !== "PNG") {
    throw new Error("not_png");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);
  const shouldScanTransparency = buffer.toString("latin1").includes("variant=transparent_emblem");
  const hasTransparentPixels = colorType === 6 && shouldScanTransparency ? pngHasTransparentPixels(buffer, width, height) : false;

  return {
    width,
    height,
    has_alpha: colorType === 4 || colorType === 6,
    has_transparent_pixels: hasTransparentPixels
  };
}

function pngHasTransparentPixels(buffer: Buffer, width: number, height: number): boolean {
  const idatChunks: Buffer[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < buffer.length - 12) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  if (idatChunks.length === 0) return false;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const rowLength = width * 4 + 1;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    if (raw[rowOffset] !== 0) return false;
    for (let x = 0; x < width; x += 1) {
      if (raw[rowOffset + 1 + x * 4 + 3] === 0) return true;
    }
  }
  return false;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
