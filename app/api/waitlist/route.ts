import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sanitizeAttribution, recordConversionSafely } from "@/lib/analytics";
import { getBrevoTemplateId, sendTrackedEmail, syncBrevoContact } from "@/lib/brevo";
import { readLimitedBody, RequestBodyTooLarge } from "@/lib/request-body";
import { callSupabaseRpc, supabaseRequest } from "@/lib/supabase";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function isRateLimited(request: Request) {
  const ip = request.headers.get("x-nf-client-connection-ip") ||
    (process.env.NODE_ENV === "production" ? null : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim());
  if (!ip) return process.env.NODE_ENV === "production";
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) return process.env.NODE_ENV === "production";
  const key = createHash("sha256").update(`${salt}:${ip}`).digest("hex");
  const allowed = await callSupabaseRpc<boolean>("check_api_rate_limit", { p_rate_key: key, p_limit: 5, p_window_seconds: 60 });
  return !allowed;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    if (await isRateLimited(request)) return NextResponse.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
  } catch (error) {
    console.error("Waitlist rate-limit check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The waitlist is temporarily unavailable. Please try again." }, { status: 503 });
  }

  let body: { email?: unknown; company?: unknown; source?: unknown; marketingConsent?: unknown; utmSource?: unknown; utmMedium?: unknown; utmCampaign?: unknown };
  try {
    const parsed: unknown = JSON.parse(await readLimitedBody(request, 4096));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as typeof body;
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (typeof body.company === "string" && body.company.trim()) return NextResponse.json({ ok: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (body.marketingConsent !== true) return NextResponse.json({ error: "Please agree to receive FollowPact updates before joining." }, { status: 400 });

  const source = sanitizeAttribution(typeof body.source === "string" ? body.source : "landing-page", 80);
  const utmSource = sanitizeAttribution(typeof body.utmSource === "string" ? body.utmSource : null);
  const utmMedium = sanitizeAttribution(typeof body.utmMedium === "string" ? body.utmMedium : null);
  const utmCampaign = sanitizeAttribution(typeof body.utmCampaign === "string" ? body.utmCampaign : null);
  let signup: { should_send_confirmation: boolean }[];
  try {
    signup = await callSupabaseRpc("join_waitlist", {
      p_email: email,
      p_source: source,
      p_utm_source: utmSource,
      p_utm_medium: utmMedium,
      p_utm_campaign: utmCampaign,
      p_marketing_consent: true,
    });
  } catch (error) {
    console.error("Waitlist signup failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't save your email. Please try again." }, { status: 502 });
  }

  let emailStatus: "sent" | "pending" | "already-sent" = signup[0]?.should_send_confirmation ? "pending" : "already-sent";
  try {
    const brevoContactId = await syncBrevoContact(email);
    await supabaseRequest(`waitlist?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ brevo_contact_id: brevoContactId, brevo_sync_status: "synced", updated_at: new Date().toISOString() }) });
    const templateId = getBrevoTemplateId("waitlist_confirmation");
    if (signup[0]?.should_send_confirmation && !templateId) throw new Error("Waitlist confirmation template is not configured");
    if (signup[0]?.should_send_confirmation && templateId) {
      await sendTrackedEmail(email, "waitlist_confirmation", templateId);
      emailStatus = "sent";
      await supabaseRequest(`waitlist?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ confirmation_status: "sent", confirmation_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    }
  } catch {
    await supabaseRequest(`waitlist?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ brevo_sync_status: "error", confirmation_status: signup[0]?.should_send_confirmation ? "error" : undefined, updated_at: new Date().toISOString() }) }).catch(() => undefined);
  }

  if (signup[0]?.should_send_confirmation) await recordConversionSafely("waitlist_joined", { source, page: "/", utmSource, utmMedium, utmCampaign, referenceId: createHash("sha256").update(email).digest("hex") });
  return NextResponse.json({ ok: true, duplicate: !signup[0]?.should_send_confirmation, emailStatus }, { status: emailStatus === "pending" ? 202 : 200 });
}
