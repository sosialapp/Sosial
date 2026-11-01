-- p116 — Analytics that keep up with the real accounts.
--
-- Follower counts were only captured by the daily 05:20 UTC sweep (p19/p63)
-- and once at connect time, so web and mobile both showed yesterday's
-- numbers and pull-to-refresh just re-read the same row. Two additions:
--
--   * request_analytics_refresh(workspace) — called by the analytics screens
--     on open and on refresh. Queues a followers-only snapshot per connected
--     channel (one profile read each, deduped per channel per minute) plus
--     the full engagement snapshot (up to ~30 post reads per channel, deduped
--     per channel per hour so a refresh button can't burn provider limits).
--   * hourly followers-only sweep, so counts stay current with nobody
--     looking. The daily full snapshot is unchanged.
--
-- The worker reads payload.followers_only to skip the per-post reads.

create or replace function public.request_analytics_refresh(p_workspace uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
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
         'snapshot:full:od:' || cc.id::text || ':' || to_char(now(), 'YYYYMMDDHH24')
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
  on conflict (idempotency_key) do nothing;

  return n;
end $$;

create or replace function public.enqueue_hourly_follower_snapshots()
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  n integer := 0;
begin
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'followers_only', true),
         now(),
         'snapshot:followers:' || cc.id::text || ':' || to_char(now(), 'YYYYMMDDHH24')
  from connected_channels cc
  where cc.status = 'connected'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.request_analytics_refresh(uuid) from public, anon;
grant execute on function public.request_analytics_refresh(uuid) to authenticated, service_role;

revoke all on function public.enqueue_hourly_follower_snapshots() from public, anon, authenticated;
grant execute on function public.enqueue_hourly_follower_snapshots() to service_role;

do $$
begin
  perform cron.schedule(
    'sosial-enqueue-follower-snapshots',
    '7 * * * *',
    'select public.enqueue_hourly_follower_snapshots()'
  );
exception
  when duplicate_object then null;
end $$;
