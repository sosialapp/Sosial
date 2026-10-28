-- p110: inbox states for comments.
--
-- The comment feed could only say new / replied / hidden / deleted, which
-- leaves a gap: an inbox item you have dealt with *without* replying (a
-- question already answered further down, a compliment, a spam ping) had to
-- stay "new" forever and kept the badge alive. Repliz-style inboxes call this
-- resolved / ignored, so this migration adds both.
--
--   new      waiting for someone on our side
--   replied  we answered it (platform reply or a reply sent from Sosial)
--   resolved handled, no public reply needed
--   ignored  no action wanted (spam, bots, off-topic)
--   hidden   moderated on the platform
--   deleted  gone from the platform
--
-- Auto-handling lives here too: a reply stored from *any* path (the reply
-- composer, the worker, or the sweep seeing a reply posted from the phone
-- app) marks the comment it answers as replied, so the badge tells the truth
-- without the user filing it by hand.

-- ---------------------------------------------------------------- statuses ---
alter table public.comments drop constraint if exists comments_status_check;
alter table public.comments add constraint comments_status_check
  check (status in ('new', 'replied', 'resolved', 'ignored', 'hidden', 'deleted'));

-- ----------------------------------------------------------- auto-handling ---
create or replace function public.comments_auto_handle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Our reply just landed: the comment it answers is handled.
  if new.is_own and new.parent_external_id is not null then
    update public.comments
       set status = 'replied'
     where workspace_id = new.workspace_id
       and platform = new.platform
       and external_id = new.parent_external_id
       and is_own = false
       and status in ('new', 'resolved', 'ignored');
  end if;

  -- A comment arrives whose answer is already stored: one sync page can be
  -- written parent-last, so check the reply side as well.
  if not new.is_own and new.status = 'new' and exists (
    select 1 from public.comments r
     where r.workspace_id = new.workspace_id
       and r.platform = new.platform
       and r.parent_external_id = new.external_id
       and r.is_own
  ) then
    new.status := 'replied';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_auto_handle on public.comments;
create trigger comments_auto_handle
  before insert on public.comments
  for each row execute function public.comments_auto_handle();

-- --------------------------------------------------------------- write path ---
-- Comments have a read-only RLS policy on purpose: the body, author and
-- timestamps come from the platform and must never be edited by a client. The
-- one write a member needs is the inbox state, so it gets a narrow RPC instead
-- of an update policy (an update policy could rewrite any column).
create or replace function public.comment_set_status(p_comments uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  if p_status not in ('new', 'resolved', 'ignored') then
    raise exception 'bad_status';
  end if;

  update public.comments c
     set status = p_status
   where c.id = any(p_comments)
     and c.is_own = false
     and exists (
       select 1 from public.workspace_members m
        where m.workspace_id = c.workspace_id
          and m.user_id = auth.uid()
          and m.status = 'active'
     );

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.comment_set_status(uuid[], text) from public;
grant execute on function public.comment_set_status(uuid[], text) to authenticated;

-- The badge and the "to answer" count both look at status = 'new', which the
-- partial index from p96 already covers. States that are worth filtering on
-- get their own light index.
create index if not exists comments_state_idx
  on public.comments (workspace_id, status, created_at desc)
  where status in ('resolved', 'ignored');
