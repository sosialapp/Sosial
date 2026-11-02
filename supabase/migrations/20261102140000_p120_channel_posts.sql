-- p120: analytics for posts made directly on the platform.
--
-- post_stats only covers what Sosial published (one row per post_target).
-- The worker now also lists each connected account's own recent posts with
-- their numbers, Sosial's or not, and keeps the latest snapshot here. A row
-- that matches a Sosial target carries post_target_id; analytics counts
-- those through post_stats and only adds rows where post_target_id is null,
-- so nothing is counted twice. Same audience-only numbers as post_stats.

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel_id uuid not null references public.connected_channels (id) on delete cascade,
  provider text not null,
  -- The platform's own id for the post.
  external_id text not null,
  -- Set when this is a post Sosial published (matched on remote_id).
  post_target_id uuid references public.post_targets (id) on delete set null,
  url text,
  body text,
  thumbnail text,
  media_kind text,
  posted_at timestamptz,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  clicks integer not null default 0,
  views bigint,
  note text,
  fetched_at timestamptz not null default now(),
  unique (channel_id, external_id)
);

create index if not exists channel_posts_ws_posted_idx
  on public.channel_posts (workspace_id, posted_at desc);

alter table public.channel_posts enable row level security;

drop policy if exists "channel_posts_member_read" on public.channel_posts;
create policy "channel_posts_member_read" on public.channel_posts
  for select to authenticated
  using (is_workspace_member(workspace_id));

-- Members read; the worker writes with the service role.
grant select on public.channel_posts to authenticated;
grant all on public.channel_posts to service_role;
