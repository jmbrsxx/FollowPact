/* eslint-disable @typescript-eslint/no-require-imports */
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.STRIPE_FOUNDING_PAYMENT_LINK?.includes('/test_')) {
  throw new Error('Stripe test mode is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const prices = await stripe.prices.list({ limit: 100, expand: ['data.product'] });
  const links = await stripe.paymentLinks.list({ limit: 100 });
  const linkItems = await Promise.all(links.data.map((link) => stripe.paymentLinks.listLineItems(link.id, { limit: 10 })));
  const result = {
    configuredPrice: process.env.STRIPE_FOUNDING_PRICE_ID,
    prices: prices.data.filter((price) => [999, 678].includes(price.unit_amount)).map((price) => ({
      id: price.id, amount: price.unit_amount, currency: price.currency, active: price.active,
      product: typeof price.product === 'string' ? price.product : price.product?.name,
      productId: typeof price.product === 'string' ? price.product : price.product?.id,
    })),
    links: links.data.map((link, index) => ({
      id: link.id, urlMatchesConfigured: link.url === process.env.STRIPE_FOUNDING_PAYMENT_LINK,
      active: link.active, afterCompletion: link.after_completion,
      restrictions: link.restrictions, livemode: link.livemode,
      prices: linkItems[index].data.map((item) => ({ id: item.price?.id, amount: item.price?.unit_amount, quantity: item.quantity })),
    })),
  };
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
