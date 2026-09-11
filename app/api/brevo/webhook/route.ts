import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordConversionSafely } from "@/lib/analytics";
import { removeBrevoContactFromMarketingList } from "@/lib/brevo";
import { supabaseRequest } from "@/lib/supabase";

type BrevoEvent = {
  event?: string;
  email?: string;
  "message-id"?: string;
  messageId?: string;
  date?: string;
};

function sameSecret(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function isAuthorized(request: Request) {
  const expected = process.env.BREVO_WEBHOOK_TOKEN;
  if (!expected) return false;
  const urlToken = new URL(request.url).searchParams.get("token");
  const auth = request.headers.get("authorization");
  const received = auth?.startsWith("Bearer ") ? auth.slice(7) : urlToken;
  return Boolean(received && sameSecret(received, expected));
}

async function processBrevoEvent(payload: BrevoEvent) {
  const event = payload.event?.toLowerCase();
  const email = payload.email?.trim().toLowerCase();
  const messageId = payload["message-id"] || payload.messageId;
  if (!event) return;

  const emailStatus: Record<string, string> = {
    delivered: "delivered",
    hard_bounce: "bounced",
    soft_bounce: "bounced",
    spam: "complaint",
    complaint: "complaint",
    unsubscribe: "unsubscribed",
    unsubscribed: "unsubscribed",
    blocked: "bounced",
  };
  if (messageId && emailStatus[event]) {
    await supabaseRequest(`email_events?provider_message_id=eq.${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: emailStatus[event], updated_at: new Date().toISOString() }),
    });
  }

  if (email && ["hard_bounce", "blocked", "spam", "complaint", "unsubscribe", "unsubscribed"].includes(event)) {
    const timestamp = payload.date && !Number.isNaN(Date.parse(payload.date)) ? new Date(payload.date).toISOString() : new Date().toISOString();
    await supabaseRequest(`waitlist?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ marketing_consent: false, unsubscribed_at: timestamp, brevo_sync_status: event, updated_at: new Date().toISOString() }),
    });
    await removeBrevoContactFromMarketingList(email).catch((error) => console.error("Brevo list removal failed", error));
    await recordConversionSafely("marketing_unsubscribed", { source: "brevo", referenceId: createHash("sha256").update(email).digest("hex") });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const events = Array.isArray(body) ? body : [body];
    for (const event of events) {
      if (event && typeof event === "object") await processBrevoEvent(event as BrevoEvent);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Brevo webhook failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
