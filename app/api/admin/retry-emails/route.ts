import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBrevoTemplateId, sendTrackedEmail, syncBrevoContact } from "@/lib/brevo";
import { supabaseRequest } from "@/lib/supabase";

type PendingContact = { email: string };

function isAuthorized(request: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  const auth = request.headers.get("authorization");
  const received = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || !received) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const templateId = getBrevoTemplateId("waitlist_confirmation");
  if (!templateId) return NextResponse.json({ error: "Waitlist email template is not configured." }, { status: 503 });

  const contacts = await supabaseRequest<PendingContact[]>("waitlist?confirmation_status=in.(error,pending)&marketing_consent=eq.true&unsubscribed_at=is.null&select=email&limit=25");
  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    try {
      const brevoContactId = await syncBrevoContact(contact.email);
      await sendTrackedEmail(contact.email, "waitlist_confirmation", templateId);
      await supabaseRequest(`waitlist?email=eq.${encodeURIComponent(contact.email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ brevo_contact_id: brevoContactId, brevo_sync_status: "synced", confirmation_status: "sent", confirmation_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({ attempted: contacts.length, sent, failed });
}
