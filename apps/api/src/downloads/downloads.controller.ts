import { Controller, Get, Param, Post, Req, Res, StreamableFile } from "@nestjs/common";
import type { Request, Response } from "express";

import { DownloadsService } from "./downloads.service";

@Controller("downloads")
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(":token")
  getVault(@Param("token") token: string, @Req() request: Request) {
    return this.downloadsService.getVault(token, getRequestSignals(request));
  }

  @Get(":token/assets")
  listAssets(@Param("token") token: string) {
    return this.downloadsService.listAssets(token);
  }

  @Post(":token/assets/:assetId/signed-url")
  createSignedUrl(
    @Param("token") token: string,
    @Param("assetId") assetId: string,
    @Req() request: Request
  ) {
    return this.downloadsService.createSignedUrl(token, assetId, getRequestSignals(request));
  }

  @Get(":token/assets/:assetId/file")
  async downloadFile(
    @Param("token") token: string,
    @Param("assetId") assetId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const file = await this.downloadsService.getAssetFile(token, assetId, getRequestSignals(request));
    response.setHeader("content-type", file.mime_type);
    response.setHeader("content-length", String(file.body.byteLength));
    response.setHeader(
      "content-disposition",
      `attachment; filename="${file.file_name.replace(/"/g, "")}"`
    );
    response.setHeader("cache-control", "private, no-store");
    return new StreamableFile(file.body);
  }
}

function getRequestSignals(request: Request): { ip?: string | null; userAgent?: string | null } {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null
  };
}
