import { NextResponse } from "next/server";
import { checkEtsyEnv } from "@/lib/integrations/etsy/env-check";
import { parseStoredScopes } from "@/lib/integrations/etsy/token-scopes";
import { getEtsySyncStatus } from "@/lib/integrations/etsy/sync-read-only";
import { getEtsyDailyReserve, getEtsyRateLimitSnapshot } from "@/lib/integrations/etsy/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [status, env] = await Promise.all([getEtsySyncStatus(), Promise.resolve(checkEtsyEnv())]);
  const storedScopes = parseStoredScopes(process.env.ETSY_TOKEN_SCOPE);
  const rateLimit = getEtsyRateLimitSnapshot();
  const dailyReserve = getEtsyDailyReserve(rateLimit);
  return NextResponse.json({
    connected: status.connected,
    shop: status.shop
      ? {
          id: status.shop.id,
          etsyShopId: status.shop.etsyShopId,
          name: status.shop.name,
          url: status.shop.url,
          updatedAt: status.shop.updatedAt
        }
      : null,
    counts: status.counts,
    lastSync: status.lastSync,
    state: status.state,
    env: {
      apiMode: env.apiMode,
      readyForReadOnlySync: env.readyForReadOnlySync,
      tokenPresent: env.tokenPresent,
      refreshTokenPresent: env.refreshTokenPresent,
      tokenScope: process.env.ETSY_TOKEN_SCOPE ?? null,
      storedScopes,
      hasListingsWriteScope: storedScopes.includes("listings_w"),
      tokenExpired: env.tokenExpired,
      readOnlyMode: String(process.env.ETSY_READ_ONLY_MODE ?? "true").toLowerCase() === "true",
      writeApproved: String(process.env.ETSY_WRITE_APPROVED ?? "false").toLowerCase() === "true",
      missingFields: env.missingFields,
      warnings: env.warnings
    },
    syncPolicy: {
      mode: "incremental",
      minimumIntervalMinutes: Math.max(60, Number(process.env.ETSY_MIN_SYNC_INTERVAL_MINUTES ?? "360")),
      fullSyncApproved: String(process.env.ETSY_FULL_SYNC_APPROVED ?? "false").toLowerCase() === "true",
      dailyReservePercent: Math.min(90, Math.max(5, Number(process.env.ETSY_DAILY_RESERVE_PERCENT ?? "20"))),
      dailyReserveCalls: dailyReserve
    },
    rateLimit
  });
}
