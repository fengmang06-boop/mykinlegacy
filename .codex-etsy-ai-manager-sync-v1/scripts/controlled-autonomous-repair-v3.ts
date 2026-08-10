import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  applyReadinessAdjustedRepairScore,
  hasVerifiedWriteRecord,
  independentlyReviewControlledRepair,
  validateControlledRepairProposal,
  type ControlledRepairCandidate,
  type RepairPriorityComponents
} from "../src/lib/integrations/etsy/controlled-autonomous-repair-v3";
import {
  assertEtsyListingWriteGuard,
  hashEtsyListingWriteDiffs,
  isControlledAutonomousRepairV3Enabled
} from "../src/lib/integrations/etsy/write-guard";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const EXPECTED_SHOP_ID = "25333110";
const MIN_REQUEST_INTERVAL_MS = 450;
const MAX_WRITES_PER_DAY = 3;
const TIME_ZONE = "Asia/Shanghai";

type PlanCandidate = {
  listingId: string;
  product: string;
  sku: string | null;
  proposedTitle: string;
  proposedTags: string[];
  searchIntent: string;
  evidence: string[];
  repairPriorityScore: number;
  views: number;
  favorites: number;
  stableSeller: boolean;
  activeExperiment: boolean;
  materialConfirmed: boolean;
  productTypeConfirmed: boolean;
  structureConfirmed: boolean;
  ipRisk: boolean;
  authenticityRisk: boolean;
  requiresOtherFieldChanges: boolean;
  independentSearchAngle: boolean;
  identifierReliable: boolean;
  repairPriorityComponents?: RepairPriorityComponents;
};

type RepairPlan = {
  version: "V3";
  batchKey: string;
  baselineReportPath: string;
  candidates: PlanCandidate[];
};

const MAX_CANDIDATE_BACKLOG = 215;
const MAX_REVIEW_POOL = 15;
const MIN_REVIEW_POOL = 10;
const BASELINE_FRESHNESS_MS = 6 * 60 * 60 * 1000;

type BaselineListing = {
  listing_id: string;
  title: string;
  tags: string[];
  state: string;
  price: unknown;
  quantity: number;
  taxonomy_id: number | string | null;
  shipping_profile_id: number | string | null;
  images: Array<{ listing_image_id: string; rank: number }>;
  last_updated_timestamp: number | string | null;
  baseline_source: string;
  baseline_captured_at: string;
  baseline_sha256: string;
};

type BaselineReport = {
  batch_key: string;
  generated_at: string;
  listings: BaselineListing[];
  report_sha256: string;
};

type ReviewRecord = {
  listingId: string;
  product: string;
  zone: "green" | "yellow" | "red";
  confidence: number;
  approvedForAutomaticExecution: boolean;
  reasons: string[];
  candidate?: ControlledRepairCandidate;
  validation?: ReturnType<typeof validateControlledRepairProposal>;
};

let nextRequestAt = 0;
let tokenRefreshAttempted = false;
let writeWindowOpen = false;
let rateLimit = {
  limitPerDay: null as number | null,
  remainingToday: null as number | null,
  reserve: null as number | null
};

function parseArgs(): { planPath: string } {
  const index = process.argv.indexOf("--plan");
  if (index < 0 || !process.argv[index + 1]) throw new Error("Usage: tsx scripts/controlled-autonomous-repair-v3.ts --plan <plan.json>");
  return { planPath: path.resolve(process.argv[index + 1]) };
}

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^['"]|['"]$/g, "");
    if (typeof process.env[match[1]] === "undefined") process.env[match[1]] = value;
  }
}

function hashJson(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function atomicJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
}

