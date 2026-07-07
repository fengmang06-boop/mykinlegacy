import { NextResponse } from "next/server";
import { analyzeAllListings } from "@/lib/etsy-ai/listing-intelligence";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { retry?: boolean; limit?: number } = {};
  try {
    body = (await request.json()) as { retry?: boolean; limit?: number };
  } catch {
    body = {};
  }
  const result = await analyzeAllListings({ retry: body.retry === true, limit: body.limit });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET() {
  const [listingCount, reportCount, latestReport] = await Promise.all([
    prisma.listing.count(),
    prisma.listingAiReport.count(),
    prisma.listingAiReport.findFirst({ orderBy: { updatedAt: "desc" } })
  ]);
  return NextResponse.json({
    listingCount,
    reportCount,
    remaining: Math.max(0, listingCount - reportCount),
    latestReportAt: latestReport?.updatedAt ?? null
  });
}
