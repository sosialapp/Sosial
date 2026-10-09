-- p55 · Media retention janitor: bounded media retention by plan.
--
-- Post rows + their text are kept forever; only the BYTES (storage objects)
-- and their media_assets rows expire. Each plan gets a retention window
-- (media_retention_days): Free 30d · Solo 90d · Team 180d · Business 365d ·
-- Ultimate never (null). Mirrors apps/web/src/lib/billing/plans.ts +
-- src/utils/plans.ts — CHANGE ALL TOGETHER.
--
-- A daily cron enqueues one cleanup_media job per expired asset (idempotent by
-- asset id); the worker deletes the storage object, then the row (post_media
-- links cascade, the post survives). Media that is pinned, not yet 'ready', or
-- still attached to a post that has not reached a terminal state is never
-- swept. The pre-existing purge_expired_media() keeps handling failed/abandoned
-- rows that never became 'ready'.

alter table public.plan_limits
  add column if not exists media_retention_days integer;

update public.plan_limits set media_retention_days = case plan
  when 'free' then 30
  when 'solo' then 90
  when 'team' then 180
  when 'business' then 365
  when 'ultimate' then null
  else 30
end;

alter table public.media_assets
  add column if not exists pinned boolean not null default false;

create index if not exists media_assets_retention_idx
  on public.media_assets (created_at)
  where status = 'ready' and pinned = false;

-- Retention window (days) for a workspace's plan; null = never expires.
create or replace function public.workspace_media_retention_days(p_workspace_id uuid)
returns integer
language sql security definer stable set search_path = public as $$
  select media_retention_days
    from public.plan_limits
   where plan = public.workspace_plan(p_workspace_id);
$$;

-- Enqueue one cleanup_media job per media asset past its workspace's retention
-- window. Skips pinned assets and assets still attached to a post that has not
-- reached a terminal state, so in-flight work never loses its media.
create or replace function public.enqueue_expired_media_cleanup()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select 'cleanup_media',
         jsonb_build_object('media_id', ma.id),
         now(),
         'cleanup_media:' || ma.id::text
  from public.media_assets ma
  where ma.status = 'ready'
    and ma.pinned = false
    and public.workspace_media_retention_days(ma.workspace_id) is not null
    and ma.created_at < now() - make_interval(days => public.workspace_media_retention_days(ma.workspace_id))
    and not exists (
      select 1
        from public.post_media pm
        join public.posts p on p.id = pm.post_id
       where pm.media_id = ma.id
         and p.status in ('draft', 'approval', 'queued', 'publishing')
    )
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
begin
  perform cron.schedule('sosial-enqueue-media-cleanup', '40 4 * * *', 'select public.enqueue_expired_media_cleanup()');
exception
  when duplicate_object then null;
end $$;

revoke all on function public.workspace_media_retention_days(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_expired_media_cleanup() from public, anon, authenticated;
grant execute on function public.workspace_media_retention_days(uuid) to service_role;
grant execute on function public.enqueue_expired_media_cleanup() to service_role;