function saveEnvValues(values: Record<string, string | undefined>): string {
  const envFile = path.join(process.cwd(), ".env.local");
  const backupDir = path.join(
    "/root",
    "mensskull-etsy-backups",
    "controlled-autonomous-repair-v3-token-refresh",
    new Date().toISOString().replace(/[:.]/g, "-")
  );
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(envFile, path.join(backupDir, ".env.local"));
  const updates = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const keys = new Set(Object.keys(updates));
  const kept = fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      return !match || !keys.has(match[1]);
    })
    .filter((line) => line.trim());
  const formatted = Object.entries(updates).map(([key, value]) => {
    const encoded = /[\s"#\\]/.test(value) ? JSON.stringify(value) : value;
    return `${key}=${encoded}`;
  });
  const temp = `${envFile}.v3-${process.pid}`;
  fs.writeFileSync(temp, `${[...kept, ...formatted].join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temp, envFile);
  fs.chmodSync(envFile, 0o600);
  Object.assign(process.env, updates);
  return backupDir;
}

function verifyBaselineReport(file: string): { report: BaselineReport; byId: Map<string, BaselineListing> } {
  if (!fs.existsSync(file)) throw new Error(`Baseline report is missing: ${file}`);
  const report = JSON.parse(fs.readFileSync(file, "utf8")) as BaselineReport;
  const { report_sha256: reportHash, ...reportPayload } = report;
  if (hashJson(reportPayload) !== reportHash) throw new Error("Baseline report SHA-256 mismatch.");
  const byId = new Map<string, BaselineListing>();
  for (const listing of report.listings ?? []) {
    const { baseline_sha256: listingHash, ...payload } = listing;
    if (hashJson(payload) !== listingHash) throw new Error(`Baseline SHA-256 mismatch for listing ${listing.listing_id}.`);
    byId.set(String(listing.listing_id), listing);
  }
  return { report, byId };
}

function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function isWeekday(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(now);
  return !["Sat", "Sun"].includes(weekday);
}

function epochMilliseconds(value: number | string | null): number {
  if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1000;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function modifiedWithin30Days(value: number | string | null, now = Date.now()): boolean {
  const modifiedAt = epochMilliseconds(value);
  return !modifiedAt || now - modifiedAt < 30 * 86_400_000;
}

function hasExactProposal(candidate: PlanCandidate): boolean {
  const tags = candidate.proposedTags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "));
  return (
    candidate.proposedTitle.trim().length > 0 &&
    candidate.proposedTitle.length <= 140 &&
    candidate.proposedTags.length === 13 &&
    tags.every((tag) => tag.length > 0 && tag.length <= 20) &&
    new Set(tags).size === tags.length &&
    candidate.evidence.length >= 2
  );
}

function rankCandidateBacklog(candidates: PlanCandidate[]): PlanCandidate[] {
  return [...candidates]
    .sort((left, right) => {
      const leftBlocked = Number(left.stableSeller || left.activeExperiment || left.ipRisk || left.authenticityRisk);
      const rightBlocked = Number(right.stableSeller || right.activeExperiment || right.ipRisk || right.authenticityRisk);
      if (leftBlocked !== rightBlocked) return leftBlocked - rightBlocked;
      const proposalDifference = Number(hasExactProposal(right)) - Number(hasExactProposal(left));
      if (proposalDifference) return proposalDifference;
      return right.repairPriorityScore - left.repairPriorityScore;
    })
    .slice(0, MAX_REVIEW_POOL);
}

function walkJsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
    }
  }
  return files;
}

function historicalWriteAndTrackingStatus(listingId: string, now = Date.now()): {
  writtenWithin30Days: boolean;
  activeExperiment: boolean;
} {
  const roots = [
    path.join(process.cwd(), "exports", "low-signal-breakthrough"),
    path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3")
  ];
  let writtenWithin30Days = false;
  let activeExperiment = false;
  for (const root of roots) {
    for (const file of walkJsonFiles(root)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const text = JSON.stringify(parsed);
      if (!text.includes(listingId)) continue;
      const stat = fs.statSync(file);
      if (
        /execution|success|verification/i.test(path.basename(file)) &&
        now - stat.mtimeMs < 30 * 86_400_000 &&
        hasVerifiedWriteRecord(parsed, listingId)
      ) {
        writtenWithin30Days = true;
      }
      if (/tracking/i.test(path.basename(file)) && /"status":"pending"|"status":\s*"pending"/i.test(text)) {
        activeExperiment = true;
      }
    }
  }
  return { writtenWithin30Days, activeExperiment };
}

function readDailyWriteCount(today: string): number {
  const root = path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3");
  let count = 0;
  for (const file of walkJsonFiles(root)) {
    if (!/execution-report\.json$/i.test(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
        executedAt?: string;
        results?: Array<{ status?: string; verified?: boolean }>;
      };
      if (shanghaiDate(new Date(data.executedAt ?? 0)) !== today) continue;
      count += (data.results ?? []).filter((item) => item.status === "written" && item.verified).length;
    } catch {
      // Ignore unrelated or partial reports.
    }
  }
  return count;
}

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

function headerNumber(headers: Headers, names: string[]): number | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function updateRateLimit(headers: Headers): void {
  rateLimit.limitPerDay = headerNumber(headers, ["x-limit-per-day"]) ?? rateLimit.limitPerDay;
  rateLimit.remainingToday = headerNumber(headers, ["x-remaining-today"]) ?? rateLimit.remainingToday;
  rateLimit.reserve = rateLimit.limitPerDay === null ? null : Math.max(50, Math.ceil(rateLimit.limitPerDay * 0.2));
}

function assertRateReserve(requiredCalls = 1): void {
  if (
    rateLimit.remainingToday !== null &&
    rateLimit.reserve !== null &&
    rateLimit.remainingToday - requiredCalls < rateLimit.reserve
  ) {
    throw new Error(`Etsy request blocked at 20% reserve boundary: ${rateLimit.remainingToday}/${rateLimit.limitPerDay}.`);
  }
}

async function etsyRequest(apiPath: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  assertRateReserve();
  await waitForSlot();
  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const clientSecret = process.env.ETSY_CLIENT_SECRET ?? "";
  const accessToken = process.env.ETSY_ACCESS_TOKEN ?? "";
  const response = await fetch(`${ETSY_API_BASE}${apiPath}`, {
    ...init,
    headers: {
      "x-api-key": clientSecret ? `${clientId}:${clientSecret}` : clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.headers ?? {})
    }
  });
  updateRateLimit(response.headers);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (response.status === 429) throw new Error(`Etsy 429 received for ${apiPath}; stopped without retry.`);
  if (!response.ok) throw new Error(`Etsy request failed for ${apiPath}: ${response.status} ${text}`);
  return (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>;
}

async function refreshAccessToken(): Promise<{ expiresAt: string; backupDir: string }> {
  if (tokenRefreshAttempted) throw new Error("Etsy token refresh already attempted once; stopped.");
  tokenRefreshAttempted = true;
  const clientId = process.env.ETSY_CLIENT_ID ?? "";
  const refreshToken = process.env.ETSY_REFRESH_TOKEN ?? "";
  if (!clientId || !refreshToken) throw new Error("Cannot refresh Etsy token: client ID or refresh token is missing.");
  const response = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken })
  });
  const text = await response.text();
  let token: Record<string, unknown> | null = null;
  try {
    token = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    token = null;
  }
  if (!response.ok || !token?.access_token) throw new Error(`Etsy token refresh failed: ${response.status} ${text}`);
  const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString();
  const backupDir = saveEnvValues({
    ETSY_ACCESS_TOKEN: String(token.access_token),
    ETSY_REFRESH_TOKEN: token.refresh_token ? String(token.refresh_token) : refreshToken,
    ETSY_TOKEN_EXPIRES_AT: expiresAt,
    ETSY_TOKEN_SCOPE: token.scope ? String(token.scope) : process.env.ETSY_TOKEN_SCOPE
  });
  return { expiresAt, backupDir };
}

async function ensureFreshAccessToken(): Promise<{ refreshed: boolean; expiresAt?: string; backupDir?: string }> {
  const expiresAt = process.env.ETSY_TOKEN_EXPIRES_AT ? new Date(process.env.ETSY_TOKEN_EXPIRES_AT).getTime() : 0;
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < 5 * 60_000) {
    return { refreshed: true, ...(await refreshAccessToken()) };
  }
  return { refreshed: false };
}

async function verifyOfficialScopes(): Promise<string[]> {
  const token = process.env.ETSY_ACCESS_TOKEN ?? "";
  const data = await etsyRequest("/scopes", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token })
  });
  function readScopes(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(readScopes);
    if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      return readScopes(item.scopes ?? item.scope ?? item.results ?? item.permissions);
    }
    return [];
  }
  const scopes = [...new Set(readScopes(data))].sort();
  if (!scopes.includes("listings_w")) throw new Error(`Official Etsy scopes do not include listings_w: ${scopes.join(" ")}`);
  return scopes;
}

async function readListing(listingId: string): Promise<Record<string, unknown>> {
  return etsyRequest(`/listings/${listingId}?includes=Images`, { method: "GET" });
}

function tagsOf(listing: Record<string, unknown>): string[] {
  return Array.isArray(listing.tags) ? listing.tags.map(String) : [];
}

function imageSnapshot(listing: Record<string, unknown>): Array<{ listing_image_id: string; rank: number }> {
  const images = Array.isArray(listing.images) ? (listing.images as Array<Record<string, unknown>>) : [];
  return images
    .map((image, index) => ({
      listing_image_id: String(image.listing_image_id),
      rank: Number.isFinite(Number(image.rank)) ? Number(image.rank) : index + 1
    }))
    .sort((left, right) => left.rank - right.rank);
}

function forbiddenSnapshot(listing: Record<string, unknown>): Record<string, unknown> {
  return {
    description: String(listing.description ?? ""),
    price: listing.price ?? null,
    quantity: listing.quantity ?? null,
    state: listing.state ?? null,
    taxonomy_id: listing.taxonomy_id ?? null,
    shipping_profile_id: listing.shipping_profile_id ?? null,
    images: imageSnapshot(listing)
  };
}

function assertLiveMatchesBaseline(live: Record<string, unknown>, baseline: BaselineListing): void {
  if (String(live.listing_id) !== baseline.listing_id) throw new Error(`Unexpected listing returned for ${baseline.listing_id}.`);
  if (String(live.title ?? "") !== baseline.title) throw new Error(`Live title drift detected for ${baseline.listing_id}.`);
  if (JSON.stringify(tagsOf(live)) !== JSON.stringify(baseline.tags)) throw new Error(`Live tag drift detected for ${baseline.listing_id}.`);
  if (String(live.state ?? "") !== "active") throw new Error(`Listing ${baseline.listing_id} is not active.`);
  const liveForbidden = forbiddenSnapshot(live);
  const baselineForbidden = {
    description: String(live.description ?? ""),
    price: baseline.price,
    quantity: baseline.quantity,
    state: baseline.state,
    taxonomy_id: baseline.taxonomy_id,
    shipping_profile_id: baseline.shipping_profile_id,
    images: baseline.images
  };
  const comparableLive = { ...liveForbidden, description: baselineForbidden.description };
  if (JSON.stringify(comparableLive) !== JSON.stringify(baselineForbidden)) {
    throw new Error(`Protected-field drift detected for ${baseline.listing_id}; stopped.`);
  }
}

async function patchListing(candidate: ControlledRepairCandidate): Promise<Record<string, unknown>> {
  return etsyRequest(`/shops/${EXPECTED_SHOP_ID}/listings/${candidate.listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title: candidate.proposedTitle, tags: candidate.proposedTags.join(",") })
  });
}

