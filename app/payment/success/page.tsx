import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { isPaidFoundingSession } from "@/lib/founding-payment";

export const metadata: Metadata = { title: "Payment received | FollowPact", robots: { index: false, follow: false } };

export default async function PaymentSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  let paid = false;
  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price"] });
      paid = isPaidFoundingSession(session);
    } catch {
      paid = false;
    }
  }

  return <main className="payment-page"><div className="payment-card"><p className="eyebrow">Payment status</p><h1>{paid ? "Payment received." : "We’re confirming your payment."}</h1><p>{paid ? "Stripe has confirmed the checkout. Your receipt and FollowPact access details will be sent by email after the verified webhook is processed." : "Payment confirmation can take a moment. You’ll receive an email as soon as Stripe confirms it."}</p><p className="payment-note">This page does not grant access by itself. Verified Stripe payment events are the source of truth.</p><Link className="button button-primary" href="/">Return to FollowPact <span aria-hidden="true">↗</span></Link></div></main>;
}
