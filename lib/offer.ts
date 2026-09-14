import { supabaseRequest } from "./supabase";
import { FOUNDING_SEAT_LIMIT, OFFER_END_ISO } from "./offer-config";

type OrderId = { id: string };

export async function getOfferStatus() {
  const priceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  if (!priceId?.startsWith("price_")) return { isOpen: false, remainingSeats: 0 };
  const orders = await supabaseRequest<OrderId[]>(`orders?select=id&kind=eq.founding&status=eq.paid&stripe_price_id=eq.${encodeURIComponent(priceId)}&limit=${FOUNDING_SEAT_LIMIT}`);
  const remainingSeats = Math.max(0, FOUNDING_SEAT_LIMIT - orders.length);
  const isOpen = Date.now() < new Date(OFFER_END_ISO).getTime() && remainingSeats > 0;
  return { isOpen, remainingSeats };
}

export function getCheckoutUrl(isOpen: boolean) {
  if (!isOpen) return undefined;
  const key = process.env.STRIPE_SECRET_KEY;
  const link = process.env.STRIPE_FOUNDING_PAYMENT_LINK;
  const price = process.env.STRIPE_FOUNDING_PRICE_ID;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !link || !price?.startsWith("price_") || !webhookSecret?.startsWith("whsec_")) return undefined;

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  const isTestLink = url.pathname.startsWith("/test_");
  if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com" ||
    !/^\/(?:test_)?[A-Za-z0-9]+$/.test(url.pathname) || url.search || url.hash ||
    (key.startsWith("sk_test_") && !isTestLink) ||
    (key.startsWith("sk_live_") && isTestLink) ||
    (!key.startsWith("sk_test_") && !key.startsWith("sk_live_"))) return undefined;
  return link;
}
