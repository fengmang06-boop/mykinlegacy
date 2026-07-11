import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { fetchListingDetails, fetchTransactions } from "@/lib/integrations/etsy/client";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExecutionResult = {
  listingId: number;
  product: string;
  trackingBaseline: { views: number; favorites: number; orders: number; units: number; revenue: number };
};

type ExecutionReport = { executedAt: string; allSuccessful: boolean; results: ExecutionResult[] };

const CHECKPOINT_DAYS = { D1: 1, D3: 3, D7: 7, D14: 14 } as const;

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function moneyValue(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  if (!value || typeof value !== "object") return 0;
  const money = value as Record<string, unknown>;
  return numberValue(money.amount) / (numberValue(money.divisor) || 100);
}

function latestExecution(outDir: string): ExecutionReport {
  const file = fs.readdirSync(outDir).filter((name) => /^day2-execution-.*\.json$/.test(name)).sort().at(-1);
  if (!file) throw new Error("No successful Day 2 execution report exists.");
  const report = JSON.parse(fs.readFileSync(path.join(outDir, file), "utf8")) as ExecutionReport;
  if (!report.allSuccessful || report.results.length !== 3) throw new Error("Latest Day 2 execution report is incomplete.");
  return report;
}

export async function GET(request: NextRequest) {
  if (!isReadOnlyMode() || isEtsyWriteApprovalFlagEnabled()) {
    return NextResponse.json({ error: "Tracking requires read-only=true and write-approved=false." }, { status: 409 });
  }
  const checkpoint = request.nextUrl.searchParams.get("checkpoint") as keyof typeof CHECKPOINT_DAYS | null;
  if (!checkpoint || !(checkpoint in CHECKPOINT_DAYS)) {
    return NextResponse.json({ error: "checkpoint must be D1, D3, D7, or D14." }, { status: 400 });
  }

  const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
  const execution = latestExecution(outDir);
  const eligibleAt = new Date(execution.executedAt);
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + CHECKPOINT_DAYS[checkpoint]);
  const capturedAt = new Date();
  if (capturedAt < eligibleAt) {
    return NextResponse.json({ status: "waiting", checkpoint, trackingStartedAt: execution.executedAt, eligibleAt: eligibleAt.toISOString(), capturedAt: capturedAt.toISOString() }, { status: 425 });
  }

  const [transactions, ...listingResponses] = await Promise.all([
    fetchTransactions(undefined, { maxItems: 5000 }),
    ...execution.results.map((result) => fetchListingDetails(result.listingId))
  ]);
  const rows = (transactions.results ?? []) as Array<Record<string, unknown>>;
  const listings = execution.results.map((result, index) => {
    const listing = listingResponses[index] as Record<string, unknown>;
    const listingRows = rows.filter((row) => numberValue(row.listing_id ?? row.listingId) === result.listingId);
    const current = {
      views: numberValue(listing.views),
      favorites: numberValue(listing.num_favorers ?? listing.favorites),
      orders: listingRows.length,
      units: listingRows.reduce((sum, row) => sum + Math.max(1, numberValue(row.quantity)), 0),
      revenue: Number(listingRows.reduce((sum, row) => sum + moneyValue(row.price ?? row.transaction_price) * Math.max(1, numberValue(row.quantity)), 0).toFixed(2)),
      state: String(listing.state ?? "unknown"),
      lastUpdatedTime: listing.updated_timestamp ?? listing.last_modified_timestamp ?? listing.updated_at ?? listing.last_modified_tsz ?? null
    };
    const baseline = result.trackingBaseline;
    const delta = {
      views: current.views - baseline.views,
      favorites: current.favorites - baseline.favorites,
      orders: current.orders - baseline.orders,
      units: current.units - baseline.units,
      revenue: Number((current.revenue - baseline.revenue).toFixed(2))
    };
    return { listingId: result.listingId, product: result.product, baseline, current, delta,
      anomaly: delta.views < 0 || delta.favorites < 0 || delta.orders < 0 || delta.revenue < 0 || current.state !== "active" };
  });

  const report = {
    status: "captured", checkpoint, trackingStartedAt: execution.executedAt, eligibleAt: eligibleAt.toISOString(),
    capturedAt: capturedAt.toISOString(), mode: "read-only", etsyReadOnlyMode: true, etsyWriteApproved: false,
    writeEndpointCalled: false, listings, anomalies: listings.filter((listing) => listing.anomaly)
  };
  const reportPath = path.join(outDir, `day2-${checkpoint}-${capturedAt.toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return NextResponse.json({ ...report, savedReportPath: reportPath });
}
