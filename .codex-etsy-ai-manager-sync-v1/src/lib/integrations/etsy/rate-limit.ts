import fs from "node:fs";
import path from "node:path";

export type EtsyRequestClass = "interactive" | "bulk";

export type EtsyRateLimitSnapshot = {
  capturedAt: string;
  requestPath: string;
  status: number;
  limitPerSecond: number | null;
  remainingThisSecond: number | null;
  limitPerDay: number | null;
  remainingToday: number | null;
  retryAfterSeconds: number | null;
};

let memorySnapshot: EtsyRateLimitSnapshot | null = null;

function snapshotPath(): string {
  return path.join(process.cwd(), "data", "etsy-rate-limit.json");
}

function readHeaderNumber(headers: Headers, names: string[]): number | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value === null) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function recordEtsyRateLimitHeaders(headers: Headers, status: number, requestPath: string): EtsyRateLimitSnapshot {
  const previous = getEtsyRateLimitSnapshot();
  const snapshot: EtsyRateLimitSnapshot = {
    capturedAt: new Date().toISOString(),
    requestPath,
    status,
    limitPerSecond:
      readHeaderNumber(headers, ["x-limit-per-second"]) ?? previous?.limitPerSecond ?? null,
    remainingThisSecond:
      readHeaderNumber(headers, ["x-remaining-this-second", "x-remaining-this-secon"]) ??
      previous?.remainingThisSecond ??
      null,
    limitPerDay: readHeaderNumber(headers, ["x-limit-per-day"]) ?? previous?.limitPerDay ?? null,
    remainingToday: readHeaderNumber(headers, ["x-remaining-today"]) ?? previous?.remainingToday ?? null,
    retryAfterSeconds: readHeaderNumber(headers, ["retry-after"])
  };

  memorySnapshot = snapshot;
  try {
    const file = snapshotPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(file, 0o600);
  } catch {
    // Rate-limit protection remains active in memory if filesystem persistence is unavailable.
  }
  return snapshot;
}

export function getEtsyRateLimitSnapshot(): EtsyRateLimitSnapshot | null {
  if (memorySnapshot) return memorySnapshot;
  try {
    const file = snapshotPath();
    if (!fs.existsSync(file)) return null;
    memorySnapshot = JSON.parse(fs.readFileSync(file, "utf8")) as EtsyRateLimitSnapshot;
    return memorySnapshot;
  } catch {
    return null;
  }
}

export function getEtsyDailyReserve(snapshot = getEtsyRateLimitSnapshot()): number | null {
  if (!snapshot?.limitPerDay) return null;
  const reservePercent = Math.min(90, Math.max(5, Number(process.env.ETSY_DAILY_RESERVE_PERCENT ?? "20")));
  const reserveCalls = Math.max(10, Number(process.env.ETSY_DAILY_RESERVE_CALLS ?? "50"));
  return Math.max(reserveCalls, Math.ceil((snapshot.limitPerDay * reservePercent) / 100));
}

export function assertEtsyRateBudget(requestClass: EtsyRequestClass): void {
  const snapshot = getEtsyRateLimitSnapshot();
  if (!snapshot || snapshot.remainingToday === null) return;

  const capturedAt = new Date(snapshot.capturedAt).getTime();
  const probeMinutes = Math.max(15, Number(process.env.ETSY_RATE_LIMIT_PROBE_MINUTES ?? "60"));
  const staleEnoughForProbe = !Number.isFinite(capturedAt) || Date.now() - capturedAt >= probeMinutes * 60_000;
  if (staleEnoughForProbe) return;

  const reserve = getEtsyDailyReserve(snapshot) ?? 0;
  if (snapshot.remainingToday <= 0) {
    throw new Error("Etsy API daily budget exhausted. Waiting for the rolling 24-hour window to release quota.");
  }
  if (requestClass === "bulk" && snapshot.remainingToday <= reserve) {
    throw new Error(
      `Etsy bulk sync paused with ${snapshot.remainingToday} calls remaining; ${reserve} calls are reserved for OAuth, tracking, and approved review work.`
    );
  }
}

export function isDailyRateLimitResponse(response: Response, body: string): boolean {
  const retryAfter = readHeaderNumber(response.headers, ["retry-after"]);
  return response.status === 429 && (/daily rate limit/i.test(body) || (retryAfter !== null && retryAfter > 60));
}
