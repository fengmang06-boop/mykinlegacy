import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

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
}): Buffer {
  const width = 640;
  const height = 640;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const seed = hashSeed(`${input.variant}:${input.house_name ?? "house"}:${(input.symbols ?? []).join(",")}`);
  const centerX = width / 2;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const half = shieldHalfWidth(y);
      const distanceFromCenter = Math.abs(x - centerX);
      const shield = y >= 76 && y <= 574 && distanceFromCenter <= half;
      const border =
        shield &&
        (Math.abs(distanceFromCenter - half) < 8 ||
          Math.abs(y - 82) < 7 ||
          (y > 540 && distanceFromCenter < 44 + (574 - y) * 0.4));
      const innerBorder =
        shield &&
        (Math.abs(distanceFromCenter - Math.max(0, half - 28)) < 3 ||
          Math.abs(y - 112) < 3);
      const medallion = Math.abs(Math.hypot(x - centerX, y - 302) - 86) < 7;
      const star = Math.abs(x - centerX) + Math.abs(y - 256) < 38;
      const verticalBar = Math.abs(x - centerX) < 10 && y > 216 && y < 416;
      const horizontalBand = y > 330 && y < 354 && distanceFromCenter < 126;
      const ribbon = y > 486 && y < 526 && distanceFromCenter < 154 - Math.abs(y - 506) * 1.8;
      const laurelLeft = Math.abs(Math.hypot(x - (centerX - 86), y - 418) - 42) < 5 && x < centerX;
      const laurelRight = Math.abs(Math.hypot(x - (centerX + 86), y - 418) - 42) < 5 && x > centerX;
      const cornerPin =
        (Math.hypot(x - 178, y - 142) < 14 ||
          Math.hypot(x - 462, y - 142) < 14 ||
          Math.hypot(x - centerX, y - 536) < 14);
      const texture = (x * 13 + y * 17 + seed) % 47;

      if (!shield && input.transparent) {
        raw[offset] = 0;
        raw[offset + 1] = 0;
        raw[offset + 2] = 0;
        raw[offset + 3] = 0;
        continue;
      }

      if (border || medallion || star || verticalBar || horizontalBand || ribbon || laurelLeft || laurelRight || cornerPin) {
        raw[offset] = 198 + (texture % 36);
        raw[offset + 1] = 154 + (texture % 32);
        raw[offset + 2] = 72 + (texture % 22);
        raw[offset + 3] = 255;
      } else if (innerBorder) {
        raw[offset] = 126 + (texture % 22);
        raw[offset + 1] = 94 + (texture % 18);
        raw[offset + 2] = 46 + (texture % 12);
        raw[offset + 3] = 255;
      } else if (shield) {
        raw[offset] = 20 + (texture % 10);
        raw[offset + 1] = 18 + (texture % 8);
        raw[offset + 2] = 15 + (texture % 8);
        raw[offset + 3] = 255;
      } else {
        raw[offset] = 8 + (texture % 8);
        raw[offset + 1] = 8 + (texture % 7);
        raw[offset + 2] = 7 + (texture % 7);
        raw[offset + 3] = 255;
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
    `Description\0MyKinLegacy MVP symbolic crest artwork. artwork_mode=mvp_symbolic_template; artwork_quality=internal_beta; Variant ${input.variant}. ` +
      `House ${input.house_name ?? "family"}. Symbols ${(input.symbols ?? []).join(", ") || "shield"}. `.repeat(220)
  );

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", text),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function shieldHalfWidth(y: number): number {
  if (y < 76 || y > 574) return 0;
  if (y < 174) return 178;
  return Math.max(20, 178 - (y - 174) * 0.39);
}

export async function materializeMockImageCandidate(input: {
  temporary_output_ref: string;
  output_file_path: string;
}): Promise<{ file_path: string; width: number; height: number; has_alpha: boolean }> {
  if (!input.temporary_output_ref.startsWith("mock://image/")) {
    throw new Error("unsupported_candidate_ref");
  }

  await mkdir(dirname(input.output_file_path), { recursive: true });
  await writeFile(input.output_file_path, createMockPngBuffer());

  return {
    file_path: input.output_file_path,
    ...readPngMetadata(createMockPngBuffer())
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

export function readPngMetadata(buffer: Buffer): { width: number; height: number; has_alpha: boolean } {
  if (buffer.subarray(1, 4).toString() !== "PNG") {
    throw new Error("not_png");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);

  return {
    width,
    height,
    has_alpha: colorType === 4 || colorType === 6
  };
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
