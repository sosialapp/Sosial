-- p123 — Spend platform API calls where something can have changed.
--
-- The comment and DM sweep re-read every thread of every Facebook, Instagram,
-- X, Threads, YouTube, Bluesky and Mastodon account every 5 minutes, and the
-- analytics refresh re-read the 30 newest posts of each account every 15-30
-- minutes. That used up Instagram's per-account hourly calls, X's monthly
-- post reads and most of YouTube's daily quota. This migration:
--
--   * comment_posts.comment_count / comments_synced_at: what the last read of
--     a thread saw, so the worker only reads threads whose count moved
--     (apps/worker/src/cadence.ts).
--   * connected_channels.api_backoff_until: set by the worker when a platform
--     says a window is nearly full or answers 429; schedulers skip the channel
--     until then. comments_cursor: X mentions since_id, so the X sweep only
--     reads replies that are new.
--   * sync_interval_minutes(): per-provider sweep cadence. Facebook and
--     Instagram push comments and DMs by webhook, so with a working webhook
--     the poll is an hourly safety net. Channels are spread across the
--     interval instead of all firing on the same minute.
--   * Opening the inbox no longer re-sweeps a channel swept in the last two
--     minutes.
--   * Analytics: slower channel ticks; per-post reads are age-based in the
--     worker (every tick under 48 h, then daily, weekly, stop at 30 days).
--   * The daily 05:20 full snapshot (p19) is dropped: the 15-minute schedule
--     already covers it and its key never deduped against it.

alter table public.comment_posts add column if not exists comment_count integer;
alter table public.comment_posts add column if not exists comments_synced_at timestamptz;

alter table public.connected_channels add column if not exists api_backoff_until timestamptz;
alter table public.connected_channels add column if not exists comments_cursor text;

-- ------------------------------------------------------------ sync cadence ---
create or replace function public.sync_interval_minutes(p_provider text, p_kind text, p_webhook boolean)
returns integer
language sql
immutable
as $$
  select case
    when p_provider in ('facebook', 'instagram') then case when coalesce(p_webhook, false) then 60 else 5 end
    when p_provider = 'x' then 15
    when p_provider in ('threads', 'youtube') then 30
    else 5
  end
$$;

-- Stable 0..2^31 offset per channel, so channels spread across an interval.
create or replace function public.channel_slot(p_channel uuid)
returns bigint
language sql
immutable
as $$
  select (hashtext(p_channel::text)::bigint & 2147483647)
$$;

create or replace function public.enqueue_unified_sync()
returns void
language plpgsql
security definer
set search_path to public as $$
declare
  m bigint := floor(extract(epoch from now()) / 60);
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select k.kind,
         jsonb_build_object('channel_id', c.id),
         now(),
         k.kind || ':' || c.id::text || ':' || ((m + channel_slot(c.id) % i.iv) / i.iv)::text
  from public.connected_channels c
  cross join (values ('sync_inbox'), ('sync_comments')) as k(kind)
  cross join lateral (
    select sync_interval_minutes(
      c.provider::text,
      k.kind,
      coalesce((c.metadata->>'webhookReady')::boolean, false)
    ) as iv
  ) i
  where c.status = 'connected'
    and (c.api_backoff_until is null or c.api_backoff_until < now())
    and (
      (k.kind = 'sync_comments' and c.provider::text in ('facebook','instagram','mastodon','x','bluesky','threads','youtube'))
      or (k.kind = 'sync_inbox' and c.provider::text in ('facebook','instagram','mastodon','x','bluesky'))
    )
    and (m + channel_slot(c.id) % i.iv) % i.iv < 5
    and not exists (
      select 1 from public.job_queue j
      where j.kind = k.kind
        and j.payload->>'channel_id' = c.id::text
        and (
          j.status in ('queued','running')
          or (j.status = 'dead' and j.updated_at > now() - interval '1 hour')
        )
    )
  on conflict (idempotency_key) do nothing;
