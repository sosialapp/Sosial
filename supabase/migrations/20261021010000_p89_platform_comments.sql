-- p89_platform_comments: cache of platform comments per Sosial post target,
-- powering the web Community inbox + bell notifications for new comments.
--
-- Rows are written by the worker's comment-scan job (snapshot_analytics and
-- a dedicated scan_comments sweep) and by the mobile community reader's
-- backfill. reply_to_id carries the platform parent comment when the row is
-- a reply. (author, message) stay as the platform showed them; unread keeps
-- a per-workspace unread flag for the bell badge.

create table if not exists public.platform_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.connected_channels(id) on delete set null,
  provider text not null,
  post_target_id uuid references public.post_targets(id) on delete cascade,
  comment_id text not null,
  parent_id text,
  author text,
  author_avatar text,
  message text not null,
  like_count int,
  created_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  replied_at timestamptz,
  reply_text text,
  unique (provider, comment_id)
);

create index if not exists idx_platform_comments_ws
  on public.platform_comments (workspace_id, created_at desc);
create index if not exists idx_platform_comments_target
  on public.platform_comments (post_target_id);

alter table public.platform_comments enable row level security;

drop policy if exists "workspace members read comments" on public.platform_comments;
create policy "workspace members read comments"
  on public.platform_comments for select
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = public.platform_comments.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists "workspace members update replies" on public.platform_comments;
create policy "workspace members update replies"
  on public.platform_comments for update
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = public.platform_comments.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- RLS for the worker (service role bypasses RLS; nothing to grant here).
