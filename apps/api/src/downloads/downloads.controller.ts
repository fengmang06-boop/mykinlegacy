import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";

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
}

function getRequestSignals(request: Request): { ip?: string | null; userAgent?: string | null } {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null
  };
}
