/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const Stripe = require('stripe');

const signingSecret = 'whsec_followpact_local_test_only';
const priceId = 'price_followpact_test_founder';
const stripe = new Stripe('sk_test_followpact_local_test_only');
process.env.STRIPE_SECRET_KEY = 'sk_test_followpact_local_test_only';
process.env.STRIPE_WEBHOOK_SECRET = signingSecret;
process.env.STRIPE_FOUNDING_PRICE_ID = priceId;
delete process.env.STRIPE_MONTHLY_PRICE_ID;

function setup() {
  const state = { orders: new Map(), events: new Map(), emails: [], conversions: [], refunds: new Map(), sessions: new Map(), failMark: false };
  const supabaseRequest = async (resource, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (resource.startsWith('stripe_events?')) {
      const id = decodeURIComponent(resource.match(/event_id=eq\.([^&]+)/)[1]);
      if (state.failMark) throw new Error('simulated event status write failure');
      Object.assign(state.events.get(id), body);
      return;
    }
    if (resource.startsWith('orders?on_conflict=')) {
      state.orders.set(body.stripe_checkout_session_id, { ...state.orders.get(body.stripe_checkout_session_id), ...body });
      return;
    }
    if (resource.startsWith('orders?stripe_payment_intent_id=')) {
      const id = decodeURIComponent(resource.match(/stripe_payment_intent_id=eq\.([^&]+)/)[1]);
      return [...state.orders.values()].filter(order => order.stripe_payment_intent_id === id).slice(0, 1);
    }
    if (resource.startsWith('orders?stripe_checkout_session_id=')) {
      const id = decodeURIComponent(resource.match(/stripe_checkout_session_id=eq\.([^&]+)/)[1]);
      const order = state.orders.get(id);
      return order ? [order] : [];
    }
    if (resource.startsWith('orders?id=')) {
      const id = decodeURIComponent(resource.match(/orders\?id=eq\.([^&]+)/)[1]);
      const order = [...state.orders.values()].find(order => order.id === id);
      const status = resource.match(/status=eq\.([^&]+)/)?.[1];
      if (order && (!status || order.status === status)) { Object.assign(order, body); return [order]; }
      return [];
    }
    throw new Error(`Unexpected Supabase resource: ${resource}`);
  };
  const callSupabaseRpc = async (name, body) => {
    if (name === 'claim_stripe_event') {
      const prior = state.events.get(body.p_event_id);
      if (!prior) { state.events.set(body.p_event_id, { status: 'processing' }); return true; }
      if (prior.status === 'failed') { prior.status = 'processing'; return true; }
      return false;
    }
    if (name === 'record_paid_order') {
      const prior = state.orders.get(body.p_checkout_session_id);
      const first = !prior?.fulfilled_at;
      if (prior?.fulfilled_at) return false;
      state.orders.set(body.p_checkout_session_id, {
        ...prior,
        id: prior?.id || `order_${state.orders.size + 1}`,
        purchaser_email: body.p_email,
        stripe_checkout_session_id: body.p_checkout_session_id,
        stripe_payment_intent_id: body.p_payment_intent_id,
        status: 'paid',
        kind: body.p_kind,
        amount_total: body.p_amount_total,
        fulfilled_at: prior?.fulfilled_at || new Date().toISOString(),
      });
      return first;
    }
    throw new Error(`Unexpected RPC: ${name}`);
  };
  const helperSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'founding-payment.ts'), 'utf8');
  const helperCompiled = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const helperExports = {};
  vm.runInNewContext(helperCompiled, { exports: helperExports, require, process });
  const mocks = {
    'next/server': { NextResponse: { json: (body, init = {}) => Response.json(body, { status: init.status || 200 }) } },
    '@/lib/supabase': { supabaseRequest, callSupabaseRpc },
    '@/lib/stripe': { getStripe: () => ({ webhooks: stripe.webhooks,
      checkout: { sessions: { retrieve: async (id) => state.sessions.get(id) } },
      refunds: { list: async ({ payment_intent }) => ({ data: state.refunds.get(payment_intent) || [], has_more: false }) },
    }) },
    '@/lib/founding-payment': helperExports,
    '@/lib/brevo': {
      getBrevoTemplateId: () => 1,
      syncBrevoContact: async () => null,
      sendTrackedEmail: async (email, kind) => { state.emails.push({ email, kind }); },
    },
    '@/lib/analytics': { recordConversionSafely: async (name) => { state.conversions.push(name); } },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'stripe', 'webhook', 'route.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const context = { exports, require: name => mocks[name] || require(name), process, console, Request, Response, Date, JSON, URL };
  vm.runInNewContext(compiled, context, { filename: 'stripe-webhook-route.cjs' });
  return { state, post: async (type, object, eventId = `evt_${Math.random().toString(36).slice(2)}`) => {
    if (type.startsWith('checkout.session.')) state.sessions.set(object.id, object);
    const payload = JSON.stringify({ id: eventId, object: 'event', type, livemode: false, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret });
    const response = await exports.POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': signature }, body: payload }));
    return { status: response.status, body: await response.json() };
  }, postUnsigned: async () => {
    const response = await exports.POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: '{}' }));
    return response.status;
  } };
}

