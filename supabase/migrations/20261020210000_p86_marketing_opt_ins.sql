-- p86 -- Marketing opt-in done with profiles (toggle + Resend Audience sync)
--
-- `profiles.notif_marketing` (default false) is the single source of truth.
-- Signup-time consent flows continue to write user_metadata.marketing_opt_in
-- (web /auth/callback handles the first push); this column + the nightly
-- marketing-sync edge reconcile everything: the Settings toggle on both
-- platforms, opt-outs and whichever push failed its first attempt.
--
-- The audience itself lives in Resend; the edge pushes all opted-in emails
-- up and unsubscribes/deletes contacts no longer opted in. Opt-in is manual
-- and default OFF (GDPR / CAN-SPAM): no seeding of existing users, the
-- audience stays empty until someone actually ticks the box.

alter table public.profiles add column if not exists notif_marketing boolean not null default false;

-- The edge (service role via PostgREST) cannot read auth.users directly, so
-- expose just the emails it needs.
create or replace function public.marketing_optin_emails ()
  returns table (user_id uuid, email text)
  language sql
  stable
  security definer
  set search_path = public
  as $$
  select u.id, u.email
  from auth.users u
  where (exists (
    select 1
    from profiles p
    where p.id = u.id
      and p.notif_marketing = true
  ));
$$;

revoke all on function public.marketing_optin_emails () from public, anon, authenticated;

-- Nightly 04:00 UTC reconciliation, the dormancy-sweep pattern: pg_cron
-- POSTs the edge with a shared token (the token lives only in
-- private.integration_keys and the MARKETING_SYNC_TOKEN env, never here).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sosial-marketing-sync') then
    perform cron.schedule (
      'sosial-marketing-sync',
      '0 4 * * *',
      $job$
        select net.http_post (
          url := (select value from private.integration_keys where name = 'edge_base_url') || '/functions/v1/marketing-sync',
          headers := jsonb_build_object (
            'Authorization', 'Bearer ' || (select value from private.integration_keys where name = 'marketing_sync_token'),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end $$;
