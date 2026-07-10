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
  const accessToken = options?.accessToken ?? process.env.ETSY_ACCESS_TOKEN ?? "";
  const clientId = options?.clientId ?? process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = options?.clientSecret ?? process.env.ETSY_CLIENT_SECRET ?? "";

  if (!accessToken) {
    return { ok: false, scopes: [], status: 0, error: "Missing ETSY_ACCESS_TOKEN.", rawShape: "unknown" };
  }
  if (!clientId) {
    return { ok: false, scopes: [], status: 0, error: "Missing ETSY_CLIENT_ID.", rawShape: "unknown" };
  }

  const response = await fetch(ETSY_SCOPES_URL, {
    method: "POST",
    headers: {
      "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ token: accessToken })
  });
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