function session(id, paymentStatus = 'paid') {
  return {
    id, object: 'checkout.session', payment_status: paymentStatus,
    mode: 'payment', status: 'complete',
    customer_details: { email: `${id}@example.com` }, payment_intent: `pi_${id}`,
    line_items: { data: [{ price: { id: priceId }, quantity: 1 }] }, amount_total: 999, currency: 'usd',
  };
}

test('successful one-time payment creates one paid Founder and appropriate emails', async () => {
  const { state, post } = setup();
  assert.equal((await post('checkout.session.completed', session('success'))).status, 200);
  assert.equal(state.orders.size, 1);
  assert.equal(state.orders.get('success').status, 'paid');
  assert.deepEqual(state.emails.map(x => x.kind), ['purchase_confirmation', 'beta_access']);
  assert.deepEqual(state.conversions, ['founding_purchase_completed']);
});

test('duplicate delivery is acknowledged without duplicate order or fulfillment', async () => {
  const { state, post } = setup();
  const original = await post('checkout.session.completed', session('duplicate'), 'evt_duplicate');
  const duplicate = await post('checkout.session.completed', session('duplicate'), 'evt_duplicate');
  assert.equal(original.status, 200);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(state.orders.size, 1);
  assert.equal(state.emails.length, 2);
  assert.equal(state.conversions.length, 1);
});

test('pending checkout does not grant Founder access or send confirmation', async () => {
  const { state, post } = setup();
  assert.equal((await post('checkout.session.completed', session('pending', 'unpaid'))).status, 200);
  assert.equal(state.orders.get('pending').status, 'pending');
  assert.equal(state.emails.length, 0);
  assert.equal(state.conversions.length, 0);
  assert.equal((await post('checkout.session.async_payment_succeeded', session('pending'))).status, 200);
  assert.equal(state.orders.get('pending').status, 'paid');
  assert.equal(state.emails.length, 2);
});

test('failed asynchronous payment never creates a paid Founder', async () => {
  const { state, post } = setup();
  assert.equal((await post('checkout.session.async_payment_failed', session('failed', 'unpaid'))).status, 200);
  assert.equal(state.orders.get('failed').status, 'failed');
  assert.deepEqual(state.emails.map(x => x.kind), ['payment_failed']);
});

test('abandoned checkout expires without paid access or confirmation', async () => {
  const { state, post } = setup();
  assert.equal((await post('checkout.session.expired', session('abandoned', 'unpaid'))).status, 200);
  assert.equal(state.orders.get('abandoned').status, 'canceled');
  assert.equal(state.emails.length, 0);
});

test('full refund removes active paid Founder and sends refund email', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('full'));
  state.refunds.set('pi_full', [{ amount: 999, status: 'succeeded' }]);
  assert.equal((await post('charge.refunded', { object: 'charge', payment_intent: 'pi_full', amount: 999, amount_refunded: 999, refunded: true })).status, 200);
  assert.equal(state.orders.get('full').status, 'refunded');
  assert.equal(state.emails.filter(x => x.kind === 'refund_confirmation').length, 1);
});

