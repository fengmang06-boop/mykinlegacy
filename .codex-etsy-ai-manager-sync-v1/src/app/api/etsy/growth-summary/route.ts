import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnlyMode } from "@/lib/integrations/etsy/read-only-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

type GrowthRow = {
  date: string;
  product: string;
  status: string;
  currency: string;
  orders: number;
  units: number;
  revenue: number;
};

function parseDays(value: string | null): number {
  if (!value) return DEFAULT_DAYS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) return DEFAULT_DAYS;
  return parsed;
}

function utcDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * A privacy-safe, database-only sales aggregate.
 *
 * This route never calls Etsy, never writes to the database, and never selects
 * receipt raw JSON or buyer fields. It is deliberately GET-only.
 */
export async function GET(request: NextRequest) {
  if (!isReadOnlyMode()) {
    return NextResponse.json(
      { error: "Growth summary is available only while ETSY_READ_ONLY_MODE=true." },
      { status: 503 }
    );
  }

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const windowEnd = Math.floor(Date.now() / 1000);
  const windowStart = windowEnd - days * 24 * 60 * 60;

  const transactions = await prisma.etsyTransaction.findMany({
    where: {
      createdTimestamp: {
        gte: windowStart,
        lte: windowEnd
      }
    },
    select: {
      etsyTransactionId: true,
      etsyReceiptId: true,
      title: true,
      quantity: true,
      price: true,
      currency: true,
      createdTimestamp: true
    }
  });

  const receiptIds = Array.from(
    new Set(transactions.map((transaction) => transaction.etsyReceiptId).filter((id): id is string => Boolean(id)))
  );
  const receipts = receiptIds.length
    ? await prisma.etsyReceipt.findMany({
        where: { etsyReceiptId: { in: receiptIds } },
        select: { etsyReceiptId: true, status: true }
      })
    : [];
  const statusByReceipt = new Map(receipts.map((receipt) => [receipt.etsyReceiptId, receipt.status ?? "unknown"]));

  const groups = new Map<string, GrowthRow & { orderKeys: Set<string> }>();
  for (const transaction of transactions) {
    if (!transaction.createdTimestamp) continue;
    const date = utcDate(transaction.createdTimestamp);
    const product = transaction.title?.trim() || "Untitled Etsy listing";
    const status = transaction.etsyReceiptId ? statusByReceipt.get(transaction.etsyReceiptId) ?? "unknown" : "unknown";
    const currency = transaction.currency?.trim() || "unknown";
    const key = [date, product, status, currency].join("\u0000");
    const row = groups.get(key) ?? {
      date,
      product,
      status,
      currency,
      orders: 0,
      units: 0,
      revenue: 0,
      orderKeys: new Set<string>()
    };

    row.orderKeys.add(transaction.etsyReceiptId ?? transaction.etsyTransactionId);
    row.units += transaction.quantity;
    row.revenue += (transaction.price ?? 0) * transaction.quantity;
    groups.set(key, row);
  }

  const rows = Array.from(groups.values())
    .map(({ orderKeys, ...row }) => ({ ...row, orders: orderKeys.size, revenue: roundMoney(row.revenue) }))
    .sort((left, right) => right.date.localeCompare(left.date) || right.revenue - left.revenue || left.product.localeCompare(right.product));

  return NextResponse.json({
    mode: "read-only",
    writeEndpointCalled: false,
    source: "Local synced EtsyReceipt and EtsyTransaction records",
    privacy: "No buyer names, emails, addresses, raw receipt data, receipt IDs, or transaction IDs are returned.",
    window: {
      days,
      startUtc: new Date(windowStart * 1000).toISOString(),
      endUtc: new Date(windowEnd * 1000).toISOString()
    },
    summary: {
      transactionRows: transactions.length,
      orders: rows.reduce((total, row) => total + row.orders, 0),
      units: rows.reduce((total, row) => total + row.units, 0)
    },
    rows
  });
}

export async function POST() {
  return NextResponse.json({ error: "Growth summary is read-only. Use GET." }, { status: 405, headers: { Allow: "GET" } });
}
