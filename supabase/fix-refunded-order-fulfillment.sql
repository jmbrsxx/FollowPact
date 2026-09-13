-- Run once in the Supabase SQL editor for an existing FollowPact deployment.
-- Replayed checkout events must never restore a fully refunded order to paid.
create or replace function public.record_paid_order(p_email text, p_checkout_session_id text, p_customer_id text, p_payment_intent_id text, p_subscription_id text, p_price_id text, p_kind text, p_amount_total integer, p_currency text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare was_fulfilled boolean;
begin
  select fulfilled_at is not null into was_fulfilled from public.orders where stripe_checkout_session_id = p_checkout_session_id for update;
  if found then
    if was_fulfilled then return false; end if;
    update public.orders set purchaser_email = p_email, stripe_customer_id = p_customer_id,
      stripe_payment_intent_id = p_payment_intent_id, stripe_subscription_id = p_subscription_id,
      stripe_price_id = p_price_id, kind = p_kind, amount_total = p_amount_total,
      currency = lower(p_currency), status = 'paid', fulfilled_at = now(), updated_at = now()
    where stripe_checkout_session_id = p_checkout_session_id;
    return true;
  end if;
  insert into public.orders (purchaser_email, stripe_checkout_session_id, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id, stripe_price_id, kind, amount_total, currency, status, fulfilled_at)
  values (p_email, p_checkout_session_id, p_customer_id, p_payment_intent_id, p_subscription_id, p_price_id, p_kind, p_amount_total, lower(p_currency), 'paid', now());
  return true;
end;
$$;
