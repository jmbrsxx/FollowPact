import { NextResponse } from "next/server";
import { getOfferStatus } from "@/lib/offer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOfferStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Offer status failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Offer status is temporarily unavailable." }, { status: 503 });
  }
}

