/* eslint-disable @typescript-eslint/no-require-imports */
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.STRIPE_FOUNDING_PAYMENT_LINK?.includes('/test_') ||
    !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Stripe test mode and Supabase server settings are required');
}

(async () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const response = await fetch(`${base}/rest/v1/orders?kind=eq.founding&status=eq.paid&select=id&limit=25`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  const activePaid = (await response.json()).length;
  const links = await stripe.paymentLinks.list({ limit: 100 });
  const link = links.data.find((item) => item.url === process.env.STRIPE_FOUNDING_PAYMENT_LINK);
  if (!link || link.livemode || !link.active || link.restrictions?.completed_sessions?.count == null) {
    throw new Error('Expected active test Payment Link with a completed-session restriction');
  }
  const completed = link.restrictions.completed_sessions.count;
  const limit = completed + 25 - activePaid;
  if (limit < completed || limit > 25) throw new Error('Calculated test link limit is outside safe bounds');
  const updated = await stripe.paymentLinks.update(link.id, { restrictions: { completed_sessions: { limit } } });
  console.log(JSON.stringify({ activePaid, completed, limit: updated.restrictions.completed_sessions.limit }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
