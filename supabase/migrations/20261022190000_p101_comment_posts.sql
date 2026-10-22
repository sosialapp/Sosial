-- P101 — the post behind each comment thread.
--
-- The inbox shows the comment, but not what was commented on. Every platform
-- adapter can already read the post's caption, permalink and poster frame in
-- the same sweep that finds its comments (listOwnPosts), so the result is
-- cached here once and read by the web. Nothing calls a platform API to draw
-- the feed: no caption text, no media copy, just the CDN URL of the thumb.

create table public.comment_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.connected_channels(id) on delete cascade,
  platform text not null,
  -- comments.external_post_id, i.e. the platform's own id for the post.
  external_id text not null,
  url text,
  body text,
  thumbnail text,
  media_kind text,
  posted_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (channel_id, external_id)
);

create index comment_posts_ws on public.comment_posts (workspace_id);

alter table public.comment_posts enable row level security;

create policy comment_posts_member_read on public.comment_posts for select
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = comment_posts.workspace_id
      and m.user_id = auth.uid() and m.status = 'active'
  ));
