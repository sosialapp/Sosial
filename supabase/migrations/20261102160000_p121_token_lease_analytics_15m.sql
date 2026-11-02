-- p121 — One owner per X session, analytics every 15 minutes.
--
-- X refresh tokens are single-use: refreshing returns a new one and the old
-- one dies at once. The worker (publish, stats and comment jobs running side
-- by side), the app's x-token call and the phone's Connect screen, which
-- re-uploaded its own copy of the tokens on every visit, all used the same
-- token. Whichever went second ended up with a dead session, so posting to X
-- worked some of the time.
--
--   * refresh_lock_until + claim/release_token_refresh(): a short lease so
--     only one refresh per channel runs at a time, across processes.
--   * refresh_fingerprint: hash of the refresh token the device last uploaded.
--     import-channel-token keeps the server's (newer) tokens when the device
--     sends the same token again, and only takes a token that changed (a new
--     sign-in or a refresh on the device).
--
-- Analytics: enqueue_analytics_refresh() runs every 15 minutes and queues a
-- full snapshot per channel when its provider is due, a followers-only read
-- otherwise. Intervals respect each provider's API limits:
--   15 min  facebook, threads, bluesky, mastodon, tiktok
--   30 min  instagram (200 calls per hour per account), linkedin
--   60 min  youtube (10,000 quota units a day), anything else
--   3 h     x (paid per post read), pinterest (Trial: 1,000 calls a day)
-- Follower counts refresh every 15 minutes everywhere (one call), hourly on
-- Pinterest. The pull-to-refresh request uses the same buckets, so opening
-- the screen never queues a second full read inside a window.

alter table channel_tokens add column if not exists refresh_fingerprint text;
alter table channel_tokens add column if not exists refresh_lock_until timestamptz;

create or replace function public.claim_token_refresh(p_channel_id uuid, p_seconds integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public as $$
begin
  update channel_tokens
     set refresh_lock_until = now() + make_interval(secs => greatest(5, least(coalesce(p_seconds, 30), 120)))
   where channel_id = p_channel_id
     and (refresh_lock_until is null or refresh_lock_until < now());
  return found;
end $$;

create or replace function public.release_token_refresh(p_channel_id uuid)
returns void
language sql
security definer
set search_path = public as $$
  update channel_tokens set refresh_lock_until = null where channel_id = p_channel_id;
$$;

revoke all on function public.claim_token_refresh(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_token_refresh(uuid) from public, anon, authenticated;
grant execute on function public.claim_token_refresh(uuid, integer) to service_role;
grant execute on function public.release_token_refresh(uuid) to service_role;

-- Minutes between refreshes: full snapshot (posts) or followers only.
create or replace function public.analytics_interval_minutes(p_provider text, p_full boolean)
returns integer
language sql
immutable
as $$
  select case
    when p_full then case p_provider
      when 'facebook' then 15
      when 'threads' then 15
      when 'bluesky' then 15
      when 'mastodon' then 15
      when 'tiktok' then 15
      when 'instagram' then 30
      when 'linkedin' then 30
      when 'x' then 180
      when 'pinterest' then 180
      else 60
    end
    else case p_provider when 'pinterest' then 60 else 15 end
  end
$$;

create or replace function public.enqueue_analytics_refresh()
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  m bigint := floor(extract(epoch from now()) / 60);
  n integer := 0;
  k integer := 0;
begin
  -- Full snapshot for channels whose window starts in this 15-minute slot.
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'snapshot:full:' || cc.id::text || ':' || (m / i.full_iv)::text
  from connected_channels cc
  cross join lateral (select analytics_interval_minutes(cc.provider::text, true) as full_iv) i
  where cc.status = 'connected'
    and m % i.full_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;

  -- Followers only for the rest (the full snapshot reads followers too).
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'followers_only', true),
         now(),
         'snapshot:followers:' || cc.id::text || ':' || (m / i.f_iv)::text
  from connected_channels cc
  cross join lateral (
    select analytics_interval_minutes(cc.provider::text, true) as full_iv,
           analytics_interval_minutes(cc.provider::text, false) as f_iv
  ) i
  where cc.status = 'connected'
    and m % i.full_iv >= 15
    and m % i.f_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics k = row_count;
  return n + k;
end $$;

revoke all on function public.enqueue_analytics_refresh() from public, anon, authenticated;
grant execute on function public.enqueue_analytics_refresh() to service_role;

-- Opening or pulling to refresh the analytics screen: followers now (deduped
-- per minute) and the full snapshot in the provider's current window, keyed
-- like the schedule so the two never both run inside one window.
create or replace function public.request_analytics_refresh(p_workspace uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  m bigint := floor(extract(epoch from now()) / 60);
  n integer := 0;
begin
  if p_workspace is null or not is_workspace_member(p_workspace) then
    raise exception 'not_a_member';
  end if;

  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'followers_only', true, 'on_demand', true),
         now(),
         'snapshot:followers:od:' || cc.id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;

  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'on_demand', true),
         now(),
         'snapshot:full:' || cc.id::text || ':' || (m / analytics_interval_minutes(cc.provider::text, true))::text
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
  on conflict (idempotency_key) do nothing;

  return n;
end $$;

revoke all on function public.request_analytics_refresh(uuid) from public, anon;
grant execute on function public.request_analytics_refresh(uuid) to authenticated, service_role;

-- The hourly followers sweep (p116) is folded into the 15-minute one.
do $$
begin
  perform cron.unschedule('sosial-enqueue-follower-snapshots');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule(
    'sosial-enqueue-analytics-refresh',
    '*/15 * * * *',
    'select public.enqueue_analytics_refresh()'
  );
exception
  when duplicate_object then null;
end $$;
