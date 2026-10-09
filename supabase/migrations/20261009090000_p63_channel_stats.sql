-- P63 · Channel performance snapshots (followers + profile totals).
--
-- Mobile analytics reads followers straight from each provider API with
-- device tokens. On web those tokens never leave the Vault, so the worker's
-- existing daily snapshot job (p19, 05:20 UTC) captures them instead: one
-- row per connected channel in channel_stats, upserted on every run. The
-- analytics page joins this with post_stats aggregates for likes/comments/
-- shares/views and derives engagement rate exactly like mobile:
-- (likes + comments + shares) / followers × 100.

create table if not exists public.channel_stats (
  channel_id uuid primary key references public.connected_channels (id) on delete cascade,
  workspace_id uuid not null,
  provider text not null,
  followers bigint,
  note text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists channel_stats_workspace_idx
  on public.channel_stats (workspace_id);

alter table public.channel_stats enable row level security;

drop policy if exists "channel_stats_member_read" on public.channel_stats;
create policy "channel_stats_member_read" on public.channel_stats
  for select to authenticated
  using (is_workspace_member(workspace_id));

-- Daily snapshot enqueue already covers every connected channel (p19);
-- nothing new to schedule.
