-- P9 · Team RPCs: invites, membership, grants (server-enforced RBAC)
--
-- The P1 schema holds the tables; this migration adds the only sanctioned
-- write paths for team management. Every function is SECURITY DEFINER with
-- the role check INSIDE, so clients call RPCs instead of writing tables
-- directly (direct writes stay possible via RLS for owner/admin, but the
-- apps must use these). Clients never touch workspace_members/grants/invites
-- with raw insert/update/delete after this lands.

-- Delivery tracking for the send_invite job retry loop.
alter table invites add column if not exists emailed_at timestamptz;

-- ---------------------------------------------------------- create_invite ---
-- Owner/admin creates (or refreshes) an invite. Returns the full row so the
-- send-invite function can email the token link. Never invites owners.
create or replace function create_invite(
  p_workspace_id uuid,
  p_email text,
  p_role team_role default 'member',
  p_all_channels boolean default false
)
returns invites
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_row invites%rowtype;
begin
  if v_email = '' or v_email not like '%@%.%' then
    raise exception 'Enter a valid email address.';
  end if;
  if p_role = 'owner' then
    raise exception 'Cannot invite another owner.';
  end if;
  if not (
    workspace_role(p_workspace_id) in ('owner', 'admin')
    or p_workspace_id in (select id from workspaces where owner_id = auth.uid())
  ) then
    raise exception 'Only owners and admins can invite.';
  end if;
  -- Refresh a pending invite for the same email instead of duplicating.
  select * into v_row from invites
   where workspace_id = p_workspace_id
     and lower(email) = v_email
     and accepted_at is null
   order by created_at desc
   limit 1;
  if found then
    update invites
       set role = p_role,
           all_channels = p_all_channels,
           expires_at = now() + interval '7 days',
           invited_by = auth.uid(),
           emailed_at = null
     where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;
  insert into invites (workspace_id, email, role, all_channels, invited_by)
  values (p_workspace_id, v_email, p_role, p_all_channels, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------- accept_invite ---
-- Redeems an invite token for the SIGNED-IN user. The invite email must match
-- the auth JWT email — nobody can redeem someone else's invite. Single-use
-- via accepted_at (concurrent redeems converge on the same membership row).
create or replace function accept_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv invites%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select * into v_inv from invites where token = p_token;
  if not found then
    raise exception 'Invite not found.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Invite already accepted.';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Invite expired.';
  end if;
  if lower(v_inv.email) != v_email or v_email = '' then
    raise exception 'This invite was sent to a different email address.';
  end if;
  insert into workspace_members (workspace_id, user_id, email, role, status, all_channels)
  values (v_inv.workspace_id, auth.uid(), v_inv.email, v_inv.role, 'active', v_inv.all_channels)
  on conflict (workspace_id, email) do update set
    user_id = excluded.user_id,
    role = excluded.role,
    status = 'active',
    all_channels = excluded.all_channels;
  update invites set accepted_at = now() where id = v_inv.id;
  return v_inv.workspace_id;
end $$;

-- ---------------------------------------------------------- remove_member ---
-- Owner removes anyone except the workspace owner; admin removes members
-- only. Pending (never-joined) invites are revoked by deleting the invite
-- row, which owner/admin RLS already allows.
create or replace function remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller team_role;
  v_target team_role;
  v_owner uuid;
begin
  select owner_id into v_owner from workspaces where id = p_workspace_id;
  if v_owner is null then
    raise exception 'Workspace not found.';
  end if;
  if p_user_id = v_owner then
    raise exception 'The workspace owner cannot be removed.';
  end if;
  v_caller := workspace_role(p_workspace_id);
  if not (v_caller in ('owner', 'admin') or v_owner = auth.uid()) then
    raise exception 'Only owners and admins can remove members.';
  end if;
  select role into v_target from workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active';
  if v_caller = 'admin' and v_target in ('owner', 'admin') then
    raise exception 'Admins can only remove members.';
  end if;
  update workspace_members set status = 'removed'
   where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active';
end $$;

-- ------------------------------------------------------ set_member_grants ---
-- Replaces a member's provider grants + all_channels flag in one call.
create or replace function set_member_grants(
  p_member_id uuid,
  p_providers provider_key[] default '{}',
  p_all_channels boolean default false
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from workspace_members where id = p_member_id;
  if v_ws is null then
    raise exception 'Member not found.';
  end if;
  if not (
    workspace_role(v_ws) in ('owner', 'admin')
    or v_ws in (select id from workspaces where owner_id = auth.uid())
  ) then
    raise exception 'Only owners and admins can change grants.';
  end if;
  update workspace_members set all_channels = p_all_channels where id = p_member_id;
  delete from member_channel_grants where member_id = p_member_id;
  if not p_all_channels and p_providers is not null and cardinality(p_providers) > 0 then
    insert into member_channel_grants (member_id, provider)
    select p_member_id, unnest(p_providers)
    on conflict do nothing;
  end if;
end $$;

-- --------------------------------------------------------------- grants ---
revoke all on function create_invite(uuid, text, team_role, boolean) from public;
revoke all on function accept_invite(uuid) from public;
revoke all on function remove_member(uuid, uuid) from public;
revoke all on function set_member_grants(uuid, provider_key[], boolean) from public;
grant execute on function create_invite(uuid, text, team_role, boolean) to authenticated;
grant execute on function accept_invite(uuid) to authenticated;
grant execute on function remove_member(uuid, uuid) to authenticated;
grant execute on function set_member_grants(uuid, provider_key[], boolean) to authenticated;