end;
$$;

-- Refresh buttons / opening the inbox: same as before, but a channel swept in
-- the last two minutes (by cron, webhook or another tab) is left alone.
create or replace function public.enqueue_unified_sync_on_demand(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path to public as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select k.kind,
         jsonb_build_object('channel_id', c.id, 'on_demand', true, 'workspace_id', p_workspace),
         now(),
         k.kind || ':od:' || c.id::text || ':' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  from public.connected_channels c
  cross join (values ('sync_inbox'), ('sync_comments')) as k(kind)
  where c.workspace_id = p_workspace
    and c.status = 'connected'
    and (c.api_backoff_until is null or c.api_backoff_until < now())
    and (
      (k.kind = 'sync_comments' and c.provider::text in ('facebook','instagram','mastodon','x','bluesky','threads','youtube'))
      or (k.kind = 'sync_inbox' and c.provider::text in ('facebook','instagram','mastodon','x','bluesky'))
    )
    and not exists (
      select 1 from public.job_queue j
      where j.kind = k.kind
        and j.payload->>'channel_id' = c.id::text
        and (
          j.status in ('queued','running')
          or (j.status = 'done' and j.updated_at > now() - interval '2 minutes')
          or (j.status = 'dead' and j.updated_at > now() - interval '1 hour')
        )
    )
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.enqueue_unified_sync(), public.enqueue_unified_sync_on_demand(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_unified_sync(), public.enqueue_unified_sync_on_demand(uuid)
  to service_role;

-- -------------------------------------------------------- analytics cadence ---
-- Minutes between channel ticks. A full tick reads the follower count, the
-- account's own post list (one call for up to 50 posts on most providers) and
-- only the Sosial posts that are due by age. Followers-only ticks are one
-- profile read.
create or replace function public.analytics_interval_minutes(p_provider text, p_full boolean)
returns integer
language sql
immutable
as $$
  select case
    when p_full then case p_provider
      when 'bluesky' then 15
      when 'mastodon' then 15
      when 'facebook' then 30
      when 'threads' then 30
      when 'instagram' then 60
      when 'tiktok' then 60
      when 'linkedin' then 60
      when 'youtube' then 60
      when 'x' then 180
      when 'pinterest' then 360
      else 60
    end
    else case p_provider
      when 'x' then 360
      when 'pinterest' then 360
      else 60
    end
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
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'snapshot:full:' || cc.id::text || ':' || (m / i.full_iv)::text
  from connected_channels cc
  cross join lateral (select analytics_interval_minutes(cc.provider::text, true) as full_iv) i
  where cc.status = 'connected'
    and (cc.api_backoff_until is null or cc.api_backoff_until < now())
    and m % i.full_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;

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
    and (cc.api_backoff_until is null or cc.api_backoff_until < now())
    and m % i.full_iv >= 15
    and m % i.f_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics k = row_count;
  return n + k;
end $$;

revoke all on function public.enqueue_analytics_refresh() from public, anon, authenticated;
grant execute on function public.enqueue_analytics_refresh() to service_role;

-- Analytics screens: followers at most every 15 minutes per channel (was every
-- minute, one profile read per open), the full snapshot in the provider's
-- current window as before.
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
         'snapshot:followers:od:' || cc.id::text || ':' || (m / 15)::text
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
    and (cc.api_backoff_until is null or cc.api_backoff_until < now())
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
    and (cc.api_backoff_until is null or cc.api_backoff_until < now())
  on conflict (idempotency_key) do nothing;

  return n;
end $$;

revoke all on function public.request_analytics_refresh(uuid) from public, anon;
grant execute on function public.request_analytics_refresh(uuid) to authenticated, service_role;

-- The p19 daily full snapshot duplicates the 15-minute schedule.
do $$
begin
  perform cron.unschedule('sosial-enqueue-snapshots');
exception
  when others then null;
end $$;
