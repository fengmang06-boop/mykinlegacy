import { NextResponse } from "next/server";
import {
  captureListingBaselines,
  validateBatchKey,
  validateListingIds
} from "@/lib/integrations/etsy/listing-baseline";
import { EtsyApiError } from "@/lib/integrations/etsy/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { listingIds?: unknown; batchKey?: unknown; forceApi?: unknown };
    const listingIds = validateListingIds(body.listingIds);
    const batchKey = validateBatchKey(body.batchKey);
    if (typeof body.forceApi !== "undefined" && typeof body.forceApi !== "boolean") {
      throw new Error("forceApi must be a boolean when supplied.");
    }
    const result = await captureListingBaselines(listingIds, batchKey, { forceApi: body.forceApi === true });
    return NextResponse.json({ ...result.report, saved_report_path: result.savedReportPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof EtsyApiError && error.status === 429 ? 429 : /listingIds|listing ID|batchKey/.test(message) ? 400 : 409;
    return NextResponse.json(
      {
        error: message,
        mode: "read_only",
        etsy_modified: false,
        retry_attempted: false
      },
      { status }
    );
  }
}
