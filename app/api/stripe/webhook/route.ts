import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getBrevoTemplateId, sendTrackedEmail, syncBrevoContact } from "@/lib/brevo";
import { recordConversionSafely } from "@/lib/analytics";
import { getStripe } from "@/lib/stripe";
import { callSupabaseRpc, supabaseRequest } from "@/lib/supabase";

export const runtime = "nodejs";

type StoredOrder = {
  id: string;
  purchaser_email: string;
  kind: "founding" | "subscription";
  status: string;
};

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

async function claimEvent(event: Stripe.Event) {
  return callSupabaseRpc<boolean>("claim_stripe_event", { p_event_id: event.id, p_event_type: event.type });
}

async function markEvent(eventId: string, status: "processed" | "failed", lastError: string | null = null) {
  await supabaseRequest(`stripe_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, last_error: lastError, processed_at: status === "processed" ? new Date().toISOString() : null }),
  });
}

async function expandedSession(sessionId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price"] });
}

async function savePendingSession(session: Stripe.Checkout.Session, status: "pending" | "failed" | "canceled") {
  const expanded = session.line_items ? session : await expandedSession(session.id);
  const email = expanded.customer_details?.email || expanded.customer_email;
  const priceId = expanded.line_items?.data[0]?.price?.id;
  if (!email || !priceId) return;
  const kind = priceId === process.env.STRIPE_FOUNDING_PRICE_ID ? "founding" : "subscription";

  await supabaseRequest("orders?on_conflict=stripe_checkout_session_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      purchaser_email: email.toLowerCase(),
      stripe_checkout_session_id: expanded.id,
      stripe_customer_id: id(expanded.customer),
      stripe_payment_intent_id: id(expanded.payment_intent),
      stripe_subscription_id: id(expanded.subscription),
      stripe_price_id: priceId,
      kind,
      amount_total: expanded.amount_total || 0,
      currency: expanded.currency || "usd",
      status,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function handleCheckoutFailure(session: Stripe.Checkout.Session) {
  await savePendingSession(session, "failed");
  const email = session.customer_details?.email || session.customer_email;
  await recordConversionSafely("payment_failed", { source: "stripe", page: "/checkout", referenceId: session.id });
  const templateId = getBrevoTemplateId("payment_failed");
  if (email && templateId) await sendTrackedEmail(email.toLowerCase(), "payment_failed", templateId).catch((error) => console.error("Payment failure email failed", error));
}

async function sendPurchaseMessages(email: string, kind: "founding" | "subscription") {
  await syncBrevoContact(email, null).catch((error) => console.error("Purchaser contact sync failed", error));
  const confirmationTemplate = getBrevoTemplateId("purchase_confirmation");
  if (confirmationTemplate) {
    await sendTrackedEmail(email, "purchase_confirmation", confirmationTemplate, { product: kind }).catch((error) => console.error("Purchase email failed", error));
  }
  if (kind === "founding") {
    const accessTemplate = getBrevoTemplateId("beta_access");
    if (accessTemplate) {
      await sendTrackedEmail(email, "beta_access", accessTemplate, { betaDate: "October 5, 2026", releaseDate: "November 5, 2026" }).catch((error) => console.error("Access email failed", error));
    }
  }
}

async function fulfillSession(input: Stripe.Checkout.Session) {
  const session = input.line_items ? input : await expandedSession(input.id);
  const email = session.customer_details?.email || session.customer_email;
  const priceId = session.line_items?.data[0]?.price?.id;
  if (!email || !priceId) throw new Error(`Checkout session ${session.id} is missing an email or price`);

  const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const kind = priceId === foundingPriceId ? "founding" : priceId === monthlyPriceId ? "subscription" : null;
  if (!kind) throw new Error(`Checkout session ${session.id} contains an unknown Stripe price`);

  const firstFulfillment = await callSupabaseRpc<boolean>("record_paid_order", {
    p_email: email.toLowerCase(),
    p_checkout_session_id: session.id,
    p_customer_id: id(session.customer),
    p_payment_intent_id: id(session.payment_intent),
    p_subscription_id: id(session.subscription),
    p_price_id: priceId,
    p_kind: kind,
    p_amount_total: session.amount_total || 0,
    p_currency: session.currency || "usd",
  });

  if (!firstFulfillment) return;
  await recordConversionSafely(kind === "founding" ? "founding_purchase_completed" : "subscription_started", { page: "/checkout", source: "stripe", referenceId: session.id });
  await sendPurchaseMessages(email.toLowerCase(), kind);
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = id(charge.payment_intent);
  if (!paymentIntentId) return;
  const orders = await supabaseRequest<StoredOrder[]>(`orders?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=id,purchaser_email,kind,status&limit=1`);
  const order = orders[0];
  if (!order || order.status === "refunded") return;

  await supabaseRequest(`orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "refunded", updated_at: new Date().toISOString() }),
  });
  await recordConversionSafely("refund_completed", { source: "stripe", referenceId: order.id });
  const templateId = getBrevoTemplateId("refund_confirmation");
  if (templateId) await sendTrackedEmail(order.purchaser_email, "refund_confirmation", templateId).catch((error) => console.error("Refund email failed", error));
}

async function handleInvoice(invoice: Stripe.Invoice, status: "paid" | "failed") {
  const subscriptionId = id((invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription);
  if (!subscriptionId) return;
  const orders = await supabaseRequest<StoredOrder[]>(`orders?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,purchaser_email,kind,status&limit=1`);
  const order = orders[0];
  if (!order) return;
  await supabaseRequest(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
  if (status === "failed") {
    await recordConversionSafely("payment_failed", { source: "stripe", referenceId: order.id });
    const templateId = getBrevoTemplateId("payment_failed");
    if (templateId) await sendTrackedEmail(order.purchaser_email, "payment_failed", templateId).catch((error) => console.error("Payment failure email failed", error));
  }
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") await fulfillSession(session);
      else await savePendingSession(session, "pending");
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await fulfillSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
      await handleCheckoutFailure(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await savePendingSession(event.data.object as Stripe.Checkout.Session, "canceled");
      break;
    case "charge.refunded":
      await handleRefund(event.data.object as Stripe.Charge);
      break;
    case "invoice.payment_failed":
      await handleInvoice(event.data.object as Stripe.Invoice, "failed");
      break;
    case "invoice.paid":
      await handleInvoice(event.data.object as Stripe.Invoice, "paid");
      break;
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseRequest(`orders?stripe_subscription_id=eq.${encodeURIComponent(subscription.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "canceled", updated_at: new Date().toISOString() }) });
      break;
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    if (!(await claimEvent(event))) return NextResponse.json({ received: true, duplicate: true });
    await processEvent(event);
    await markEvent(event.id, "processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown webhook error";
    await markEvent(event.id, "failed", message).catch(() => undefined);
    console.error("Stripe webhook failed", event.type, message);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
