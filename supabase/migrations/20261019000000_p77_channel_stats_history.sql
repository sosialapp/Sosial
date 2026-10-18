-- P77 · Follower history — daily snapshots of channel_stats.followers.
--
-- channel_stats is latest-only (PK = channel_id), so the web analytics
-- "performance over time" chart had no audience trend to draw — the followers
-- metric had to render as a flat line. The worker's daily snapshot job (p19,
-- 05:20 UTC) now also writes one row per channel per UTC day here; the
-- analytics page reads the range back and carries each day's total forward so
-- the line steps as the audience moves.

create table if not exists public.channel_stats_history (
  channel_id uuid not null references public.connected_channels (id) on delete cascade,
  captured_on date not null,
  workspace_id uuid not null,
  provider text not null,
  followers bigint,
  created_at timestamptz not null default now(),
  primary key (channel_id, captured_on)
);

create index if not exists channel_stats_history_workspace_idx
  on public.channel_stats_history (workspace_id, captured_on);

alter table public.channel_stats_history enable row level security;

-- Members read their own workspaces' history; the worker writes with the
-- service role, so no insert/update policy is needed.
drop policy if exists "channel_stats_history_member_read" on public.channel_stats_history;
create policy "channel_stats_history_member_read" on public.channel_stats_history
  for select to authenticated
  using (is_workspace_member(workspace_id));

grant select on public.channel_stats_history to authenticated;
grant all on public.channel_stats_history to service_role;
