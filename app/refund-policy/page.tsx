import type { Metadata } from "next";
import PolicyShell from "../PolicyShell";

export const metadata: Metadata = { title: "Refund Policy | FollowPact", description: "Refund terms for the FollowPact founding preorder and manual Client Scope-Lock service." };

export default function RefundPolicy() {
  return <PolicyShell label="Policy / Effective September 9, 2026" title="Refund Policy" intro="This policy explains when a FollowPact founding preorder or manual Client Scope-Lock purchase may qualify for a refund. It does not limit rights available under applicable consumer law.">
    <section><h2>Founding preorder</h2><p>The founding preorder is a one-time $9.99 payment for the benefits described on the sales page. It is not a subscription. If the promised private beta is not delivered by October 5, 2026, qualifying preorder purchasers will receive a refund.</p></section>
    <section><h2>Common situations</h2><table><thead><tr><th>Situation</th><th>General outcome</th></tr></thead><tbody><tr><td>Private beta not delivered by October 5, 2026</td><td>Qualifying preorder purchase refunded.</td></tr><tr><td>FollowPact cancels the promised beta before delivery</td><td>Preorder purchase refunded.</td></tr><tr><td>Duplicate payment</td><td>Duplicate charge refunded after verification.</td></tr><tr><td>Payment completed but promised access cannot be delivered</td><td>Refund or a reasonable opportunity to restore access.</td></tr><tr><td>Change of mind before delivery</td><td>Reviewed according to timing, payment status, and applicable consumer law.</td></tr></tbody></table></section>
    <section><h2>Manual Client Scope-Lock</h2><p>Founding access includes up to four manual Scope-Locks for four projects. If preparation has not begun, a cancellation request may qualify for a refund. After meaningful preparation or delivery, a change-of-mind refund may not be available. Duplicate charges, failed delivery, or a material failure to provide the purchased service will be reviewed and corrected or refunded as appropriate.</p></section>
    <section><h2>How to request help</h2><p>Email <a href="mailto:followpactofficial@gmail.com">followpactofficial@gmail.com</a> with the purchase email, payment reference if available, and a short explanation. Requests are reviewed against this policy and applicable law.</p></section>
  </PolicyShell>;
}
