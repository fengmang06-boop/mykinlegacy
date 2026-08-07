import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchListingDetails } from "@/lib/integrations/etsy/client";
import { getEtsyDailyReserve, getEtsyRateLimitSnapshot } from "@/lib/integrations/etsy/rate-limit";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKPOINTS = new Set(["D1", "D3", "D7", "D14"]);
const BATCH_KEY_PATTERN = /^batch-[a-z0-9-]+$/;

type TrackingBaseline = {
  views: number | string | null;
  favorites: number | string | null;
  orders: number | string | null;
  revenue: number | string | null;
};

type TrackingFile = {
  tracking_start_time: string;
  mode: string;
  listings: Array<{
    listing_id: string;
    product: string;
    baseline: TrackingBaseline;
    checkpoints: Array<{ checkpoint: string; due_at: string; status: string }>;
  }>;
};

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function atomicJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function safeBatchDirectory(batchKey: string): string {
  if (batchKey === "batch-3-legacy") {
    return path.resolve(process.cwd(), "exports", "low-signal-breakthrough", "batch-3");
  }
  if (!BATCH_KEY_PATTERN.test(batchKey)) throw new Error("Invalid batchKey.");
  const root = path.resolve(process.cwd(), "exports", "controlled-autonomous-repair-v3");
  const directory = path.resolve(root, batchKey);
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error("Invalid batch path.");
  return directory;
}

export async function GET(request: NextRequest) {
  if (!isReadOnlyMode() || isEtsyWriteApprovalFlagEnabled()) {
    return NextResponse.json(
      { error: "V3 tracking requires ETSY_READ_ONLY_MODE=true and ETSY_WRITE_APPROVED=false." },
      { status: 409 }
    );
  }

  const batchKey = request.nextUrl.searchParams.get("batchKey") ?? "";
  const checkpoint = request.nextUrl.searchParams.get("checkpoint") ?? "";
  if (!CHECKPOINTS.has(checkpoint)) {
    return NextResponse.json({ error: "checkpoint must be D1, D3, D7, or D14." }, { status: 400 });
  }

  let batchDirectory: string;
  try {
    batchDirectory = safeBatchDirectory(batchKey);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const trackingPath = path.join(batchDirectory, "tracking.json");
  if (!fs.existsSync(trackingPath)) {
    return NextResponse.json({ error: "Registered V3 tracking file was not found." }, { status: 404 });
  }
  const tracking = JSON.parse(fs.readFileSync(trackingPath, "utf8")) as TrackingFile;
  if (tracking.mode !== "read_only_checkpoints" || !tracking.listings.length || tracking.listings.length > 3) {
    return NextResponse.json({ error: "Registered V3 tracking file is invalid." }, { status: 409 });
  }

  const reportPath = path.join(batchDirectory, `checkpoint-${checkpoint}.json`);
  if (fs.existsSync(reportPath)) {
    const existing = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    return NextResponse.json({ ...existing, deduplicated: true, apiCallsUsed: 0 });
  }

  const dueTimes = tracking.listings.map((listing) =>
    listing.checkpoints.find((item) => item.checkpoint === checkpoint)?.due_at
  );
  if (dueTimes.some((value) => !value)) {
    return NextResponse.json({ error: `Checkpoint ${checkpoint} is not registered for every listing.` }, { status: 409 });
  }
  const eligibleAt = new Date(Math.max(...dueTimes.map((value) => new Date(value as string).getTime())));
  const capturedAt = new Date();
  if (capturedAt < eligibleAt) {
    return NextResponse.json(
      {
        status: "waiting",
        batchKey,
        checkpoint,
        eligibleAt: eligibleAt.toISOString(),
        capturedAt: capturedAt.toISOString(),
        apiCallsUsed: 0
      },
      { status: 425 }
    );
  }

  const listings = [];
  let apiCallsUsed = 0;
  for (const registered of tracking.listings) {
    const live = (await fetchListingDetails(registered.listing_id, {
      noRetry: true,
      requestClass: "baseline"
    })) as Record<string, unknown>;
    apiCallsUsed += 1;

    const transactions = await prisma.etsyTransaction.findMany({
      where: { etsyListingId: registered.listing_id },
      select: { quantity: true, price: true, syncedAt: true }
    });
    const orders = transactions.length;
    const revenue = Number(
      transactions.reduce((sum, item) => sum + (item.price ?? 0) * Math.max(1, item.quantity), 0).toFixed(2)
    );
    const transactionEvidenceAt = transactions.reduce<Date | null>(
      (latest, item) => (!latest || item.syncedAt > latest ? item.syncedAt : latest),
      null
    );
    const current = {
      views: numberValue(live.views),
      favorites: numberValue(live.num_favorers ?? live.favorites),
      orders,
      revenue,
      state: String(live.state ?? "UNKNOWN"),
      lastUpdatedTime:
        live.updated_timestamp ??
        live.last_modified_timestamp ??
        live.updated_at ??
        live.last_modified_tsz ??
        "UNKNOWN"
    };
    const baseline = registered.baseline;
    const baselineViews = numberValue(baseline.views);
    const baselineFavorites = numberValue(baseline.favorites);
    const baselineOrders = numberValue(baseline.orders);
    const baselineRevenue = numberValue(baseline.revenue);
    const delta = {
      views: baselineViews === null || current.views === null ? "UNKNOWN" : current.views - baselineViews,
      favorites:
        baselineFavorites === null || current.favorites === null ? "UNKNOWN" : current.favorites - baselineFavorites,
      orders: baselineOrders === null ? "UNKNOWN" : current.orders - baselineOrders,
      revenue:
        baselineRevenue === null ? "UNKNOWN" : Number((current.revenue - baselineRevenue).toFixed(2))
    };
    const anomaly =
      current.state !== "active" ||
      Object.values(delta).some((value) => typeof value === "number" && value < 0);

    listings.push({
      listingId: registered.listing_id,
      product: registered.product,
      baseline,
      current,
      delta,
      anomaly,
      evidence: {
        listingMetrics: "Etsy official listing read",
        ordersAndRevenue: "Local synced EtsyTransaction records",
        transactionEvidenceAt: transactionEvidenceAt?.toISOString() ?? "UNKNOWN",
        controlDelta: "UNKNOWN"
      }
    });
  }

  const rateLimit = getEtsyRateLimitSnapshot();
  const report = {
    status: "captured",
    batchKey,
    checkpoint,
    trackingStartedAt: tracking.tracking_start_time,
    eligibleAt: eligibleAt.toISOString(),
    capturedAt: capturedAt.toISOString(),
    mode: "read-only",
    etsyReadOnlyMode: true,
    etsyWriteApproved: false,
    apiCallsUsed,
    writeEndpointCalled: false,
    rateLimit: {
      ...rateLimit,
      reserveRequired: getEtsyDailyReserve(rateLimit)
    },
    listings,
    anomalies: listings.filter((listing) => listing.anomaly)
  };
  atomicJson(reportPath, report);
  return NextResponse.json({ ...report, savedReportPath: reportPath, deduplicated: false });
}
