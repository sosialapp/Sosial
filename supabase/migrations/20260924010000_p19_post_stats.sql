-- P19 · Post stats snapshots: the worker pulls live engagement per sent
-- post_target into post_stats (one row per target = latest numbers), so the
-- analytics dashboards read local rows instead of hammering platform APIs.
--
-- Enqueue policy mirrors P18: one snapshot_analytics job per connected
-- channel per day (idempotency 'snapshot:<channel_id>:<YYYYMMDD>'), cron at
-- 05:20 UTC. TikTok has no post-read API — the worker skips it as a no-op.

create table if not exists public.post_stats (
  post_target_id uuid primary key references public.post_targets(id) on delete cascade,
  workspace_id uuid not null,
  post_id uuid not null,
  channel_id uuid not null,
  provider text not null,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  views bigint,
  note text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists post_stats_workspace_idx on public.post_stats (workspace_id, post_id);

alter table public.post_stats enable row level security;

create policy "stats_member_read" on public.post_stats
  for select to authenticated
  using (is_workspace_member(workspace_id));

create or replace function enqueue_daily_snapshots()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'snapshot:' || cc.id::text || ':' || to_char(date_trunc('day', now()), 'YYYYMMDD')
  from connected_channels cc
  where cc.status = 'connected'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
begin
  perform cron.schedule('sosial-enqueue-snapshots', '20 5 * * *', 'select public.enqueue_daily_snapshots()');
exception
  when duplicate_object then null;
end $$;
