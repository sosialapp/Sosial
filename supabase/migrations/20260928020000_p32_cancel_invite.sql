-- p32 · Cancel a pending workspace invite (owner/admin only).
--
-- Until now invites could only expire (7 days) — there was no way to take
-- one back. cancel_invite deletes a pending (unaccepted) invite row. An
-- already-accepted invite is a membership: remove the member instead.

create or replace function cancel_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_accepted timestamptz;
begin
  select workspace_id, accepted_at into v_ws, v_accepted
    from invites where id = p_invite_id;
  if not found then
    raise exception 'Invite not found.';
  end if;
  if v_accepted is not null then
    raise exception 'That invite was already accepted — remove the member instead.';
  end if;
  if not (
    workspace_role(v_ws) in ('owner', 'admin')
    or v_ws in (select id from workspaces where owner_id = auth.uid())
  ) then
    raise exception 'Only owners and admins can cancel invites.';
  end if;
  delete from invites where id = p_invite_id;
end $$;

revoke all on function cancel_invite(uuid) from public;
grant execute on function cancel_invite(uuid) to authenticated;
