-- p96: community inbox polish.
--  1. comments.is_own — our own replies live in the same thread tables; the UI
--     renders them as "You" instead of a comment to answer.
--  2. community_reads — per-user "last opened" stamps so the Community badge
--     and the Comments/Messages pills can show counts that clear on open.

alter table public.comments add column if not exists is_own boolean not null default false;

create index if not exists comments_unseen_idx
  on public.comments (workspace_id, created_at desc)
  where status = 'new' and is_own = false;

create table if not exists public.community_reads (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  comments_seen_at timestamptz,
  messages_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.community_reads enable row level security;

drop policy if exists community_reads_own on public.community_reads;
create policy community_reads_own on public.community_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.community_unseen(p_workspace uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  with me as (select auth.uid() as uid),
  seen as (
    select comments_seen_at, messages_seen_at
    from public.community_reads
    where workspace_id = p_workspace and user_id = (select uid from me)
  ),
  c as (
    select count(*)::int as n
    from public.comments
    where workspace_id = p_workspace
      and status = 'new'
      and is_own = false
      and created_at > coalesce((select comments_seen_at from seen), 'epoch'::timestamptz)
  ),
  m as (
    select count(*)::int as n
    from public.messages msg
    join public.conversations cv on cv.id = msg.conversation_id
    where cv.workspace_id = p_workspace
      and msg.direction = 'in'
      and msg.sent_at > coalesce((select messages_seen_at from seen), 'epoch'::timestamptz)
  )
  select case
    when exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = p_workspace
        and wm.user_id = (select uid from me)
        and wm.status = 'active'
    ) then jsonb_build_object('comments', (select n from c), 'messages', (select n from m))
    else jsonb_build_object('comments', 0, 'messages', 0)
  end
$$;

create or replace function public.community_mark_seen(p_workspace uuid, p_section text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_section not in ('comments', 'messages') then
    raise exception 'bad_section';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not_a_member';
  end if;
  insert into public.community_reads (workspace_id, user_id)
  values (p_workspace, auth.uid())
  on conflict (workspace_id, user_id) do nothing;
  update public.community_reads
  set comments_seen_at = case when p_section = 'comments' then now() else comments_seen_at end,
      messages_seen_at = case when p_section = 'messages' then now() else messages_seen_at end,
      updated_at = now()
  where workspace_id = p_workspace and user_id = auth.uid();
end;
$$;

grant execute on function public.community_unseen(uuid) to authenticated;
grant execute on function public.community_mark_seen(uuid, text) to authenticated;