test('partial refund keeps the Founder active and does not send full-refund email', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('partial'));
  state.refunds.set('pi_partial', [{ amount: 400, status: 'succeeded' }]);
  assert.equal((await post('charge.refunded', { object: 'charge', payment_intent: 'pi_partial', amount: 999, amount_refunded: 400, refunded: false })).status, 200);
  assert.equal(state.orders.get('partial').status, 'paid');
  assert.equal(state.emails.filter(x => x.kind === 'refund_confirmation').length, 0);
});

test('successive partial refunds revoke access only when their succeeded total reaches the full charge', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('split'));
  state.refunds.set('pi_split', [{ amount: 400, status: 'succeeded' }]);
  assert.equal((await post('refund.updated', { object: 'refund', payment_intent: 'pi_split', amount: 400, status: 'succeeded' })).status, 200);
  assert.equal(state.orders.get('split').status, 'paid');
  state.refunds.set('pi_split', [{ amount: 400, status: 'succeeded' }, { amount: 599, status: 'succeeded' }]);
  assert.equal((await post('refund.updated', { object: 'refund', payment_intent: 'pi_split', amount: 599, status: 'succeeded' })).status, 200);
  assert.equal(state.orders.get('split').status, 'refunded');
  assert.equal((await post('charge.refunded', { object: 'charge', payment_intent: 'pi_split' })).status, 200);
  assert.equal(state.emails.filter(x => x.kind === 'refund_confirmation').length, 1);
  assert.equal((await post('checkout.session.completed', session('split'))).status, 200);
  assert.equal(state.orders.get('split').status, 'refunded');
});

test('pending and failed refunds do not revoke paid Founder access', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('refund_pending'));
  assert.equal((await post('refund.created', { object: 'refund', payment_intent: 'pi_refund_pending', amount: 999, status: 'pending' })).status, 200);
  assert.equal((await post('refund.failed', { object: 'refund', payment_intent: 'pi_refund_pending', amount: 999, status: 'failed' })).status, 200);
  assert.equal(state.orders.get('refund_pending').status, 'paid');
  assert.equal(state.emails.filter(x => x.kind === 'refund_confirmation').length, 0);
});

test('refund.failed restores an incorrectly refunded paid Founder', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('failed_refund'));
  state.orders.get('failed_refund').status = 'refunded';
  state.refunds.set('pi_failed_refund', [{ amount: 999, status: 'failed' }]);
  assert.equal((await post('refund.failed', { object: 'refund', payment_intent: 'pi_failed_refund', amount: 999, status: 'failed' })).status, 200);
  assert.equal(state.orders.get('failed_refund').status, 'paid');
  assert.equal(state.emails.filter(x => x.kind === 'refund_confirmation').length, 0);
});

test('underpaid or unrelated Checkout Sessions cannot grant Founder access', async () => {
  for (const override of [
    { amount_total: 678 }, { status: 'open' }, { mode: 'subscription' },
    { line_items: { data: [{ price: { id: 'price_unrelated' }, quantity: 1 }] } },
    { line_items: { data: [{ price: { id: priceId }, quantity: 2 }] } },
  ]) {
    const { state, post } = setup();
    const result = await post('checkout.session.completed', { ...session('invalid'), ...override });
    assert.equal(result.status, 200);
    assert.equal(state.orders.size, 0);
    assert.equal(state.emails.length, 0);
  }
});

test('late expiration does not overwrite a paid Founder', async () => {
  const { state, post } = setup();
  await post('checkout.session.completed', session('late'));
  assert.equal((await post('checkout.session.expired', session('late', 'unpaid'))).status, 200);
  assert.equal(state.orders.get('late').status, 'paid');
});

test('invalid signature receives HTTP 400', async () => {
  const { postUnsigned } = setup();
  assert.equal(await postUnsigned(), 400);
});

test('processing failure receives HTTP 500, then retry does not duplicate fulfillment', async () => {
  const { state, post } = setup();
  state.failMark = true;
  assert.equal((await post('checkout.session.completed', session('retry'), 'evt_retry')).status, 500);
  state.failMark = false;
  assert.equal((await post('checkout.session.completed', session('retry'), 'evt_retry')).status, 200);
  assert.equal(state.orders.size, 1);
  assert.equal(state.emails.length, 2);
});
