import Image from "next/image";
import Link from "next/link";
import CheckoutButton from "./CheckoutButton";
import OfferCountdown from "./OfferCountdown";
import WaitlistForm from "./WaitlistForm";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

const faqs = [
  ["Is it available now?", "Not yet. Founders receive private-beta access with all main features by October 5, 2026. The full version releases November 5, 2026."],
  ["Is $9.99 a subscription?", "No. It is a discounted, one-time founding preorder with no automatic subscription. After the offer ends, regular access for new customers will be $21.99 per month."],
  ["What does founding access include?", "Private-beta access with all main features, four manual Scope-Locks, full-version access at release, and 55% off eligible paid features."],
  ["What happens if beta isn’t delivered?", "Qualifying purchases are refundable under the FollowPact Refund Policy."],
];

function FounderOfferCard() {
  return <div className="founder-offer-card">
    <div className="offer-card-top"><span><i />Now open</span></div>
    <h3>Founding Member</h3>
    <p className="offer-card-price"><strong>$9.99</strong><span>Discounted founding price · One-time</span></p>
    <p className="offer-card-regular"><span>$21.99/month</span> regular price after the founding offer</p>
    <OfferCountdown />
    <p className="offer-card-limit">Limited to 10 founding seats</p>
    <ul className="founder-list">
      <li>Private beta by October 5 with all main features</li>
      <li>Full version access at release on November 5</li>
      <li>4 manual Scope-Locks included</li>
      <li>55% off eligible paid features</li>
      <li>Direct access to the builder during beta</li>
    </ul>
    <p className="founder-builder">Founders can email <a href="mailto:followpact@gmail.com">followpact@gmail.com</a> to request additional Scope-Locks and help shape the product during beta.</p>
    <CheckoutButton />
    <p className="offer-card-terms">$9.99 founding access · Beta October 5 · Full version November 5 · No automatic subscription · <Link href="/terms">Terms</Link></p>
  </div>;
}

function DashboardPreview() {
  return <div className="hero-product" aria-label="FollowPact product dashboard preview"><div className="window-bar"><span><i /><i /><i /></span><b>FOLLOWPACT / OVERVIEW</b><em>PRIVATE BETA</em></div><div className="dashboard-head"><div><small>Good morning, Alex</small><strong>Your freelance week</strong></div><span>Oct 05–11</span></div><div className="metric-grid"><div><small>Available</small><b>24h</b></div><div><small>Allocated</small><b>19h</b></div><div><small>Outstanding</small><b>$2,840</b></div><div><small>Active projects</small><b>3</b></div></div><div className="dashboard-grid"><div className="mini-projects"><span className="ui-label">What needs to ship</span><div><i className="dot orange-bg" /><p><b>Billing settings</b><small>Northstar · overdue</small></p><strong>Today</strong></div><div><i className="dot" /><p><b>Responsive build</b><small>Acme · in progress</small></p><strong>Oct 12</strong></div><div><i className="dot muted-bg" /><p><b>Webhook handoff</b><small>Koru · ready</small></p><strong>Oct 14</strong></div></div><div className="mini-time"><span className="ui-label">Today’s time</span><strong>5h <small>available</small></strong><div className="stacked-bar"><i /><i /><i /></div><p><span>Acme 3h</span><span>Northstar 2h</span></p></div></div></div>;
}

