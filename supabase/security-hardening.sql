-- Apply to the existing Supabase project before enabling Stripe live mode.
-- All application tables and the analytics view are server-only.
alter table public.waitlist enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_events enable row level security;
alter table public.email_events enable row level security;
alter table public.conversion_events enable row level security;
alter table public.api_rate_limits enable row level security;

alter view public.conversion_summary set (security_invoker = true);
revoke all on public.waitlist, public.orders, public.stripe_events, public.email_events,
  public.conversion_events, public.api_rate_limits, public.conversion_summary
  from public, anon, authenticated;

alter function public.join_waitlist(text, text, text, text, text, boolean) set search_path = '';
alter function public.check_api_rate_limit(text, integer, integer) set search_path = '';
alter function public.claim_stripe_event(text, text) set search_path = '';
alter function public.record_paid_order(text, text, text, text, text, text, text, integer, text) set search_path = '';

revoke execute on function public.join_waitlist(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.check_api_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_stripe_event(text, text) from public, anon, authenticated;
revoke execute on function public.record_paid_order(text, text, text, text, text, text, text, integer, text) from public, anon, authenticated;
