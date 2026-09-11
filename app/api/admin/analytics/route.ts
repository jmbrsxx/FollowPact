import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { ConversionEventName } from "@/lib/analytics";
import { supabaseRequest } from "@/lib/supabase";

type Conversion = { event_name: ConversionEventName; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null };

function authorized(request: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  const auth = request.headers.get("authorization");
  const received = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || !received) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const events = await supabaseRequest<Conversion[]>("conversion_events?select=event_name,utm_source,utm_medium,utm_campaign&order=occurred_at.desc&limit=10000");
  const totals = Object.fromEntries(events.map((event) => event.event_name).filter((name, index, names) => names.indexOf(name) === index).map((name) => [name, events.filter((event) => event.event_name === name).length]));
  const completedPurchases = (totals.founding_purchase_completed || 0) + (totals.subscription_started || 0);
  const checkoutStarts = totals.checkout_started || 0;
  const campaigns = new Map<string, { source: string; medium: string; campaign: string; waitlistJoins: number; checkoutStarts: number; purchases: number }>();
  for (const event of events) {
    const source = event.utm_source || "direct";
    const medium = event.utm_medium || "none";
    const campaign = event.utm_campaign || "none";
    const key = `${source}\u0000${medium}\u0000${campaign}`;
    const row = campaigns.get(key) || { source, medium, campaign, waitlistJoins: 0, checkoutStarts: 0, purchases: 0 };
    if (event.event_name === "waitlist_joined") row.waitlistJoins += 1;
    if (event.event_name === "checkout_started") row.checkoutStarts += 1;
    if (["founding_purchase_completed", "subscription_started"].includes(event.event_name)) row.purchases += 1;
    campaigns.set(key, row);
  }
  return NextResponse.json({
    landingPageVisitors: null,
    visitorsSource: "Cloudflare Web Analytics dashboard",
    waitlistJoins: totals.waitlist_joined || 0,
    checkoutStarts,
    completedPurchases,
    visitorToWaitlistConversion: null,
    checkoutToPurchaseConversion: checkoutStarts ? completedPurchases / checkoutStarts : 0,
    campaigns: Array.from(campaigns.values()),
  }, { headers: { "Cache-Control": "no-store" } });
}

