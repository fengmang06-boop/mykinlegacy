import { Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";

import { AnalyticsService, type AnalyticsEventInput } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("events")
  track(@Body("data") body: AnalyticsEventInput, @Req() request: Request) {
    return this.analyticsService.track(body ?? {}, {
      ip: clientIp(request),
      userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined
    });
  }
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.ip;
}
