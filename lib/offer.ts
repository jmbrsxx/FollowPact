import { supabaseRequest } from "./supabase";
import { FOUNDING_SEAT_LIMIT, OFFER_END_ISO } from "./offer-config";

type OrderId = { id: string };

export async function getOfferStatus() {
  const orders = await supabaseRequest<OrderId[]>("orders?select=id&kind=eq.founding&status=eq.paid&limit=10");
  const remainingSeats = Math.max(0, FOUNDING_SEAT_LIMIT - orders.length);
  const isOpen = Date.now() < new Date(OFFER_END_ISO).getTime() && remainingSeats > 0;
  return { isOpen, remainingSeats };
}

export function getCheckoutUrl(isOpen: boolean) {
  return isOpen ? process.env.STRIPE_FOUNDING_PAYMENT_LINK : process.env.STRIPE_MONTHLY_PAYMENT_LINK;
}
