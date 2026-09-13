/* eslint-disable @typescript-eslint/no-require-imports */
// Run only with: node --env-file=.env.local scripts/stripe-browser-audit.cjs
// Uses Stripe's published test cards and an example.com address. Never uses live credentials.
const { chromium } = require('playwright-core');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.STRIPE_FOUNDING_PAYMENT_LINK?.includes('/test_')) {
  throw new Error('Refusing to run without a Stripe test key and test Payment Link');
}

const allCards = [
  ['generic_decline', '4000000000000002'],
  ['insufficient_funds', '4000000000009995'],
  ['expired_card', '4000000000000069'],
  ['incorrect_cvc', '4000000000000127'],
  ['processing_error', '4000000000000119'],
];
const cards = process.argv[2] ? allCards.filter(([name]) => process.argv[2].split(',').includes(name)) : allCards;
if (!cards.length) throw new Error('No matching Stripe test-card scenario');
const email = `followpact-audit-${Date.now()}@example.com`;

async function openCheckout(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('https://followpact.netlify.app/checkout?source=presale-audit', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!page.url().includes('/test_')) throw new Error('Checkout did not redirect to a Stripe test link');
    try {
      await page.locator('input[name="cardNumber"]').waitFor({ state: 'visible', timeout: 20000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const page = await browser.newPage({ locale: 'en-US' });
    await openCheckout(page);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="billingName"]').fill('FollowPact Test');

    for (const [scenario, number] of cards) {
      await page.locator('input[name="cardNumber"]').fill(number);
      await page.locator('input[name="cardExpiry"]').fill('12/34');
      await page.locator('input[name="cardCvc"]').fill('123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(8000);
      const lines = (await page.locator('body').innerText()).split('\n').map(x => x.trim()).filter(Boolean);
      const messages = lines.filter(x => /declin|insufficient|expir|cvc|secur|processing|error|incorrect|invalid|try again|try another/i.test(x)).slice(-8);
      console.log(JSON.stringify({ scenario, checkoutHost: new URL(page.url()).host, messages, tail: lines.slice(-12) }));
    }
    console.log(JSON.stringify({ auditEmail: email, note: 'No successful payment submitted by this script' }));
  } finally {
    await browser?.close();
  }
}

main().catch(error => { console.error('Browser audit failed:', error.message.slice(0, 400)); process.exitCode = 1; });
