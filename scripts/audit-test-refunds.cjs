/* eslint-disable @typescript-eslint/no-require-imports */
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.STRIPE_FOUNDING_PRICE_ID) {
  throw new Error('Stripe test mode and Supabase server settings are required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const base = process.env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

(async () => {
  const response = await fetch(`${base}/rest/v1/orders?stripe_price_id=eq.${encodeURIComponent(process.env.STRIPE_FOUNDING_PRICE_ID)}&select=id,stripe_payment_intent_id,amount_total,status&limit=100`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  const orders = await response.json();
  const result = [];
  for (const order of orders) {
    if (!order.stripe_payment_intent_id) continue;
    const refunds = await stripe.refunds.list({ payment_intent: order.stripe_payment_intent_id, limit: 100 });
    if (refunds.has_more) throw new Error('Refund pagination required');
    const succeeded = refunds.data.filter((refund) => refund.status === 'succeeded').reduce((sum, refund) => sum + refund.amount, 0);
    if (refunds.data.length || (order.status === 'refunded' && succeeded < order.amount_total)) {
      result.push({ orderId: order.id, orderStatus: order.status, amount: order.amount_total,
        succeededRefundAmount: succeeded, refundStatuses: refunds.data.map((refund) => refund.status),
        expectedOrderStatus: succeeded >= order.amount_total ? 'refunded' : 'paid' });
    }
  }
  console.log(JSON.stringify({ activePaidOrders: orders.filter((order) => order.status === 'paid').length,
    refundOrders: result }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
