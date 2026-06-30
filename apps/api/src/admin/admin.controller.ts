import { Body, Controller, Get, Headers, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post("login")
  login(@Body() body: unknown, @Req() request: Request) {
    const data = asRecord(body);
    return this.adminService.login({
      email: stringValue(data.email),
      password: stringValue(data.password),
      context: requestContext(request)
    });
  }

  @Post("logout")
  logout(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.logout(requestContext(request, authorization));
  }

  @Get("me")
  me(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.me(requestContext(request, authorization));
  }

  @Get("dashboard")
  dashboard(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.dashboard(requestContext(request, authorization));
  }

  @Get("orders")
  listOrders(@Headers("authorization") authorization: string | undefined, @Req() request: Request, @Query() _query: unknown) {
    return this.adminService.listOrders(requestContext(request, authorization));
  }

  @Get("orders/:orderId")
  getOrder(@Param("orderId") orderId: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getOrder(requestContext(request, authorization), orderId);
  }

  @Post("orders/:orderId/resend-email")
  resendEmail(@Param("orderId") orderId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.resendEmail(requestContext(request, authorization), orderId, reason(body));
  }

  @Post("orders/:orderId/create-download-token")
  createDownloadToken(@Param("orderId") orderId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.createDownloadToken(requestContext(request, authorization), orderId, reason(body));
  }

  @Post("download-tokens/:tokenId/revoke")
  revokeDownloadToken(@Param("tokenId") tokenId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.revokeDownloadToken(requestContext(request, authorization), tokenId, reason(body));
  }

  @Get("generation-jobs")
  listGenerationJobs(@Headers("authorization") authorization: string | undefined, @Req() request: Request, @Query() _query: unknown) {
    return this.adminService.listGenerationJobs(requestContext(request, authorization));
  }

  @Get("generation-jobs/:jobId")
  getGenerationJob(@Param("jobId") jobId: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getGenerationJob(requestContext(request, authorization), jobId);
  }

  @Post("generation-jobs/:jobId/retry")
  retryGenerationJob(@Param("jobId") jobId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.retryGenerationJob(requestContext(request, authorization), jobId, reason(body));
  }

  @Get("manifests/:manifestId")
  getManifest(@Param("manifestId") manifestId: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getManifest(requestContext(request, authorization), manifestId);
  }

  @Post("manifests/:manifestId/retry-failed-assets")
  retryFailedAssets(@Param("manifestId") manifestId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.retryFailedAssets(requestContext(request, authorization), manifestId, reason(body));
  }

  @Get("assets")
  listAssets(@Headers("authorization") authorization: string | undefined, @Req() request: Request, @Query() _query: unknown) {
    return this.adminService.listAssets(requestContext(request, authorization));
  }

  @Get("assets/:assetId")
  getAsset(@Param("assetId") assetId: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getAsset(requestContext(request, authorization), assetId);
  }

  @Post("assets/:assetId/preview-url")
  createAssetPreviewUrl(@Param("assetId") assetId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.createAssetPreviewUrl(requestContext(request, authorization), assetId, reason(body));
  }

  @Post("assets/:assetId/revoke")
  revokeAsset(@Param("assetId") assetId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.revokeAsset(requestContext(request, authorization), assetId, reason(body));
  }

  @Get("download-tokens")
  listDownloadTokens(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.listDownloadTokens(requestContext(request, authorization));
  }

  @Get("email-logs")
  listEmailLogs(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.listEmailLogs(requestContext(request, authorization));
  }

  @Get("prompt-templates")
  listPromptTemplates(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.listPromptTemplates(requestContext(request, authorization));
  }

  @Get("prompt-templates/:id")
  getPromptTemplate(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getPromptTemplate(requestContext(request, authorization), id);
  }

  @Get("prompt-templates/:id/versions/:versionId")
  getPromptVersion(@Param("id") id: string, @Param("versionId") versionId: string, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.getPromptVersion(requestContext(request, authorization), id, versionId);
  }

  @Post("prompt-templates/:id/versions")
  createPromptVersion(@Param("id") id: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.createPromptVersion(requestContext(request, authorization), id, reason(body));
  }

  @Post("prompt-templates/:id/versions/:versionId/activate")
  activatePromptVersion(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: unknown, @Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.activatePromptVersion(requestContext(request, authorization), id, versionId, asRecord(body));
  }

  @Get("knowledge-library")
  knowledgeLibrary(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.knowledgeLibrary(requestContext(request, authorization));
  }

  @Get("audit-logs")
  auditLogs(@Headers("authorization") authorization: string | undefined, @Req() request: Request, @Query() _query: unknown) {
    return this.adminService.listAuditLogs(requestContext(request, authorization));
  }

  @Get("system-health")
  systemHealth(@Headers("authorization") authorization: string | undefined, @Req() request: Request) {
    return this.adminService.systemHealth(requestContext(request, authorization));
  }
}

function requestContext(request: Request, authorization?: string) {
  return {
    sessionToken: authorization?.replace(/^Bearer\s+/i, ""),
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function reason(body: unknown): string | undefined {
  return stringValue(asRecord(body).reason);
}
