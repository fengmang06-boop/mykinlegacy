import { StreamableFile } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { DownloadsController } from "./downloads.controller";
import type { DownloadsService } from "./downloads.service";

describe("DownloadsController", () => {
  it.each([
    ["pdf", "application/pdf", "%PDF-1.4\n", "heritage-certificate.pdf"],
    ["zip", "application/zip", "PK\u0003\u0004", "complete-collection-archive.zip"],
    ["png", "image/png", "\u0089PNG\r\n\u001a\n", "crest-artwork.png"]
  ])("returns %s downloads as raw streamable files without charset", async (_, mimeType, body, fileName) => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value)
    };
    const controller = new DownloadsController({
      getAssetFile: async () => ({
        asset_id: "asset_1",
        file_name: fileName,
        mime_type: mimeType,
        body: Buffer.from(body, "latin1")
      })
    } as unknown as DownloadsService);

    const result = await controller.downloadFile(
      "raw-token",
      "asset_1",
      { ip: "127.0.0.1", headers: { "user-agent": "unit-test" } } as never,
      response as never
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(headers.get("content-type")).toBe(mimeType);
    expect(headers.get("content-type")).not.toMatch(/charset/i);
    expect(headers.get("content-disposition")).toContain(`filename="${fileName}"`);
    expect(headers.get("content-length")).toBe(String(Buffer.from(body, "latin1").byteLength));
  });
});
