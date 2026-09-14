# FollowPact production deployment

This project is designed for a zero-monthly-fee launch on `followpact.netlify.app`. Stripe transaction fees still apply. External services must be created and connected before production checkout and email can work.

## 1. Supabase

1. Create a Supabase Free project.
2. Open its SQL editor and run `supabase/schema.sql` once. Re-running it is safe for the included tables and functions.
3. Copy the project URL (for example `https://PROJECT_REF.supabase.co`, without `/rest/v1`) and the secret service-role key into Netlify as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   For an existing project that returns `permission denied for table orders`, run `supabase/fix-service-role-grants.sql` in the Supabase SQL editor. The schema grants the server role SQL privileges as well as RLS bypass.
4. Generate a long random `RATE_LIMIT_SALT`. The waitlist hashes IP addresses with this secret for a fixed-window limit of five attempts per minute; raw IP addresses are never stored.

Row Level Security is enabled and no anonymous policies are created. Browser code must never receive the service-role key.

The `conversion_summary` view gives event totals. The protected `GET /api/admin/analytics` endpoint adds checkout conversion and UTM campaign groups. Call it with `Authorization: Bearer <ADMIN_API_TOKEN>`. Cloudflare visitor totals stay in Cloudflare, so visitor-to-waitlist conversion is calculated by comparing its visitor count with the endpoint’s waitlist count.

## 2. Stripe

Create this product and price in Stripe test mode first:

- Founding access: `$9.99 USD`, one time. Set its Payment Link purchase limit to 25 completed purchases. Keep the old $6.78 Price and Payment Link inactive.

If paid Founder orders already exist when enabling the restriction, reduce the link limit by that count. The test-mode `scripts/set-test-link-limit.cjs` script calculates this from Supabase and Stripe; it never accepts a live Stripe key.

For the founding Payment Link, require customer email, enable Stripe receipts, and use this post-payment redirect:

`https://followpact.netlify.app/payment/success?session_id={CHECKOUT_SESSION_ID}`

Set the link and Price ID as `STRIPE_FOUNDING_PAYMENT_LINK` and `STRIPE_FOUNDING_PRICE_ID`. Set the test secret key as `STRIPE_SECRET_KEY`. The site offers only this one-time checkout for now; when the founding offer ends or sells out, checkout directs visitors to the waitlist.

Create a webhook endpoint at:

`https://followpact.netlify.app/api/stripe/webhook`

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `refund.created`
- `refund.updated`
- `refund.failed`

Save its signing secret as `STRIPE_WEBHOOK_SECRET`. Stripe webhooks—not the success page—fulfill orders. Event IDs and Checkout Session IDs are unique in Supabase, so Stripe retries do not consume another seat or send fulfillment twice.

For an existing Supabase deployment, run `supabase/fix-refunded-order-fulfillment.sql` in the SQL editor before deploying this webhook change. It prevents a replayed checkout event from restoring a fully refunded order to paid. Refunds are reconciled from Stripe: partial, pending, and failed refunds keep Founder access; only successfully refunded amounts totaling the full order revoke it. The application does not issue refunds. When issuing a refund in Stripe, choose the full remaining amount. Stripe Dashboard can still issue a partial refund manually, so access reconciliation must remain in place.

Before launch, repeat the setup in live mode and replace the test key, Price ID, link, and webhook secret together. Run one low-value live purchase and refund. Founding purchases never convert to a subscription automatically.

### Live Stripe activation, step by step

