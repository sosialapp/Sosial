-- P48: notification bell — DB-side triggers centralize event capture.
--
-- notifications(
--   id, workspace_id,
--   user_id      -> recipient (FK auth.users)
--   kind         -> 'member_joined' | 'member_left' | 'member_removed' | 'role_changed'
--               |  'approval_requested' | 'approval_approved' | 'approval_changes'
--               |  'target_sent' | 'target_failed'
--   title/body   -> rendered text (built by triggers)
--   href         -> in-app destination the bell links to
--   read_at      -> null until the user opens it
-- )
--
-- Sources wired here:
--   accept_invite        -> member_joined to owner+admins (and welcome to the joiner)
--   remove_member        -> member_removed to the removed user
--   leave_workspace      -> member_left to owner+admins
--   set_member_role      -> role_changed to the affected user
--   post_targets.status  -> target_sent / target_failed to the post creator
--   approvals            -> approval_requested to owner+admins; decided to the requester
--
-- Fan-out rule: notify every active member whose role is owner/admin
-- (management events); single-recipient for personal events.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_ws_idx on public.notifications (workspace_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_owner_all on public.notifications;
create policy notifications_owner_all on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- helpers ----------

create or replace function public.notif_admins(p_ws uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.workspace_members
  where workspace_id = p_ws and status = 'active' and role in ('owner', 'admin');
$$;

create or replace function public.notif_insert(
  p_ws uuid, p_user uuid, p_kind text, p_title text, p_body text, p_href text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (workspace_id, user_id, kind, title, body, href)
  values (p_ws, p_user, p_kind, p_title, p_body, p_href);
$$;

-- ---------- 1. team events ----------

-- accept_invite: joined member + every admin hears about it.
create or replace function public.notif_on_accept_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid := new.workspace_id;
  v_uid uuid := new.user_id;
  v_name text;
  v_wsname text;
begin
  select coalesce(nullif(full_name, ''), split_part(email, '@', 1), 'A teammate')
    into v_name
    from public.profiles where id = v_uid;
  select name into v_wsname from public.workspaces where id = v_ws;
  if v_wsname is null then v_wsname := 'the workspace'; end if;

  perform public.notif_insert(
    v_ws, v_uid, 'member_joined',
    'Welcome to ' || v_wsname,
    'Your workspace is ready — connect channels or create your first post.',
    '/dashboard'
  );
  perform public.notif_insert(
    v_ws, admin_id, 'member_joined',
    v_name || ' joined ' || v_wsname,
    'They can now be assigned roles and channels in Team.',
    '/team'
  )
  from public.notif_admins(v_ws) where admin_id <> v_uid;
  return null;
end;
$$;

drop trigger if exists notif_accept_invite on public.invites;
create trigger notif_accept_invite
  after update of accepted_at on public.invites
  for each row
  when (new.accepted_at is not null and old.accepted_at is null)
  execute function public.notif_on_accept_invite();

-- remove_member / leave_workspace both flip status to 'removed': one trigger
-- tells the removed member, and (when they left by themselves) the admins.
create or replace function public.notif_on_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wsname text;
  v_name text;
  v_admin uuid;
begin
  select name into v_wsname from public.workspaces where id = old.workspace_id;

  perform public.notif_insert(
    old.workspace_id, old.user_id, 'member_removed',
    'You were removed from ' || coalesce(v_wsname, 'a workspace'),
    'Your channels there are no longer reachable from your account.',
    null
  );

  select coalesce(nullif(full_name, ''), split_part(email, '@', 1), 'A teammate')
    into v_name
    from public.profiles where id = old.user_id;
  for v_admin in
    select user_id from public.notif_admins(old.workspace_id) where admin_id <> old.user_id
  loop
    perform public.notif_insert(
      old.workspace_id, v_admin, 'member_left',
      v_name || ' left ' || coalesce(v_wsname, 'the workspace'),
      'Their channels were unassigned. Review Team settings when ready.',
      '/team'
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists notif_member_removed on public.workspace_members;
create trigger notif_member_removed
  after update of status on public.workspace_members
  for each row
  when (new.status = 'removed' and old.status <> 'removed')
  execute function public.notif_on_member_removed();

-- set_member_role: the affected member is told.
create or replace function public.notif_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wsname text;
begin
  select name into v_wsname from public.workspaces where id = new.workspace_id;
  perform public.notif_insert(
    new.workspace_id, new.user_id, 'role_changed',
    'You are now ' || new.role || ' in ' || coalesce(v_wsname, 'the workspace'),
    'Roles control which channels and approvals you can access.',
    '/team'
  );
  return null;
end;
$$;

drop trigger if exists notif_role_change on public.workspace_members;
create trigger notif_role_change
  after update of role on public.workspace_members
  for each row
  when (new.role is distinct from old.role)
  execute function public.notif_on_role_change();

-- ---------- 2. approvals ----------

-- Approval requested: admins hear about it (skip the requester).
create or replace function public.notif_on_approval_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid := new.workspace_id;
  v_by uuid;
  v_title text;
begin
  select created_by into v_by from public.posts where id = new.post_id;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;

  perform public.notif_insert(
    v_ws, admin_id, 'approval_requested',
    'Post needs your approval',
    'From ' || coalesce((select split_part(email, '@', 1) from public.profiles where id = v_by), 'a member')
      || ': “' || coalesce(v_title, 'Untitled') || '”',
    '/post?filter=approvals'
  )
  from public.notif_admins(v_ws) where admin_id <> v_by;
  return null;
end;
$$;

drop trigger if exists notif_approval_open on public.approvals;
create trigger notif_approval_open
  after insert on public.approvals
  for each row
  when (new.status = 'pending')
  execute function public.notif_on_approval_open();

-- Approval decided: the requester hears about it.
create or replace function public.notif_on_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid := new.workspace_id;
  v_by uuid;
  v_title text;
begin
  if new.status = 'pending' or new.status is not distinct from old.status then
    return null;
  end if;
  select created_by into v_by from public.posts where id = new.post_id;
  if v_by is null then return null; end if;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;

  if new.status = 'approved' then
    perform public.notif_insert(
      v_ws, v_by, 'approval_approved',
      'Your post was approved',
      '“' || coalesce(v_title, 'Untitled') || '” is queued for publishing.',
      '/post?filter=queue'
    );
  elsif new.status = 'changes_requested' then
    perform public.notif_insert(
      v_ws, v_by, 'approval_changes',
      'Changes requested on your post',
      coalesce(new.comment, 'Open the post to see what to change.')
      || ' — “' || coalesce(v_title, 'Untitled') || '”',
      '/post?filter=drafts'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notif_approval_decided on public.approvals;
create trigger notif_approval_decided
  after update of status on public.approvals
  for each row
  when (new.status <> old.status and new.status in ('approved', 'changes_requested'))
  execute function public.notif_on_approval_decided();

-- ---------- 3. publish results ----------

-- mark_target_sent/failed flip post_targets.status; one trigger covers both.
create or replace function public.notif_on_target_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid := new.workspace_id;
  v_by uuid;
  v_title text;
  v_label text;
begin
  if new.status not in ('sent', 'failed') or new.status is not distinct from old.status then
    return null;
  end if;
  select created_by into v_by from public.posts where id = new.post_id;
  if v_by is null then return null; end if;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;
  select coalesce(nullif(display_name, ''), handle, provider::text)
    into v_label
    from public.connected_channels where id = new.channel_id;

  if new.status = 'sent' then
    perform public.notif_insert(
      v_ws, v_by, 'target_sent',
      'Published to ' || coalesce(v_label, new.provider::text),
      '“' || coalesce(v_title, 'Untitled') || '” is live.',
      '/post?filter=sent'
    );
  else
    perform public.notif_insert(
      v_ws, v_by, 'target_failed',
      'Could not publish to ' || coalesce(v_label, new.provider::text),
      coalesce(left(new.last_error, 200), 'Open the post to retry.'),
      '/post?filter=failed'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notif_target_status on public.post_targets;
create trigger notif_target_status
  after update of status on public.post_targets
  for each row
  when (new.status in ('sent', 'failed'))
  execute function public.notif_on_target_status();
