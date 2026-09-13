/* eslint-disable @typescript-eslint/no-require-imports */
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Stripe test mode and Supabase server settings are required');
}

const email = process.argv[2];
if (!/^followpact-visa-\d+@example\.com$/.test(email || '')) throw new Error('Expected a generated test checkout address');
const base = process.env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

(async () => {
  const [ordersResponse, emailsResponse] = await Promise.all([
    fetch(`${base}/rest/v1/orders?purchaser_email=eq.${encodeURIComponent(email)}&select=stripe_checkout_session_id,status,kind,amount_total,currency,stripe_price_id`, { headers }),
    fetch(`${base}/rest/v1/email_events?recipient_email=eq.${encodeURIComponent(email)}&select=email_kind,status`, { headers }),
  ]);
  if (!ordersResponse.ok || !emailsResponse.ok) throw new Error('Supabase verification query failed');
  const [orders, emailEvents] = await Promise.all([ordersResponse.json(), emailsResponse.json()]);
  const session = orders.length === 1
    ? await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(orders[0].stripe_checkout_session_id)
    : null;
  console.log(JSON.stringify({ orderCount: orders.length, orderStatus: orders[0]?.status,
    orderKind: orders[0]?.kind, amount: orders[0]?.amount_total, currency: orders[0]?.currency,
    configuredPrice: orders[0]?.stripe_price_id === process.env.STRIPE_FOUNDING_PRICE_ID,
    stripeSessionStatus: session?.status, stripePaymentStatus: session?.payment_status,
    emailEvents }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
