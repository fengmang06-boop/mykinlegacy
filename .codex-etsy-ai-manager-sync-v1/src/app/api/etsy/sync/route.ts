import { NextResponse } from "next/server";
import { syncEtsyReadOnly } from "@/lib/integrations/etsy/sync-read-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await syncEtsyReadOnly();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET() {
  return NextResponse.json(
    { error: "Etsy sync is never started by GET. Use an explicit POST request after reviewing API quota." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
