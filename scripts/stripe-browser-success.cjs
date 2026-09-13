/* eslint-disable @typescript-eslint/no-require-imports */
// Run only with: node --env-file=.env.local scripts/stripe-browser-success.cjs [visa|3ds-success|3ds-decline|pending-refund|failed-refund]
const { chromium } = require('playwright-core');

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
    !process.env.STRIPE_FOUNDING_PAYMENT_LINK?.includes('/test_')) {
  throw new Error('Refusing to run without a Stripe test key and test Payment Link');
}

const options = {
  visa: '4242424242424242',
  '3ds-success': '4000000000003220',
  '3ds-decline': '4000008400001629',
  'pending-refund': '4000000000007726',
  'failed-refund': '4000000000005126',
};
const scenario = process.argv[2] || 'visa';
if (!options[scenario]) throw new Error('Unknown Stripe test-card scenario');
const email = `followpact-${scenario}-${Date.now()}@example.com`;

async function main() {
  let browser;
  try {
    console.log(JSON.stringify({ scenario, auditEmail: email, step: 'launch' }));
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const page = await browser.newPage({ locale: 'en-US' });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto('https://followpact.netlify.app/checkout?source=presale-audit', { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!page.url().includes('/test_')) throw new Error('Checkout did not redirect to Stripe test mode');
      try {
        await page.locator('input[name="cardNumber"]').waitFor({ state: 'visible', timeout: 20000 });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="cardNumber"]').fill(options[scenario]);
    await page.locator('input[name="cardExpiry"]').fill('12/34');
    await page.locator('input[name="cardCvc"]').fill('123');
    await page.locator('input[name="billingName"]').fill('FollowPact Test');
    console.log(JSON.stringify({ scenario, step: 'submit-test-card' }));
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(6500);
    console.log(JSON.stringify({ scenario, step: 'inspect-result' }));
    if (scenario.startsWith('3ds')) {
      let challenge;
      for (let attempt = 0; attempt < 20; attempt++) {
        challenge = page.frames().find(frame => frame.url().includes('testmode-acs.stripe.com'));
        if (challenge) break;
        await page.waitForTimeout(500);
      }
      if (!challenge) throw new Error('Stripe test 3D Secure challenge was not displayed');
      await challenge.getByRole('button', { name: /COMPLETE/i }).click({ timeout: 20000 });
      await page.waitForTimeout(9000);
      console.log(JSON.stringify({ scenario, step: 'challenge-completed' }));
    }
    const body = await page.locator('body').innerText();
    console.log(JSON.stringify({ scenario, auditEmail: email, pageHost: new URL(page.url()).host, alerts: body.split('\n').filter(x => /declin|insufficient|authenticat|complete|success|thank|expired|error/i.test(x)).slice(-10) }));
  } finally {
    await browser?.close();
  }
}

main().catch(error => { console.error('Browser payment audit failed:', error.message.slice(0, 400)); process.exitCode = 1; });
