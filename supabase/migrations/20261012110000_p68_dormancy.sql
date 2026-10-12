-- p68 · Dormancy sweep plumbing
--
-- dormancy_candidates(idle_before, limit): auth users with no sign-in and no
-- post activity since `idle_before`, with their dormancy_warned_at stamp.
-- The activity proxy is GREATEST(last_sign_in_at, latest post ever created in
-- any workspace they own or belong to) — a mobile user can stay signed in for
-- months without re-authenticating, so posts count as life.
--
-- The sweep itself lives in the dormancy-sweep edge function; pg_cron POSTs
-- it daily at 03:10 UTC with the service-role key.

create or replace function public.dormancy_candidates(
  p_idle_before timestamptz,
  p_limit int default 20
)
returns table (id uuid, email text, last_sign_in_at timestamptz, warned_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    u.last_sign_in_at,
    (u.raw_user_meta_data ->> 'dormancy_warned_at')::timestamptz as warned_at
  from auth.users u
  where coalesce(
          greatest(
            u.last_sign_in_at,
            (select max(p.created_at) from posts p
               join workspace_members wm on wm.workspace_id = p.workspace_id
              where wm.user_id = u.id)
          ),
          u.created_at
        ) < p_idle_before
    -- members of workspaces with a live subscription are never dormancy targets
    and not exists (
      select 1
      from workspace_members wm2
      join subscriptions s on s.workspace_id = wm2.workspace_id
      where wm2.user_id = u.id
        and s.status in ('active', 'trialing')
        and s.stripe_subscription_id is not null
    )
  order by u.created_at asc
  limit p_limit;
$$;

revoke all on function public.dormancy_candidates(timestamptz, int) from public, anon, authenticated;

-- Keys the cron job needs, populated by hand over psql/db query (never committed).
create schema if not exists private;
create table if not exists private.integration_keys (
  name text primary key,
  value text not null
);
revoke all on private.integration_keys from anon, authenticated;

-- Daily 03:10 UTC sweep via pg_net.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sosial-dormancy-sweep') then
    perform cron.schedule(
      'sosial-dormancy-sweep',
      '10 3 * * *',
      $job$
        select net.http_post(
          url := (select value from private.integration_keys where name = 'edge_base_url') || '/functions/v1/dormancy-sweep',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (select value from private.integration_keys where name = 'service_role_key'),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end $$;
