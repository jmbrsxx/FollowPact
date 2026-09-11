"use client";

import { useEffect, useState } from "react";
import { FOUNDING_SEAT_LIMIT, OFFER_END_ISO } from "@/lib/offer-config";

const OFFER_END = new Date(OFFER_END_ISO).getTime();

function formatTimeLeft(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(days).padStart(2, "0")} days, ${String(hours).padStart(2, "0")} hours, ${String(minutes).padStart(2, "0")} minutes, ${String(seconds).padStart(2, "0")} seconds`;
}

export default function OfferCountdown() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [remainingSeats, setRemainingSeats] = useState(FOUNDING_SEAT_LIMIT);
  const [serverOpen, setServerOpen] = useState(true);

  useEffect(() => {
    const updateCountdown = () => setTimeLeft(OFFER_END - Date.now());

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshStatus = () => fetch("/api/offer-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Offer status unavailable")))
      .then((status: { isOpen: boolean; remainingSeats: number }) => {
        if (!active) return;
        setServerOpen(status.isOpen);
        setRemainingSeats(status.remainingSeats);
      })
      .catch(() => undefined);
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const hasEnded = (timeLeft !== null && timeLeft <= 0) || !serverOpen || remainingSeats <= 0;

  return (
    <div className={`offer-status${hasEnded ? " offer-ended" : ""}`} role="timer" aria-label="Founding offer availability">
      {hasEnded ? (
        <strong>Founding offer ended</strong>
      ) : (
        <>
          <strong>{remainingSeats} {remainingSeats === 1 ? "spot" : "spots"} left</strong>
          <span aria-hidden="true" />
          <p>
            Ends in <time dateTime={OFFER_END_ISO}>{timeLeft === null ? "-- days, -- hours, -- minutes, -- seconds" : formatTimeLeft(timeLeft)}</time>
          </p>
        </>
      )}
    </div>
  );
}
