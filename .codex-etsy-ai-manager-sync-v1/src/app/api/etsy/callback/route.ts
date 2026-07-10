import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchConnectedShop } from "@/lib/integrations/etsy/client";
import { exchangeCodeForToken, parseOAuthCallback } from "@/lib/integrations/etsy/oauth";
import { verifyEtsyTokenScopes } from "@/lib/integrations/etsy/token-scopes";
import { saveEnvValues } from "@/lib/env-store";
import { prisma } from "@/lib/prisma";

function maskToken(token: string | undefined): string {
  if (!token) return "not returned";
  if (token.length <= 12) return "received";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(request: Request) {
  try {
    const callback = parseOAuthCallback(new URL(request.url));
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("etsy_oauth_state")?.value;
    const codeVerifier = cookieStore.get("etsy_code_verifier")?.value;

    if (!expectedState || callback.state !== expectedState) {
      return NextResponse.json({ error: "Etsy OAuth state mismatch. Restart OAuth." }, { status: 400 });
    }
    if (!codeVerifier) {
      return NextResponse.json({ error: "Missing local PKCE verifier cookie. Restart OAuth." }, { status: 400 });
    }

    const token = await exchangeCodeForToken({ code: callback.code, codeVerifier });
    cookieStore.delete("etsy_oauth_state");
    cookieStore.delete("etsy_code_verifier");
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const tokenScopeFromExchange = token.scope?.trim();
    const verifiedScopes = await verifyEtsyTokenScopes({ accessToken: token.access_token });
    const tokenScope = tokenScopeFromExchange || (verifiedScopes.ok ? verifiedScopes.scopes.join(" ") : "");
    let connectedShop: { userId: string; shopId: string; shopName: string } | null = null;
    let connectedShopError: string | null = null;

    try {
      connectedShop = await fetchConnectedShop({ accessToken: token.access_token });
      await prisma.shop.upsert({
        where: { etsyShopId: connectedShop.shopId },
        update: { name: connectedShop.shopName },
        create: { etsyShopId: connectedShop.shopId, name: connectedShop.shopName }
      });
    } catch (error) {
      connectedShopError = error instanceof Error ? error.message : String(error);
    }

    const savedEnvKeys = saveEnvValues({
      ETSY_USER_ID: connectedShop?.userId,
      ETSY_SHOP_ID: connectedShop?.shopId,
      ETSY_ACCESS_TOKEN: token.access_token,
      ETSY_REFRESH_TOKEN: token.refresh_token ?? "",
      ETSY_TOKEN_EXPIRES_AT: expiresAt,
      ETSY_TOKEN_SCOPE: tokenScope,
      ETSY_READ_ONLY_MODE: "true",
      ETSY_WRITE_APPROVED: "false"
    }).join("\n");

    return new NextResponse(
      [
        "<!doctype html>",
        "<html><head><meta charset=\"utf-8\"><title>Etsy OAuth Complete</title>",
        "<style>body{background:#090909;color:#f3f3f3;font-family:Arial,sans-serif;padding:32px;line-height:1.5}main{max-width:860px}section{border:1px solid #2b2b2b;background:#121212;padding:18px;margin:16px 0}code,pre{background:#050505;border:1px solid #2b2b2b;color:#d7d7d7;padding:12px;display:block;white-space:pre-wrap;word-break:break-word}.muted{color:#a7a7a7}.ok{color:#68b684}</style>",
        "</head><body><main>",
        "<h1>Etsy OAuth Complete</h1>",
        "<section>",
        `<p class=\"ok\">Access token acquired: ${maskToken(token.access_token)}</p>`,
        `<p class=\"ok\">Refresh token acquired: ${maskToken(token.refresh_token)}</p>`,
        connectedShop
          ? `<p class=\"ok\">Connected shop: ${escapeHtml(connectedShop.shopName)} (${escapeHtml(connectedShop.shopId)})</p><p class=\"ok\">Etsy user ID: ${escapeHtml(connectedShop.userId)}</p>`
          : `<p class=\"muted\">Connected shop could not be auto-detected yet: ${escapeHtml(connectedShopError ?? "unknown error")}</p>`,
        "<p class=\"ok\">Tokens saved to <code>.env.local</code> on the production server.</p>",
        `<p class=\"muted\">Token scope source: ${escapeHtml(tokenScopeFromExchange ? "token exchange response" : verifiedScopes.ok ? "Etsy tokenScopes verification" : "not returned")}</p>`,
        "</section>",
        "<section>",
        "<h2>Saved Environment Keys</h2>",
        `<pre>${escapeHtml(savedEnvKeys)}</pre>`,
        "</section>",
        "<section>",
        "<h2>Next Step</h2>",
        "<p>The production server can now use the saved Etsy token for read-only sync.</p>",
        "<p class=\"muted\">v1.5.1 remains read-only. It will import Etsy data locally and generate local recommendations only.</p>",
        "</section>",
        "<p><a style=\"color:#f3f3f3\" href=\"/etsy-connection\">Back to Etsy Connection</a></p>",
        "</main></body></html>"
      ].join(""),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
