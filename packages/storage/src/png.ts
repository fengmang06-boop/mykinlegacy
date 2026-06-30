import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const TRANSPARENT_PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);

export function createMockPngBuffer(): Buffer {
  return Buffer.from(TRANSPARENT_PNG_1X1);
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
  await mkdir(dirname(input.output_file_path), { recursive: true });
  await writeFile(input.output_file_path, createMockPngBuffer());
  return {
    file_path: input.output_file_path,
    ...readPngMetadata(createMockPngBuffer()),
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