1. Complete Stripe's account activation and confirm the Dashboard is in **Live mode**. Create or copy a **one-time $9.99 USD** Price; its live `price_...` ID is different from the test Price ID.
2. Create a **live Payment Link** with exactly one of that Price, fixed quantity one, no optional items, promotion codes, or automatic tax. Limit completed payments to the remaining founding seats (25 minus already paid, non-refunded live Founder orders). Set **After payment → Redirect** to `https://followpact.netlify.app/payment/success?session_id={CHECKOUT_SESSION_ID}`. Copy the live `https://buy.stripe.com/...` URL.
3. Create a **live webhook destination** for `https://followpact.netlify.app/api/stripe/webhook` and the eight checkout/refund events listed above. Copy this destination's own `whsec_...` signing secret; a test webhook secret will not work for live events.
4. In **Netlify → Site configuration → Environment variables**, set `STRIPE_SECRET_KEY` (`sk_live_...`), `STRIPE_FOUNDING_PRICE_ID`, `STRIPE_FOUNDING_PAYMENT_LINK`, and `STRIPE_WEBHOOK_SECRET` for the **Production** context. Deploy production so the server picks up all four together. Keep `.env.local` and deploy previews in test mode.
5. Before sharing the link, run `node --env-file=<private-live-env-file> scripts/check-stripe-readiness.cjs --live` from a private local environment containing those four values and `NEXT_PUBLIC_SITE_URL`. The command reads Stripe objects, prints no secret values, and checks the Price, Payment Link, redirect, purchase limit, and webhook event subscriptions. It cannot verify that `STRIPE_WEBHOOK_SECRET` is the matching signing secret; verify a delivered event in the Stripe Dashboard after the next step.
6. Open the deployed `/checkout` route and make **one real $9.99 purchase** with an inbox and payment method you control. Confirm Stripe shows a successful **live** payment, its webhook delivery returns HTTP 200, Supabase `orders` has one `paid` founding order for that Checkout Session, and the purchase email arrives. Refund it in the Stripe Dashboard and confirm the order becomes `refunded`. A test card cannot prove live payments work.

The app intentionally returns **Checkout unavailable** if the key, webhook secret, Price ID, and Payment Link are incomplete or if a test link is paired with a live key (or the reverse). A Payment Link can still be opened directly, so deactivate it in Stripe when the offer closes.

## 3. Brevo and Gmail replies

1. Create a Brevo Free account and a marketing list.
2. Create transactional templates for waitlist confirmation, purchase confirmation, failed payments, and refunds. For this founding presale, `BREVO_BETA_ACCESS_TEMPLATE_ID` may supply the purchase-confirmation template when `BREVO_PURCHASE_TEMPLATE_ID` is empty; the webhook sends one confirmation email after a verified payment. Send actual beta access details separately when the beta is ready.
3. Set the API key, list ID, and template IDs using the names in `.env.example`.
4. Set `BREVO_SENDER_EMAIL` to a sender Brevo accepts, `BREVO_SENDER_NAME=FollowPact`, and `BREVO_REPLY_TO_EMAIL=followpact@gmail.com`.
   The current Brevo account's active template 3 already confirms the founding purchase and works as the fallback confirmation. Active template 5 is the refund confirmation. Stripe test purchases made with `example.com` addresses can hard-bounce and become blocked in Brevo; use an inbox you control when checking actual delivery. `email_events.last_error` records Brevo's response code and message for rejected API requests.
5. Generate a random `BREVO_WEBHOOK_TOKEN`. Create transactional and marketing Brevo event webhooks pointing to `https://followpact.netlify.app/api/brevo/webhook`. Add a custom `Authorization` header with the value `Bearer <BREVO_WEBHOOK_TOKEN>` to both webhooks. Enable delivered, hard/soft bounce, blocked, spam/complaint, and unsubscribe events where available.

Without an owned domain, Gmail or `netlify.app` cannot be authenticated as a bulk-sending domain. Accept Brevo’s managed sender behavior and branding. Replies still go to Gmail. Brevo Free currently limits sending to 300 emails per day.

The server saves a waitlist signup before contacting Brevo. If Brevo fails, the signup remains stored with an error state. Retry up to 25 failed waitlist confirmations by sending `POST /api/admin/retry-emails` with `Authorization: Bearer <ADMIN_API_TOKEN>`.

Marketing campaigns should be sent only from the Brevo dashboard to the configured list. Transactional receipts, access, payment failure, and refund messages do not depend on marketing consent.

## 4. Cloudflare Web Analytics

The Cloudflare Web Analytics beacon and site token are included in `app/layout.tsx` for every page. Deploy the site, then confirm traffic appears for `followpact.netlify.app` in Cloudflare Web Analytics. DNS does not need to move to Cloudflare.

Use Cloudflare’s dashboard for page views, visitors, referrers, countries, browsers, devices, and real-user performance. Supabase stores only trusted server-side funnel conversions and sanitized UTM values. It does not store full IP addresses, browser fingerprints, or card data.

## 5. Netlify