export default function Home() {
  const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "FollowPact", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "A freelancer operating system for client work, time, money, and project scope.", ...(siteUrl ? { url: siteUrl } : {}), offers: { "@type": "Offer", price: "9.99", priceCurrency: "USD", priceValidUntil: "2026-10-05", availability: "https://schema.org/PreOrder", ...(siteUrl ? { url: `${siteUrl}/checkout` } : {}) } };

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <header className="site-header shell"><a className="brand" href="#top" aria-label="FollowPact home"><Image src="/followpact-logo.png" alt="" width={36} height={36} priority /><span>FollowPact</span></a></header>

    <section className="hero shell" id="top" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span />A freelancer operating system</p><h1 id="hero-title">Keep client work, time,<br />money, and scope under control.</h1><p className="hero-lead">FollowPact is being built for freelance developers who are tired of managing projects across scattered tools, guessing how much time they have, chasing invoices, and starting work before the scope is clear.</p><OfferCountdown /><div className="hero-actions"><CheckoutButton /></div><p className="trust-line">$9.99 founding access · All main beta features included · 55% off eligible paid features · Full version November 5</p></div></section>

    <section className="problem-strip" aria-labelledby="problems-title"><div className="shell"><div><p className="eyebrow">The freelance reality</p><h2 id="problems-title">Less operational friction. More control.</h2></div><ul><li><span>01</span><p><strong>Unclear scope</strong> creates revision disputes. Scope-Lock records deliverables, exclusions, limits, and approval.</p></li><li><span>02</span><p><strong>Late payments</strong> make cash flow harder to predict. Invoice tracking keeps paid, outstanding, and overdue work visible.</p></li><li><span>03</span><p><strong>Scattered admin</strong> consumes non-billable time. One dashboard connects projects, deadlines, capacity, and money.</p></li><li><span>04</span><p><strong>Weak conversion</strong> is difficult to diagnose. Outreach metrics show where replies, calls, and sales drop off.</p></li></ul></div></section>

    <section className="dashboard-section shell" id="product" aria-labelledby="product-title"><div className="section-heading"><p className="eyebrow">Five core outcomes</p><h2 id="product-title">Run client work from one clear system.</h2><p>Keep the workflow tight from outreach and agreement to delivery and payment.</p></div><div className="tool-list"><article><h3>Clear project scope</h3><p>Agree on deliverables, exclusions, and revision limits before work begins.</p></article><article><h3>Projects &amp; deadlines</h3><p>Know what needs to ship and what is becoming overdue.</p></article><article><h3>Time planning</h3><p>Allocate your available hours before taking on too much work.</p></article><article><h3>Invoices &amp; payments</h3><p>See what&apos;s paid, outstanding, and overdue.</p></article><article><h3>Outreach improvement</h3><p>Track replies, booked calls, sales, and conversion signals that show what needs improvement.</p></article></div><DashboardPreview /></section>

    <section className="outreach-section shell" id="outreach" aria-labelledby="outreach-title"><div className="section-heading"><p className="eyebrow">Outreach improvement</p><h2 id="outreach-title">See where your sales process breaks down.</h2><p>FollowPact turns outreach results into a clear signal, so you know when conversion needs attention.</p></div><div className="ui-panel outreach-panel" aria-label="Outreach performance example"><div className="ui-top"><span>Outreach performance</span><i>LAST 30 DAYS</i></div><div className="outreach-metrics"><div><small>Replies</small><b>100</b></div><div><small>Calls booked</small><b>5</b></div><div><small>Sales</small><b>0</b></div></div><div className="funnel-bars"><div><span>Replies</span><i style={{ width: "100%" }} /><b>100</b></div><div><span>Calls</span><i style={{ width: "5%" }} /><b>5</b></div><div><span>Sales</span><i style={{ width: "0%" }} /><b>0</b></div></div><p className="signal-note"><span>Needs improvement</span>Low sales conversion: replies are coming in, but booked calls are not becoming sales.</p></div></section>

    <section className="scope-section" id="scope-lock" aria-labelledby="scope-title"><div className="shell scope-grid"><div className="scope-copy"><p className="eyebrow">Client Scope-Lock</p><h2 id="scope-title">Lock the scope before you start.</h2><p>Projects become painful when the client and freelancer remember the agreement differently.</p><p>Each structured Scope-Lock records:</p><ul className="check-list"><li>Deliverables and exclusions</li><li>Project price and deposit</li><li>Deadline and delivery conditions</li><li>Revision limits</li><li>Additional-work rules</li><li>Client approval status</li></ul><p className="manual-note">Founding access includes up to <strong>4 manual Client Scope-Locks</strong>. Founders can email <a href="mailto:followpact@gmail.com">followpact@gmail.com</a> to request more.</p></div><div className="scope-document scope-document-short" aria-label="Example of the structured Client Scope-Lock founders receive"><div className="document-head"><span>FOLLOWPACT / CLIENT SCOPE-LOCK</span><em>Approval pending</em></div><h3>Acme Website Redesign</h3><div className="document-meta"><div><small>Project price</small><b>$1,200</b></div><div><small>Deposit</small><b>$600 / 50%</b></div><div><small>Deadline</small><b>October 19</b></div><div><small>Revisions</small><b>2 rounds</b></div></div><div className="document-columns"><div><small>Deliverables</small><p>Homepage, services page, contact page</p></div><div><small>Excluded</small><p>Copywriting and logo design</p></div></div><div className="document-rule"><small>Start condition</small><p>Work begins after the $600 deposit and written client approval.</p></div><div className="document-rule"><small>Additional-work rule</small><p>Requests outside the listed deliverables require written approval of the added price and timeline.</p></div><div className="document-foot"><span>Additional work <b>Requires approval</b></span><span>Client approval <b>Pending</b></span></div></div></div></section>

    <section className="founder-section shell" id="founding" aria-labelledby="founder-title"><div className="founder-intro"><p className="eyebrow">Founding access</p><h2 id="founder-title">Become a founder before the doors close.</h2><p>Get the complete founding offer in one clear package.</p></div><FounderOfferCard /><p className="founder-risk">FollowPact is an unfinished product. If the beta isn&apos;t delivered by October 5, 2026, qualifying purchases are refundable under the <Link href="/refund-policy">Refund Policy</Link>.</p></section>

    <section className="faq shell" id="faq" aria-labelledby="faq-title"><div className="faq-heading"><p className="eyebrow">FAQ</p><h2 id="faq-title">Questions, answered.</h2></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

    <section className="waitlist-section shell" id="waitlist" aria-labelledby="waitlist-title"><div className="waitlist-box"><span>FREE WAITLIST</span><h3 id="waitlist-title">Not ready to preorder?</h3><p>Get one email when the public Free plan launches.</p><WaitlistForm /></div></section>

    <footer><div className="shell footer-inner"><a className="brand" href="#top"><Image src="/followpact-logo.png" alt="" width={30} height={30} /><span>FollowPact</span></a><nav aria-label="Policy links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refund-policy">Refund Policy</Link></nav><p>Payments handled securely through Stripe.</p></div></footer>
  </main>;
}
