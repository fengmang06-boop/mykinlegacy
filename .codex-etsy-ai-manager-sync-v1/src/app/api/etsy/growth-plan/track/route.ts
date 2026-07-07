import { NextResponse } from "next/server";
import { ensureGrowthPlanTracking } from "@/lib/etsy-growth-plan";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await ensureGrowthPlanTracking();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await ensureGrowthPlanTracking();
  return NextResponse.json(result);
}
