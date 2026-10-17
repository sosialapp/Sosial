-- P75 · App-wide announcements (owner broadcasts) + per-user read state.
--
-- The bell (`notifications`, P48) is workspace-scoped and per-recipient: its
-- rows are fanned out to the members who existed when an event fired, so a new
-- signup never sees them. An owner broadcast is the opposite shape: authored
-- once, app-wide, and it should still be visible to anyone who joins later.
-- So it gets its own pair of tables:
--
--   announcements
--     kind       -> 'update' | 'policy' | 'bug' | 'announcement'
--     platforms  -> who it targets, a non-empty subset of
--                   ('web','ios','android'); 'everyone' is stored as all three.
--                   The bell filters by the platform reading it; the worker
--                   narrows the Expo push fan-out the same way.
--     href       -> optional in-app destination the bell links to
--     created_by -> the app admin who sent it (kept for the audit trail)
--
--   announcement_reads (announcement_id, user_id, read_at)
--     per-user dismissal; a broadcast is unread for a user until a row exists.
--
-- Writes go through the service role only (the send-notification edge function
-- holds that key): announcements has no authenticated insert/update policy, so
-- the browser console cannot forge one. Everyone signed in can read.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement'
    check (kind in ('update', 'policy', 'bug', 'announcement')),
  title text not null,
  body text not null default '',
  href text,
  platforms text[] not null default array['web', 'ios', 'android']
    check (
      platforms <@ array['web', 'ios', 'android']
      and coalesce(array_length(platforms, 1), 0) >= 1
    ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_recent_idx
  on public.announcements (created_at desc);

alter table public.announcements enable row level security;

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select to authenticated using (true);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

drop policy if exists announcement_reads_owner on public.announcement_reads;
create policy announcement_reads_owner on public.announcement_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.announcements to authenticated;
grant select, insert, update, delete on public.announcement_reads to authenticated;
grant all on public.announcements, public.announcement_reads to service_role;
