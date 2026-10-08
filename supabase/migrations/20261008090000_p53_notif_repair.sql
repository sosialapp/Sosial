-- P53: repair P48 notification triggers.
--
-- P48 shipped four runtime faults (all 42703-class: references to columns
-- that do not exist), found because notif_on_target_status rolled back
-- every mark_target_sent call — posts published, DB never flipped, jobs
-- retried into duplicates:
--   1. notif_on_target_status read NEW.workspace_id, but post_targets has no
--      workspace_id column (it joins via posts). Resolve via posts instead.
--   2-4. notif_on_accept_invite / notif_on_approval_open /
--      notif_on_member_removed referenced an unbound `admin_id` (the helper
--      returns `user_id`). Rewritten as explicit FOR loops over admins.
-- notif_on_approval_decided and notif_on_role_change were verified correct
-- (approvals and workspace_members both carry workspace_id).

create or replace function public.notif_on_target_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_by uuid;
  v_title text;
  v_label text;
begin
  if new.status not in ('sent', 'failed') or new.status is not distinct from old.status then
    return null;
  end if;
  -- post_targets carries no workspace_id: resolve through the post.
  select workspace_id, created_by into v_ws, v_by from public.posts where id = new.post_id;
  if v_ws is null or v_by is null then return null; end if;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;
  select coalesce(nullif(display_name, ''), handle, provider::text)
    into v_label
    from public.connected_channels where id = new.channel_id;

  if new.status = 'sent' then
    perform public.notif_insert(
      v_ws, v_by, 'target_sent',
      'Published to ' || coalesce(v_label, new.provider::text),
      '"' || coalesce(v_title, 'Untitled') || '" is live.',
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
  v_admin uuid;
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
  for v_admin in
    select user_id from public.notif_admins(v_ws) where user_id <> v_uid
  loop
    perform public.notif_insert(
      v_ws, v_admin, 'member_joined',
      v_name || ' joined ' || v_wsname,
      'They can now be assigned roles and channels in Team.',
      '/team'
    );
  end loop;
  return null;
end;
$$;

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
  v_admin uuid;
begin
  select created_by into v_by from public.posts where id = new.post_id;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;

  for v_admin in
    select user_id from public.notif_admins(v_ws) where user_id <> v_by
  loop
    perform public.notif_insert(
      v_ws, v_admin, 'approval_requested',
      'Post needs your approval',
      'From ' || coalesce((select split_part(email, '@', 1) from public.profiles where id = v_by), 'a member')
        || ': "' || coalesce(v_title, 'Untitled') || '"',
      '/post?filter=approvals'
    );
  end loop;
  return null;
end;
$$;

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
    select user_id from public.notif_admins(old.workspace_id) where user_id <> old.user_id
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
