import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Checkout unavailable | FollowPact", robots: { index: false, follow: false } };

export default function PaymentUnavailable() {
  return <main className="payment-page"><div className="payment-card"><p className="eyebrow">Checkout unavailable</p><h1>Checkout isn’t ready right now.</h1><p>No payment was taken. Please try again shortly, join the free waitlist, or email <a href="mailto:followpact@gmail.com">followpact@gmail.com</a>.</p><Link className="button button-primary" href="/#waitlist">Return to FollowPact <span aria-hidden="true">↗</span></Link></div></main>;
}

