-- p92 — Unified Inbox & Unified Comments (Phase 1 data model)
--
-- Replaces the ad-hoc platform_comments pipeline (scan_comments cron,
-- replay-centric batches, comment_bell spam on every merge) with a
-- normalized inbox/comments model the sync workers fill idempotently:
--   conversations/messages: DM threads (Phase 1: facebook, instagram,
--     bluesky, mastodon, x)
--   comments: public comments + replies, status-tracked, bell fires on
--     genuinely NEW rows only (see clamp below)
-- Old pipeline is decommissioned inside this migration: cron removed,
-- enqueue functions dropped. platform_comments keeps existing rows (they
-- migrate into comments) but nothing writes to it anymore.

-- ---------------------------------------------------------------- tables ---
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.connected_channels(id) on delete cascade,
  platform text not null,
  external_id text not null,
  participant_name text,
  participant_avatar text,
  last_message_at timestamptz,
  unread_count int not null default 0,
  cursor text,
  synced_at timestamptz not null default now(),
  unique (platform, external_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_id text,
  direction text not null check (direction in ('in','out')),
  body text not null default '',
  attachments jsonb not null default '[]',
  sent_at timestamptz not null,
  status text not null default 'sent' check (status in ('pending','sent','failed')),
  synced_at timestamptz not null default now()
);

create unique index messages_external_key
  on public.messages (conversation_id, external_id)
  where external_id is not null;
create index messages_convo on public.messages (conversation_id, sent_at);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.connected_channels(id) on delete cascade,
  platform text not null,
  external_post_id text,
  external_id text not null,
  parent_external_id text,
  author_name text,
  author_avatar text,
  body text not null default '',
  created_at timestamptz not null,
  status text not null default 'new' check (status in ('new','replied','hidden','deleted')),
  synced_at timestamptz not null default now(),
  unique (platform, external_id)
);

create index conversations_ws on public.conversations (workspace_id, last_message_at desc nulls last);
create index comments_ws on public.comments (workspace_id, created_at desc);

-- ------------------------------------------------------------------- rls ---
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;

create policy conversations_member_read on public.conversations for select
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = conversations.workspace_id
      and m.user_id = auth.uid() and m.status = 'active'
  ));
create policy messages_member_read on public.messages for select
  using (exists (
    select 1 from public.workspace_members m
    join public.conversations c on c.id = messages.conversation_id
    where c.workspace_id = m.workspace_id and m.user_id = auth.uid() and m.status = 'active'
  ));
create policy comments_member_read on public.comments for select
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = comments.workspace_id
      and m.user_id = auth.uid() and m.status = 'active'
  ));

-- ----------------------------------------------------- migrate old rows ---
-- Map: comment_id -> external_id, parent_id -> parent_external_id,
-- author -> author_name, message -> body, replied moment -> status.
-- Guarded: installs without the legacy pipeline skip this block.
do $$
begin
  if to_regclass('public.platform_comments') is not null then
    insert into public.comments
      (workspace_id, channel_id, platform, external_post_id, external_id,
       parent_external_id, author_name, author_avatar, body, created_at, status)
    select c.workspace_id, c.channel_id, c.provider, t.remote_id, c.comment_id,
           c.parent_id, c.author, c.author_avatar, c.message, c.created_at,
           case when c.replied_at is not null then 'replied' else 'new' end::text
    from public.platform_comments c
    left join public.post_targets t on t.id = c.post_target_id
    on conflict (platform, external_id) do nothing;

    select cron.unschedule('sosial-enqueue-comment-scan');
    drop function if exists public.enqueue_comment_scan();
    drop function if exists public.enqueue_comment_scan_on_demand(uuid);
  end if;
end
$$;
