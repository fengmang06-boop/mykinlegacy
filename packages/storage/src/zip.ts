import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { calculateChecksumSha256 } from "./utils";

export interface ZipAssetInput {
  archive_path: string;
  file_path: string;
  required: boolean;
}

export async function generateReadme(input: {
  package_title: string;
  included_files: string[];
  support_note?: string;
  disclaimer: string;
}): Promise<string> {
  return [
    input.package_title,
    "",
    "Included files:",
    ...input.included_files.map((file) => `- ${file}`),
    "",
    "Usage notes: Keep these files private unless you choose to share them.",
    "Print notes: Use the PDF files for document printing and PNG files for image use.",
    `Support: ${input.support_note ?? "Contact support with your order number if you need help."}`,
    "",
    input.disclaimer
  ].join("\n");
}

export async function generateZipPackage(input: {
  output_file_path: string;
  assets: ZipAssetInput[];
  readme_text: string;
}): Promise<{ file_path: string; mime_type: "application/zip"; size_bytes: number; checksum_sha256: string; entries: string[] }> {
  const missing = input.assets.filter((asset) => asset.required && !asset.file_path);
  if (missing.length > 0) {
    throw new Error(`zip_required_asset_missing:${missing.map((asset) => asset.archive_path).join(",")}`);
  }

  const entries = [
    ...input.assets,
    {
      archive_path: "read-me/read-me.txt",
      file_path: "",
      required: true,
      body: Buffer.from(input.readme_text)
    }
  ];
  const buffers: Array<{ name: string; body: Buffer }> = [];
  for (const entry of entries) {
    const body = "body" in entry ? entry.body : await readFile(entry.file_path);
    buffers.push({ name: normalizeZipPath(entry.archive_path), body });
  }

  const zip = buildZip(buffers);
  await mkdir(dirname(input.output_file_path), { recursive: true });
  await writeFile(input.output_file_path, zip);

  return {
    file_path: input.output_file_path,
    mime_type: "application/zip",
    size_bytes: zip.byteLength,
    checksum_sha256: calculateChecksumSha256(zip),
    entries: buffers.map((entry) => entry.name)
  };
}

export function listZipEntries(buffer: Buffer): string[] {
  const entries: string[] = [];
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const name = buffer.subarray(offset + 30, offset + 30 + fileNameLength).toString();
    entries.push(name);
    offset += 30 + fileNameLength + extraLength + compressedSize;
  }
  return entries;
}

function buildZip(entries: Array<{ name: string; body: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const crc = crc32(entry.body);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.body.length, 18);
    local.writeUInt32LE(entry.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, entry.body);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.body.length, 20);
    central.writeUInt32LE(entry.body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + entry.body.length;
  }

  const centralSize = centrals.reduce((size, buffer) => size + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
}

function normalizeZipPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
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
