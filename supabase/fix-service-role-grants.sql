-- Run this in the Supabase SQL editor for an existing FollowPact project.
-- It repairs the permissions needed by the server's secret API key.
grant usage on schema public to service_role;
grant select, insert, update on public.waitlist, public.orders, public.stripe_events,
  public.email_events, public.conversion_events, public.api_rate_limits to service_role;
grant select on public.conversion_summary to service_role;
grant usage, select on all sequences in schema public to service_role;
