"use client";

import { FormEvent, useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          company: form.get("company"),
          source: "landing-page",
          marketingConsent,
          utmSource: new URLSearchParams(window.location.search).get("utm_source"),
          utmMedium: new URLSearchParams(window.location.search).get("utm_medium"),
          utmCampaign: new URLSearchParams(window.location.search).get("utm_campaign"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We couldn't save your email. Please try again.");
      setStatus("success");
      setMessage(data.emailStatus === "pending" ? "You're on the waitlist. Your confirmation email may take a little longer." : data.duplicate ? "You're already on the waitlist." : "You're on the waitlist. Watch your inbox for confirmation.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn't save your email. Please try again.");
    }
  }

  return (
    <form className="waitlist-form" onSubmit={submit} noValidate>
      <div className="honeypot" aria-hidden="true"><label htmlFor="company">Company</label><input id="company" name="company" tabIndex={-1} autoComplete="off" /></div>
      <label className="sr-only" htmlFor="waitlist-email">Email address</label>
      <div className="waitlist-fields"><input id="waitlist-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={status === "loading" || status === "success"} /><button type="submit" disabled={status === "loading" || status === "success"}>{status === "loading" ? "Joining..." : status === "success" ? "Joined" : "Join free waitlist"}</button></div>
      <label className="consent-check"><input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} required disabled={status === "loading" || status === "success"} /><span>I agree to receive FollowPact product and launch updates. Unsubscribe anytime; essential service emails are separate.</span></label>
      {message && <p className={`form-message ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
    </form>
  );
}
