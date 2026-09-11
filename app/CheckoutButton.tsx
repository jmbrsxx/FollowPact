"use client";

import { useEffect, useState } from "react";
import { OFFER_END_ISO } from "@/lib/offer-config";

export default function CheckoutButton() {
  const [isOpen, setIsOpen] = useState(() => Date.now() < new Date(OFFER_END_ISO).getTime());

  useEffect(() => {
    let active = true;
    fetch("/api/offer-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Offer status unavailable")))
      .then((status: { isOpen: boolean }) => { if (active) setIsOpen(status.isOpen); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <a className="button button-primary" href="/checkout?source=landing-page" data-analytics="checkout">
      {isOpen ? "Secure Founding Access — $9.99" : "Get FollowPact — $21.99/month"}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
