import type Stripe from "stripe";

export const FOUNDING_AMOUNT_CENTS = 999;

export function isPaidFoundingSession(session: Stripe.Checkout.Session) {
  const items = session.line_items?.data || [];
  return session.mode === "payment" &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.amount_total === FOUNDING_AMOUNT_CENTS &&
    session.currency?.toLowerCase() === "usd" &&
    items.length === 1 &&
    items[0].quantity === 1 &&
    items[0].price?.id === process.env.STRIPE_FOUNDING_PRICE_ID;
}
