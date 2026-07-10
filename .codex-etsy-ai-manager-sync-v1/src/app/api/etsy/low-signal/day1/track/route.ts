import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchListingDetails, fetchTransactions } from "@/lib/integrations/etsy/client";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";
import { isEtsyWriteApprovalFlagEnabled } from "@/lib/integrations/etsy/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACKING_STARTED_AT = "2026-07-10T07:58:52.658Z";
const D1_ELIGIBLE_AT = "2026-07-11T07:58:52.658Z";

const DAY1_BASELINES = [
  {
    listingId: 4515032622,
    product: "Sterling Silver Ram Ring",
    views: 17,
    favorites: 2,
    orders: 0,
    revenue: 0,
    tagsBefore: 0,
    tagsAfter: 13
  },
  {
    listingId: 4533307056,
    product: "Cocker Spaniel Ring",
    views: 0,
    favorites: 0,
    orders: 0,
    revenue: 0,
    tagsBefore: 13,
    tagsAfter: 13
  },
  {
    listingId: 4525990305,
    product: "Rooster Ring",
    views: 8,
    favorites: 0,
    orders: 0,
    revenue: 0,
    tagsBefore: 13,
    tagsAfter: 13
  }
] as const;

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function moneyValue(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  if (!value || typeof value !== "object") return 0;
  const money = value as Record<string, unknown>;
  const amount = numberValue(money.amount);
  const divisor = numberValue(money.divisor) || 100;
  return amount / divisor;
}

function transactionListingId(transaction: Record<string, unknown>): number {
  return numberValue(transaction.listing_id ?? transaction.listingId);
}

function transactionRevenue(transaction: Record<string, unknown>): number {
  const quantity = Math.max(1, numberValue(transaction.quantity));
  const unitPrice = moneyValue(transaction.price ?? transaction.transaction_price);
  return unitPrice * quantity;
}

export async function GET() {
  if (!isReadOnlyMode()) {
    return NextResponse.json({ error: "Tracking blocked because ETSY_READ_ONLY_MODE is not true." }, { status: 409 });
  }
  if (isEtsyWriteApprovalFlagEnabled()) {
    return NextResponse.json({ error: "Tracking blocked because ETSY_WRITE_APPROVED must remain false." }, { status: 409 });
  }

  const capturedAt = new Date();
  const eligibleAt = new Date(D1_ELIGIBLE_AT);
  if (capturedAt.getTime() < eligibleAt.getTime()) {
    return NextResponse.json(
      {
        status: "waiting-for-24-hours",
        trackingStartedAt: TRACKING_STARTED_AT,
        eligibleAt: D1_ELIGIBLE_AT,
        capturedAt: capturedAt.toISOString(),
        remainingSeconds: Math.ceil((eligibleAt.getTime() - capturedAt.getTime()) / 1000),
        etsyReadOnlyMode: true,
        etsyWriteApproved: false
      },
      { status: 425 }
    );
  }

  const [transactions, ...listingResponses] = await Promise.all([
    fetchTransactions(undefined, { maxItems: 5000 }),
    ...DAY1_BASELINES.map((baseline) => fetchListingDetails(baseline.listingId))
  ]);
  const transactionRows = (transactions.results ?? []) as Array<Record<string, unknown>>;

  const listings = DAY1_BASELINES.map((baseline, index) => {
    const listing = listingResponses[index] as Record<string, unknown>;
    const listingTransactions = transactionRows.filter(
      (transaction) => transactionListingId(transaction) === baseline.listingId
    );
    const current = {
      views: numberValue(listing.views),
      favorites: numberValue(listing.num_favorers ?? listing.favorites),
      orders: listingTransactions.length,
      units: listingTransactions.reduce((sum, transaction) => sum + Math.max(1, numberValue(transaction.quantity)), 0),
      revenue: Number(listingTransactions.reduce((sum, transaction) => sum + transactionRevenue(transaction), 0).toFixed(2)),
      state: String(listing.state ?? "unknown"),
      lastUpdatedTime:
        listing.updated_timestamp ?? listing.last_modified_timestamp ?? listing.updated_at ?? listing.last_modified_tsz ?? null
    };
    const delta = {
      views: current.views - baseline.views,
      favorites: current.favorites - baseline.favorites,
      orders: current.orders - baseline.orders,
      revenue: Number((current.revenue - baseline.revenue).toFixed(2))
    };
    return {
      listingId: baseline.listingId,
      product: baseline.product,
      baseline,
      current,
      delta,
      findings: {
        gainedTraffic: delta.views > 0,
        firstTraffic: baseline.views === 0 && current.views > 0,
        gainedFavorite: delta.favorites > 0,
        abnormalDecline: delta.views < 0 || delta.favorites < 0 || delta.orders < 0 || delta.revenue < 0,
        stateAnomaly: current.state !== "active"
      }
    };
  });

  const report = {
    status: "captured",
    checkpoint: "D1",
    trackingStartedAt: TRACKING_STARTED_AT,
    eligibleAt: D1_ELIGIBLE_AT,
    capturedAt: capturedAt.toISOString(),
    mode: "read-only",
    etsyReadOnlyMode: isReadOnlyMode(),
    etsyWriteApproved: isEtsyWriteApprovalFlagEnabled(),
    writeEndpointCalled: false,
    listings,
    anomalies: listings
      .filter((listing) => listing.findings.abnormalDecline || listing.findings.stateAnomaly)
      .map((listing) => ({ product: listing.product, ...listing.findings }))
  };

  const outDir = path.join(process.cwd(), "exports", "low-signal-breakthrough");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `day1-D1-${capturedAt.toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return NextResponse.json({ ...report, savedReportPath: outPath });
}