function trackingPlan(trackingStartTime: string, results: Array<Record<string, unknown>>): Record<string, unknown> {
  const checkpoints = [["D1", 1], ["D3", 3], ["D7", 7], ["D14", 14]] as const;
  return {
    tracking_start_time: trackingStartTime,
    mode: "read_only_checkpoints",
    listings: results.map((result) => ({
      listing_id: result.listingId,
      product: result.product,
      baseline: result.trackingBaseline,
      checkpoints: checkpoints.map(([checkpoint, days]) => ({
        checkpoint,
        due_at: new Date(new Date(trackingStartTime).getTime() + days * 86_400_000).toISOString(),
        status: "pending"
      }))
    }))
  };
}

async function buildCandidate(plan: PlanCandidate, baseline: BaselineListing): Promise<ControlledRepairCandidate> {
  const orders = await prisma.etsyTransaction.count({ where: { etsyListingId: plan.listingId } });
  const history = historicalWriteAndTrackingStatus(plan.listingId);
  const capturedAt = new Date(baseline.baseline_captured_at).getTime();
  const candidate: ControlledRepairCandidate = {
    listingId: plan.listingId,
    product: plan.product,
    sku: plan.sku,
    currentTitle: baseline.title,
    currentTags: baseline.tags,
    proposedTitle: plan.proposedTitle,
    proposedTags: plan.proposedTags,
    searchIntent: plan.searchIntent,
    evidence: plan.evidence,
    repairPriorityScore: plan.repairPriorityScore,
    state: baseline.state,
    orders,
    views: plan.views,
    favorites: plan.favorites,
    stableSeller: plan.stableSeller,
    modifiedWithin30Days: modifiedWithin30Days(baseline.last_updated_timestamp) || history.writtenWithin30Days,
    activeExperiment: plan.activeExperiment || history.activeExperiment,
    materialConfirmed: plan.materialConfirmed,
    productTypeConfirmed: plan.productTypeConfirmed,
    structureConfirmed: plan.structureConfirmed,
    ipRisk: plan.ipRisk,
    authenticityRisk: plan.authenticityRisk,
    requiresOtherFieldChanges: plan.requiresOtherFieldChanges,
    independentSearchAngle: plan.independentSearchAngle,
    identifierReliable: plan.identifierReliable,
    rollbackReady: true,
    baselineSha256: baseline.baseline_sha256,
    baselineFresh: Number.isFinite(capturedAt) && Date.now() - capturedAt <= BASELINE_FRESHNESS_MS,
    repairPriorityComponents: plan.repairPriorityComponents
  };
  return applyReadinessAdjustedRepairScore(candidate);
}

