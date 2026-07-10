import { saveEnvValues } from "../../env-store";
import { refreshEtsyTokenIfNeeded } from "./client";

const ETSY_SCOPES_URL = "https://openapi.etsy.com/v3/application/scopes";

export type EtsyTokenScopesResult = {
  ok: boolean;
  scopes: string[];
  status: number;
  error?: string;
  rawShape: "array" | "object" | "unknown";
};

function readScopeStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => readScopeStrings(item));
  }
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readScopeStrings(record.scopes ?? record.scope ?? record.results ?? record.permissions);
  }
  return [];
}

export async function verifyEtsyTokenScopes(options?: {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<EtsyTokenScopesResult> {
  let accessToken = options?.accessToken ?? process.env.ETSY_ACCESS_TOKEN ?? "";
  const clientId = options?.clientId ?? process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = options?.clientSecret ?? process.env.ETSY_CLIENT_SECRET ?? "";

  if (!accessToken) {
    return { ok: false, scopes: [], status: 0, error: "Missing ETSY_ACCESS_TOKEN.", rawShape: "unknown" };
  }
  if (!clientId) {
    return { ok: false, scopes: [], status: 0, error: "Missing ETSY_CLIENT_ID.", rawShape: "unknown" };
  }

  async function requestScopes(token: string): Promise<Response> {
    return fetch(ETSY_SCOPES_URL, {
      method: "POST",
      headers: {
        "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ token })
    });
  }

  if (!options?.accessToken) {
    const refreshed = await refreshEtsyTokenIfNeeded(false);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      saveEnvValues({
        ETSY_ACCESS_TOKEN: refreshed.accessToken,
        ETSY_REFRESH_TOKEN: refreshed.refreshToken,
        ETSY_TOKEN_EXPIRES_AT: refreshed.expiresAt
      });
    }
  }

  let response = await requestScopes(accessToken);
  if (response.status === 401 && !options?.accessToken) {
    const refreshed = await refreshEtsyTokenIfNeeded(true);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      saveEnvValues({
        ETSY_ACCESS_TOKEN: refreshed.accessToken,
        ETSY_REFRESH_TOKEN: refreshed.refreshToken,
        ETSY_TOKEN_EXPIRES_AT: refreshed.expiresAt
      });
      response = await requestScopes(accessToken);
    }
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  const rawShape = Array.isArray(data) ? "array" : data && typeof data === "object" ? "object" : "unknown";
  const scopes = Array.from(new Set(readScopeStrings(data))).sort();

  if (!response.ok) {
    return {
      ok: false,
      scopes,
      status: response.status,
      error: typeof data === "string" ? data : JSON.stringify(data),
      rawShape
    };
  }

  return { ok: true, scopes, status: response.status, rawShape };
}

export function parseStoredScopes(value: string | undefined | null): string[] {
  return String(value ?? "").split(/\s+/).filter(Boolean).sort();
}
