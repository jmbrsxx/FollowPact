/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --env-file=.env.local scripts/check-stripe-readiness.cjs --test
// For live credentials in a private environment, use --live. No values are printed.
const Stripe = require('stripe');

const mode = process.argv[2];
if (!['--test', '--live'].includes(mode)) {
  console.error('Usage: node --env-file=<private env file> scripts/check-stripe-readiness.cjs --test|--live');
  process.exit(2);
}

const live = mode === '--live';
const key = process.env.STRIPE_SECRET_KEY || '';
const linkUrl = process.env.STRIPE_FOUNDING_PAYMENT_LINK || '';
const priceId = process.env.STRIPE_FOUNDING_PRICE_ID || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

check(key.startsWith(live ? 'sk_live_' : 'sk_test_'), `Expected a ${live ? 'live' : 'test'} Stripe secret key.`);
check(priceId.startsWith('price_'), 'Missing Stripe Price ID.');
check(webhookSecret.startsWith('whsec_'), 'Missing Stripe webhook signing secret.');
check(/^https:\/\/[^/]+$/.test(siteUrl), 'Set NEXT_PUBLIC_SITE_URL to the deployed HTTPS origin.');

let parsedLink;
try { parsedLink = new URL(linkUrl); } catch { problems.push('Missing or invalid Stripe Payment Link.'); }
if (parsedLink) {
  check(parsedLink.protocol === 'https:' && parsedLink.hostname === 'buy.stripe.com', 'Payment Link must use buy.stripe.com.');
  check(/^\/(?:test_)?[A-Za-z0-9]+$/.test(parsedLink.pathname), 'Payment Link path is unexpected.');
  check(parsedLink.pathname.startsWith('/test_') !== live, 'Payment Link does not match the selected Stripe mode.');
}

async function main() {
  if (problems.length) throw new Error(problems.join('\n'));
  const stripe = new Stripe(key, { maxNetworkRetries: 0 });
  const price = await stripe.prices.retrieve(priceId);
  check(price.livemode === live && price.active, 'Price must be active in the selected mode.');
  check(price.unit_amount === 999 && price.currency === 'usd' && price.type === 'one_time', 'Price must be a one-time $9.99 USD price.');

  const links = await stripe.paymentLinks.list({ limit: 100 });
  let link = links.data.find((item) => item.url === linkUrl);
  let page = links;
  while (!link && page.has_more) {
    page = await stripe.paymentLinks.list({ limit: 100, starting_after: page.data.at(-1).id });
    link = page.data.find((item) => item.url === linkUrl);
  }
  check(!!link, 'Payment Link was not found in this Stripe account and mode.');
  if (link) {
    check(link.active && link.livemode === live, 'Payment Link must be active in the selected mode.');
    check(!link.allow_promotion_codes && !link.automatic_tax?.enabled, 'Disable promotion codes and automatic tax; fulfillment accepts exactly $9.99.');
    check(!link.optional_items?.length, 'Remove optional Payment Link items.');
    check(link.restrictions?.completed_sessions?.limit > 0 && link.restrictions.completed_sessions.limit <= 25,
      'Set a Payment Link completed-payment limit of at most 25.');
    check(link.after_completion?.type === 'redirect' &&
      link.after_completion.redirect?.url === `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      'Set the after-payment redirect to the deployed success URL with {CHECKOUT_SESSION_ID}.');
    const items = await stripe.paymentLinks.listLineItems(link.id, { limit: 2 });
    check(items.data.length === 1 && !items.has_more && items.data[0]?.price?.id === priceId &&
      items.data[0]?.quantity === 1 && !items.data[0]?.adjustable_quantity?.enabled,
      'Payment Link must contain exactly one fixed-quantity item at the configured Price ID.');
  }

  const requiredEvents = [
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'checkout.session.expired',
    'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
  ];
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const endpoint = endpoints.data.find((item) => item.url === `${siteUrl}/api/stripe/webhook` &&
    item.status === 'enabled' && item.livemode === live &&
    requiredEvents.every((event) => item.enabled_events.includes('*') || item.enabled_events.includes(event)));
  check(!!endpoint, 'Create an enabled webhook endpoint at the deployed URL with all required checkout and refund events.');

  if (problems.length) throw new Error(problems.join('\n'));
  console.log(`${live ? 'Live' : 'Test'} Stripe objects are configured consistently. Verify webhook delivery and a checkout in the Stripe Dashboard; the signing secret cannot be checked through this API.`);
}

main().catch((error) => {
  console.error('Stripe readiness check failed:', error.message);
  process.exitCode = 1;
});
