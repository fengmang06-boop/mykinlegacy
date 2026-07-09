import { NextResponse } from "next/server";
import { checkEtsyEnv } from "@/lib/integrations/etsy/env-check";
import { getEtsySyncStatus } from "@/lib/integrations/etsy/sync-read-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [status, env] = await Promise.all([getEtsySyncStatus(), Promise.resolve(checkEtsyEnv())]);
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
      hasListingsWriteScope: String(process.env.ETSY_TOKEN_SCOPE ?? "")
        .split(/\s+/)
        .includes("listings_w"),
      tokenExpired: env.tokenExpired,
      missingFields: env.missingFields,
      warnings: env.warnings
    }
  });
}