async function main(): Promise<void> {
  const { planPath } = parseArgs();
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  if (process.env.ETSY_READ_ONLY_MODE !== "true" || process.env.ETSY_WRITE_APPROVED !== "false") {
    throw new Error("V3 execution must start with ETSY_READ_ONLY_MODE=true and ETSY_WRITE_APPROVED=false.");
  }
  if (!isControlledAutonomousRepairV3Enabled()) throw new Error("V3 standing authorization is not enabled.");
  if (!String(process.env.DATABASE_URL ?? "file:./dev.db").startsWith("file:")) {
    throw new Error("Etsy DATABASE_URL is not isolated SQLite.");
  }
  if (!isWeekday()) throw new Error("V3 live writes are disabled on Saturday and Sunday in Asia/Shanghai.");

  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as RepairPlan;
  if (plan.version !== "V3") throw new Error("Repair plan version must be V3.");
  if (!plan.candidates.length || plan.candidates.length < MIN_REVIEW_POOL || plan.candidates.length > MAX_CANDIDATE_BACKLOG) {
    throw new Error(`V3 requires a candidate backlog of ${MIN_REVIEW_POOL} to ${MAX_CANDIDATE_BACKLOG} listings.`);
  }
  if (new Set(plan.candidates.map((candidate) => candidate.listingId)).size !== plan.candidates.length) {
    throw new Error("V3 candidate pool contains duplicate listing IDs.");
  }
  const baselinePath = path.resolve(plan.baselineReportPath);
  const baselines = verifyBaselineReport(baselinePath);
  const candidatePool = rankCandidateBacklog(plan.candidates);
  const runRoot = path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3", plan.batchKey);
  const successMarker = path.join(runRoot, "execution-success.json");
  if (fs.existsSync(successMarker)) {
    const existing = JSON.parse(fs.readFileSync(successMarker, "utf8"));
    console.log(`V3_RESULT_JSON=${JSON.stringify({ ...existing, idempotentReplay: true })}`);
    return;
  }

  const reviews: ReviewRecord[] = [];
  for (const item of candidatePool) {
    const baseline = baselines.byId.get(item.listingId);
    if (!baseline) {
      reviews.push({
        listingId: item.listingId,
        product: item.product,
        zone: "yellow" as const,
        confidence: 0,
        approvedForAutomaticExecution: false,
        reasons: ["Current complete baseline is unavailable in the supplied baseline report."]
      });
      continue;
    }
    const candidate = await buildCandidate(item, baseline);
    const validation = validateControlledRepairProposal(candidate);
    const review = independentlyReviewControlledRepair(candidate, validation);
    reviews.push({ ...review, listingId: item.listingId, product: item.product, candidate, validation });
  }
  const green = reviews
    .filter(
      (review): review is ReviewRecord & { candidate: ControlledRepairCandidate } =>
        review.zone === "green" && review.approvedForAutomaticExecution && Boolean(review.candidate)
    )
    .sort((left, right) => right.candidate.repairPriorityScore - left.candidate.repairPriorityScore)
    .slice(0, MAX_WRITES_PER_DAY);
  const preflight = {
    version: "V3",
    batchKey: plan.batchKey,
    generatedAt: new Date().toISOString(),
    candidateBacklogCount: plan.candidates.length,
    candidatePoolCount: candidatePool.length,
    greenCount: green.length,
    yellowCount: reviews.filter((review) => review.zone === "yellow").length,
    redCount: reviews.filter((review) => review.zone === "red").length,
    reviews
  };
  atomicJson(path.join(runRoot, "auto-review.json"), preflight);

  const dailyWrites = readDailyWriteCount(shanghaiDate());
  if (dailyWrites + green.length > MAX_WRITES_PER_DAY) {
    throw new Error(`Daily write limit blocked V3: ${dailyWrites} verified write(s) already recorded today.`);
  }
  if (!green.length) {
    const report = {
      executedAt: new Date().toISOString(),
      version: "V3",
      standingAuthorizationEffective: true,
      candidateBacklogCount: plan.candidates.length,
      candidatePoolCount: candidatePool.length,
      greenCandidates: [],
      results: [],
      yellowCount: reviews.filter((review) => review.zone === "yellow").length,
      yellowCandidates: reviews
        .filter((review) => review.zone === "yellow")
        .map((review) => ({ listingId: review.listingId, product: review.product, reasons: review.reasons })),
      redCount: reviews.filter((review) => review.zone === "red").length,
      redCandidates: reviews
        .filter((review) => review.zone === "red")
        .map((review) => ({ listingId: review.listingId, product: review.product, reasons: review.reasons })),
      rollbackStatus: "NOT_REQUIRED",
      readOnlyRestored: true,
      rateLimit,
      otherFieldsModified: false,
      trackingStarted: false
    };
    atomicJson(successMarker, report);
    console.log(`V3_RESULT_JSON=${JSON.stringify(report)}`);
    return;
  }

  const tokenRefresh = await ensureFreshAccessToken();
  const officialScopes = await verifyOfficialScopes();
  assertRateReserve(green.length * 3);

  const executionTime = new Date().toISOString();
  const executionDir = path.join(runRoot, `execution-${executionTime.replace(/[:.]/g, "-")}`);
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const reviewed of green) {
      const candidate = reviewed.candidate as ControlledRepairCandidate;
      const baseline = baselines.byId.get(candidate.listingId);
      if (!baseline) throw new Error(`Baseline disappeared for ${candidate.listingId}.`);
      const live = await readListing(candidate.listingId);
      assertLiveMatchesBaseline(live, baseline);

      const liveModified =
        (live.updated_timestamp as number | string | null | undefined) ??
        (live.last_modified_timestamp as number | string | null | undefined) ??
        baseline.last_updated_timestamp;
      const liveCandidate: ControlledRepairCandidate = {
        ...candidate,
        state: String(live.state ?? ""),
        views: Number.isFinite(Number(live.views)) ? Number(live.views) : candidate.views,
        favorites: Number.isFinite(Number(live.num_favorers)) ? Number(live.num_favorers) : candidate.favorites,
        modifiedWithin30Days: candidate.modifiedWithin30Days || modifiedWithin30Days(liveModified)
      };
      const liveValidation = validateControlledRepairProposal(liveCandidate);
      const liveReview = independentlyReviewControlledRepair(liveCandidate, liveValidation);
      if (!liveValidation.passed || !liveReview.approvedForAutomaticExecution || liveReview.zone !== "green") {
        throw new Error(`Live independent review moved ${candidate.product} out of the green zone.`);
      }

      const rollbackFile = path.join(executionDir, `${candidate.listingId}-rollback.json`);
      const beforeForbidden = forbiddenSnapshot(live);
      atomicJson(rollbackFile, {
        baseline,
        live_prewrite: live,
        baseline_sha256: baseline.baseline_sha256,
        live_prewrite_sha256: hashJson(live),
        captured_at: new Date().toISOString()
      });

      const diffs = [liveValidation.diff];
      const oneTimeWindowId = crypto.randomUUID();
      writeWindowOpen = true;
      process.env.ETSY_READ_ONLY_MODE = "false";
      process.env.ETSY_WRITE_APPROVED = "true";
      assertEtsyListingWriteGuard({
        approval: {
          founderApproved: false,
          csoApproved: false,
          approvalReference: "",
          standingAuthorization: {
            enabled: true,
            version: "V3",
            authorizationReference: "MENSSKULL-ETSY-CONTROLLED-AUTONOMOUS-REPAIR-V3",
            candidateZone: "green",
            listingId: candidate.listingId,
            exactDiffSha256: hashEtsyListingWriteDiffs(diffs),
            repairPriorityScore: candidate.repairPriorityScore,
            autoReviewConfidence: liveReview.confidence,
            deterministicValidationPassed: liveValidation.passed,
            independentReviewPassed: liveReview.approvedForAutomaticExecution,
            oneTimeWindowId
          }
        },
        dryRunDiffReviewed: true,
        rollbackBaseline: baseline,
        diffs,
        listingsEditedToday: dailyWrites + results.length
      });
      if (!writeWindowOpen) throw new Error("One-time write window closed unexpectedly.");
      await patchListing(candidate);
      writeWindowOpen = false;
      process.env.ETSY_READ_ONLY_MODE = "true";
      process.env.ETSY_WRITE_APPROVED = "false";

      const after = await readListing(candidate.listingId);
      const verification = {
        titleExact: String(after.title ?? "") === candidate.proposedTitle,
        tagsExact: JSON.stringify(tagsOf(after)) === JSON.stringify(candidate.proposedTags),
        forbiddenFieldsUnchanged: JSON.stringify(forbiddenSnapshot(after)) === JSON.stringify(beforeForbidden),
        stateActive: String(after.state ?? "") === "active"
      };
      const verified = Object.values(verification).every(Boolean);
      const result = {
        listingId: candidate.listingId,
        product: candidate.product,
        status: "written",
        verified,
        before: { title: baseline.title, tags: baseline.tags },
        after: { title: candidate.proposedTitle, tags: candidate.proposedTags },
        autoReviewConfidence: liveReview.confidence,
        repairPriorityScore: candidate.repairPriorityScore,
        verification,
        rollbackFile,
        rollbackSha256: baseline.baseline_sha256,
        oneTimeWindowId,
        trackingBaseline: {
          views: Number.isFinite(Number(after.views)) ? Number(after.views) : null,
          favorites: Number.isFinite(Number(after.num_favorers)) ? Number(after.num_favorers) : null,
          orders: candidate.orders,
          revenue: candidate.orders === 0 ? 0 : "UNKNOWN"
        }
      };
      results.push(result);
      atomicJson(path.join(executionDir, `${candidate.listingId}-verification.json`), result);
      if (!verified) throw new Error(`Exact verification failed for ${candidate.product}; stopped before the next listing.`);
    }
  } finally {
    writeWindowOpen = false;
    process.env.ETSY_READ_ONLY_MODE = "true";
    process.env.ETSY_WRITE_APPROVED = "false";
  }

  const trackingStartTime = new Date().toISOString();
  const tracking = trackingPlan(trackingStartTime, results);
  atomicJson(path.join(runRoot, "tracking.json"), tracking);
  const report = {
    executedAt: executionTime,
    version: "V3",
    standingAuthorizationEffective: true,
    candidateBacklogCount: plan.candidates.length,
    candidatePoolCount: candidatePool.length,
    greenCandidates: green.map((review) => ({
      listingId: review.listingId,
      product: review.product,
      confidence: review.confidence,
      repairPriorityScore: review.candidate?.repairPriorityScore
    })),
    results,
    yellowCount: reviews.filter((review) => review.zone === "yellow").length,
    yellowCandidates: reviews
      .filter((review) => review.zone === "yellow")
      .map((review) => ({ listingId: review.listingId, product: review.product, reasons: review.reasons })),
    redCount: reviews.filter((review) => review.zone === "red").length,
    redCandidates: reviews
      .filter((review) => review.zone === "red")
      .map((review) => ({ listingId: review.listingId, product: review.product, reasons: review.reasons })),
    officialScopes,
    tokenRefresh,
    rollbackStatus: results.every((result) => Boolean(result.rollbackFile)) ? "COMPLETE" : "INCOMPLETE",
    readOnlyRestored: process.env.ETSY_READ_ONLY_MODE === "true" && process.env.ETSY_WRITE_APPROVED === "false",
    rateLimit,
    otherFieldsModified: results.some((result) => !(result.verification as { forbiddenFieldsUnchanged: boolean }).forbiddenFieldsUnchanged),
    trackingStarted: results.length > 0,
    trackingStartTime
  };
  if (
    results.length !== green.length ||
    results.some((result) => !result.verified) ||
    !report.readOnlyRestored ||
    report.otherFieldsModified
  ) {
    throw new Error("V3 did not finish in a fully verified, protected-field-unchanged, read-only-restored state.");
  }
  atomicJson(path.join(executionDir, "execution-report.json"), report);
  atomicJson(successMarker, report);
  console.log(`V3_RESULT_JSON=${JSON.stringify(report)}`);
}

main()
  .catch((error) => {
    writeWindowOpen = false;
    process.env.ETSY_READ_ONLY_MODE = "true";
    process.env.ETSY_WRITE_APPROVED = "false";
    const failure = {
      executedAt: new Date().toISOString(),
      version: "V3",
      error: error instanceof Error ? error.message : String(error),
      readOnlyRestored: true,
      stoppedWithoutRetry: true,
      rateLimit
    };
    const failureDir = path.join(process.cwd(), "exports", "controlled-autonomous-repair-v3", "failures");
    atomicJson(path.join(failureDir, `failure-${failure.executedAt.replace(/[:.]/g, "-")}.json`), failure);
    console.error(`V3_ERROR_JSON=${JSON.stringify(failure)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
