import { supabaseRequest } from "./supabase";

export const conversionEventNames = [
  "waitlist_joined",
  "checkout_started",
  "founding_purchase_completed",
  "subscription_started",
  "payment_failed",
  "refund_completed",
  "marketing_unsubscribed",
] as const;

export type ConversionEventName = (typeof conversionEventNames)[number];

export function sanitizeAttribution(value: string | null | undefined, maxLength = 120) {
  return value?.trim().replace(/[^a-zA-Z0-9 _.,:/@+-]/g, "").slice(0, maxLength) || null;
}

export async function recordConversion(
  eventName: ConversionEventName,
  details: { source?: string | null; page?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; referenceId?: string | null } = {},
) {
  await supabaseRequest("conversion_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      event_name: eventName,
      source: sanitizeAttribution(details.source, 80),
      page: sanitizeAttribution(details.page, 160),
      utm_source: sanitizeAttribution(details.utmSource),
      utm_medium: sanitizeAttribution(details.utmMedium),
      utm_campaign: sanitizeAttribution(details.utmCampaign),
      reference_id: sanitizeAttribution(details.referenceId, 200),
    }),
  });
}

export async function recordConversionSafely(eventName: ConversionEventName, details?: Parameters<typeof recordConversion>[1]) {
  try {
    await recordConversion(eventName, details);
  } catch (error) {
    console.error("Conversion event could not be recorded", eventName, error instanceof Error ? error.message : error);
  }
}