1. Push the project to a free GitHub repository and import it into Netlify.
2. Keep the build command and Node version from `netlify.toml`; Netlify’s Next.js adapter handles App Router route handlers.
3. Add every value from `.env.example` under Site configuration → Environment variables. Use `https://followpact.netlify.app` for `NEXT_PUBLIC_SITE_URL`.
4. Generate long random values for `ADMIN_API_TOKEN`, `BREVO_WEBHOOK_TOKEN`, and `RATE_LIMIT_SALT`.
5. Deploy, then update Stripe and Brevo webhook URLs if Netlify assigned a different site name.

If the site shows “waitlist temporarily unavailable” and checkout redirects to “unavailable,” check `GET /api/offer-status` and the Netlify function logs. HTTP 503 there means the server cannot read Supabase; confirm the Netlify runtime values for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, run the grants repair above if needed, and redeploy. Test-mode Stripe links are only for test purchases. Before accepting real payments, set the live `STRIPE_FOUNDING_PAYMENT_LINK`, `STRIPE_FOUNDING_PRICE_ID`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in Netlify together. No monthly link is needed for this launch.

Enable Netlify’s included observability and function logs for short-term debugging. Cloudflare remains the primary traffic dashboard. Netlify Free uses a hard monthly credit limit and can pause the site rather than create an unexpected bill. Supabase Free can pause inactive projects and has no production uptime guarantee or automatic backups.

## 6. Verification checklist

Run locally before each production deployment:

```bash
npm run lint
npm run build
```

Test the waitlist with valid and invalid email addresses, missing consent, a filled honeypot, sixth request in one minute, duplicate signup, resubscription, disabled Supabase, disabled Brevo, retry, confirmation delivery, and an unsubscribe webhook.

Use Stripe CLI and test cards for successful, declined, delayed, and failed payments; an invalid signature; duplicate webhook delivery; full, partial, pending, and failed refunds; the 25th founding purchase; and closure after the deadline. Verify a 26th founding checkout cannot complete through Stripe’s purchase limit and that `/checkout` directs visitors to the waitlist after the offer closes.

The landing page intentionally displays the fixed phrase “25 spots left” while `/checkout` and the Stripe Payment Link still enforce their configured limits.

Verify the Cloudflare beacon contains the configured site token exactly once. Confirm UTM values are sanitized, checkout starts are recorded, purchase conversions appear only after a verified payment webhook, and secrets do not appear in browser bundles or API responses.

## Security gate before live payments

1. Run `supabase/security-hardening.sql` in the existing Supabase project's SQL editor. It keeps all FollowPact tables and the analytics view inaccessible to `anon` and `authenticated`, makes the view obey RLS, and pins the privileged RPC functions' search path. Then confirm the SQL editor reports no errors and `/api/offer-status` still returns HTTP 200.
2. In Brevo, verify both the transactional and marketing webhooks point to `https://followpact.netlify.app/api/brevo/webhook`. The marketing URL was corrected from `/api/stripe/webhook` during the security audit. Keep bearer-token authentication enabled for both; do not put the token in the URL.
3. In Netlify, scope live Stripe secrets, the Supabase service-role key, Brevo API key, and admin token to the **Production** deploy context and the narrowest available runtime scope. Deploy previews should use test credentials or no credentials. Mark secret values as secret in Netlify's environment settings.
4. In Stripe **live mode**, create one $9.99 USD one-time Price and one Payment Link. Limit completed payments to the remaining founding seats, account for prior live purchases, and deactivate any old or lower-priced links. Set the link's post-payment redirect to `https://followpact.netlify.app/payment/success?session_id={CHECKOUT_SESSION_ID}`. The direct Payment Link remains usable even after the website's `/checkout` route closes, so deactivate it when the founding offer ends.
5. Create a **live-mode** Stripe webhook at `https://followpact.netlify.app/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated`, and `refund.failed`. In Netlify Production, switch `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOUNDING_PRICE_ID`, and `STRIPE_FOUNDING_PAYMENT_LINK` to the corresponding live-mode values together. Do not change only one of them.
6. Before announcing live checkout, verify the deployed response headers, an unsigned webhook receives HTTP 400, invalid signatures receive HTTP 400, a normal waitlist request still works, and a Stripe test-mode payment/refund cycle still passes in an isolated test deploy. Watch Netlify function logs and Stripe webhook delivery status after activation.
