-- p33 · Member roles and leaving (owner appoints, members may walk away).
--
-- set_member_role: owner changes anyone except an owner; admin changes
-- members only (promotion to admin is allowed because admins can already
-- invite admins directly — no privilege gain). 'owner' can never be granted;
-- ownership does not transfer through this path.
-- leave_workspace: any active member or admin removes THEMSELVES. The owner
-- cannot abandon the workspace (it would orphan channels, billing and the
-- team) — transfer ownership first (not yet built: refused loudly instead).

create or replace function set_member_role(p_member_id uuid, p_role team_role)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_target team_role;
  v_caller team_role;
begin
  if p_role = 'owner' then
    raise exception 'Ownership cannot be granted this way.';
  end if;
  select workspace_id, role into v_ws, v_target
    from workspace_members where id = p_member_id and status <> 'removed';
  if not found then
    raise exception 'Teammate not found.';
  end if;
  if v_target = 'owner' then
    raise exception 'The workspace owner keeps their role.';
  end if;
  v_caller := workspace_role(v_ws);
  -- The workspace creator always counts as owner.
  if v_ws in (select id from workspaces where owner_id = auth.uid()) then
    v_caller := 'owner';
  end if;
  if v_caller = 'admin' and v_target <> 'member' then
    raise exception 'Admins can only change members.';
  end if;
  if v_caller not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change roles.';
  end if;
  update workspace_members set role = p_role where id = p_member_id;
end $$;

create or replace function leave_workspace(p_workspace_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role team_role;
begin
  select role into v_role
    from workspace_members
   where workspace_id = p_workspace_id
     and user_id = auth.uid()
     and status = 'active';
  if not found then
    raise exception 'You are not a member of this workspace.';
  end if;
  if v_role = 'owner' then
    raise exception 'Owners cannot leave — transfer ownership first.';
  end if;
  update workspace_members set status = 'removed'
   where workspace_id = p_workspace_id
     and user_id = auth.uid()
     and status = 'active';
end $$;

revoke all on function set_member_role(uuid, team_role) from public;
grant execute on function set_member_role(uuid, team_role) to authenticated;
revoke all on function leave_workspace(uuid) from public;
grant execute on function leave_workspace(uuid) to authenticated;
