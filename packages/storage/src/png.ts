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

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const dx = Math.abs(x - width / 2) / (width / 2);
      const dy = Math.abs(y - height / 2) / (height / 2);
      const shield = dx * 0.78 + dy * 0.62 < 0.72 && y > 64 && y < 572;
      const border = Math.abs(dx * 0.78 + dy * 0.62 - 0.72) < 0.025 && y > 64 && y < 572;
      const verticalStripe = Math.abs(x - width / 2) < 16;
      const horizontalBand = y > 284 && y < 324;
      const diagonal = Math.abs((x + (seed % 80)) - (y + 84)) < 8 || Math.abs((width - x) - y + 84) < 8;
      const star = Math.abs(x - width / 2) + Math.abs(y - 178) < 42;
      const ring = Math.abs(Math.hypot(x - width / 2, y - 382) - 112) < 7;
      const texture = (x * 13 + y * 17 + seed) % 47;

      if (!shield && input.transparent) {
        raw[offset] = 0;
        raw[offset + 1] = 0;
        raw[offset + 2] = 0;
        raw[offset + 3] = 0;
        continue;
      }

      if (border || star || ring || verticalStripe || horizontalBand || diagonal) {
        raw[offset] = 202 + (texture % 28);
        raw[offset + 1] = 157 + (texture % 34);
        raw[offset + 2] = 75 + (texture % 24);
        raw[offset + 3] = 255;
      } else if (shield) {
        raw[offset] = 24 + (texture % 12);
        raw[offset + 1] = 21 + (texture % 10);
        raw[offset + 2] = 18 + (texture % 12);
        raw[offset + 3] = 255;
      } else {
        raw[offset] = 10 + (texture % 10);
        raw[offset + 1] = 9 + (texture % 9);
        raw[offset + 2] = 8 + (texture % 8);
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
    `Description\0MyKinLegacy MVP symbolic crest artwork. Variant ${input.variant}. ` +
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
