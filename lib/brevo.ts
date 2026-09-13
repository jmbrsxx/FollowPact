import "server-only";
import { supabaseRequest } from "./supabase";

type EmailKind = "waitlist_confirmation" | "purchase_confirmation" | "beta_access" | "payment_failed" | "refund_confirmation";

const brevoApiUrl = "https://api.brevo.com/v3";

function brevoHeaders() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo is not configured");
  return { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

function numericEnv(name: string) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function syncBrevoContact(email: string, listId = numericEnv("BREVO_MARKETING_LIST_ID")) {
  const response = await fetch(`${brevoApiUrl}/contacts`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify({ email, ...(listId ? { listIds: [listId] } : {}), updateEnabled: true }),
  });
  if (!response.ok) throw new Error(`Brevo contact sync failed (${response.status})`);
  const payload = (await response.json().catch(() => ({}))) as { id?: number };
  return payload.id ? String(payload.id) : null;
}

export async function removeBrevoContactFromMarketingList(email: string) {
  const listId = numericEnv("BREVO_MARKETING_LIST_ID");
  if (!listId) return;
  const response = await fetch(`${brevoApiUrl}/contacts/${encodeURIComponent(email)}`, {
    method: "PUT",
    headers: brevoHeaders(),
    body: JSON.stringify({ unlinkListIds: [listId] }),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Brevo contact removal failed (${response.status})`);
}

export async function sendTrackedEmail(email: string, kind: EmailKind, templateId: number, params: Record<string, unknown> = {}) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail || !templateId) throw new Error("Brevo sender or template is not configured");

  const response = await fetch(`${brevoApiUrl}/smtp/email`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || "FollowPact", email: senderEmail },
      replyTo: { name: "FollowPact", email: process.env.BREVO_REPLY_TO_EMAIL || "followpact@gmail.com" },
      to: [{ email }],
      templateId,
      params,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { messageId?: string; code?: string; message?: string };
  const status = response.ok ? "sent" : "failed";
  const providerReason = [payload.code, payload.message].filter(Boolean).join(": ").replace(/[\r\n]+/g, " ").slice(0, 200);
  const lastError = response.ok ? null : `Brevo HTTP ${response.status}${providerReason ? `: ${providerReason}` : ""}`;
  await supabaseRequest("email_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ recipient_email: email, email_kind: kind, provider_message_id: payload.messageId || null, status, last_error: lastError }),
  }).catch(() => undefined);

  if (!response.ok) throw new Error(`Brevo email send failed (${response.status})${providerReason ? `: ${providerReason}` : ""}`);
  return payload.messageId || null;
}

export function getBrevoTemplateId(kind: EmailKind) {
  const names: Record<EmailKind, string> = {
    waitlist_confirmation: "BREVO_WAITLIST_TEMPLATE_ID",
    purchase_confirmation: "BREVO_PURCHASE_TEMPLATE_ID",
    beta_access: "BREVO_BETA_ACCESS_TEMPLATE_ID",
    payment_failed: "BREVO_PAYMENT_FAILED_TEMPLATE_ID",
    refund_confirmation: "BREVO_REFUND_TEMPLATE_ID",
  };
  return numericEnv(names[kind]);
}
