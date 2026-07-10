import { NextResponse } from "next/server";
import { etsyScopes } from "@/lib/integrations/etsy/scopes";
import { refreshAccessToken } from "@/lib/integrations/etsy/oauth";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { parseStoredScopes, verifyEtsyTokenScopes } from "@/lib/integrations/etsy/token-scopes";
import { isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";
import { saveEnvValues } from "@/lib/env-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const storedScopes = parseStoredScopes(process.env.ETSY_TOKEN_SCOPE);
  let verified = await verifyEtsyTokenScopes();
  let refreshedToken = false;

  if (!verified.ok && /expired|invalid_token/i.test(verified.error ?? "") && process.env.ETSY_REFRESH_TOKEN) {
    const token = await refreshAccessToken();
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const tokenScopeFromRefresh = token.scope?.trim();
    saveEnvValues({
      ETSY_ACCESS_TOKEN: token.access_token,
      ETSY_REFRESH_TOKEN: token.refresh_token ?? process.env.ETSY_REFRESH_TOKEN,
      ETSY_TOKEN_EXPIRES_AT: expiresAt,
      ETSY_TOKEN_SCOPE: tokenScopeFromRefresh,
      ETSY_READ_ONLY_MODE: "true",
      ETSY_WRITE_APPROVED: "false"
    });
    refreshedToken = true;
    verified = await verifyEtsyTokenScopes({ accessToken: token.access_token });
  }

  const verifiedScopes = verified.scopes;
  const hasListingsWriteScope = verified.ok && verifiedScopes.includes("listings_w");
  const savedKeys =
    verified.ok && verifiedScopes.length
      ? saveEnvValues({
          ETSY_TOKEN_SCOPE: verifiedScopes.join(" "),
          ETSY_READ_ONLY_MODE: "true",
          ETSY_WRITE_APPROVED: "false"
        })
      : [];

  return NextResponse.json({
    tokenValid: verified.ok,
    requestedScopes: etsyScopes,
    storedScopes,
    verifiedScopes,
    hasListingsWriteScope,
    readyForDryRun: hasListingsWriteScope && isReadOnlyMode() && !isEtsyWriteApprovalFlagEnabled(),
    env: {
      readOnlyMode: isReadOnlyMode(),
      writeApproved: isEtsyWriteApprovalFlagEnabled()
    },
    persistence: {
      savedKeys,
      refreshedToken,
      tokenScopeWasMissing: storedScopes.length === 0
    },
    etsyVerification: {
      endpoint: "POST /v3/application/scopes",
      status: verified.status,
      ok: verified.ok,
      rawShape: verified.rawShape,
      error: verified.error ?? null
    }
  });
}
