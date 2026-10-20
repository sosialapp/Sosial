-- p85 -- channel_pool: the shared-pool snapshot for friendly cap UIs.
--
-- enforce_channel_limit (p84) made the channel cap ONE pool across every
-- workspace an owner runs. Clients that show "n / cap" or pre-flight the cap
-- need the same cross-team usage number, so this RPC mirrors the trigger's
-- counting exactly: cap from the receiving workspace's plan, used across all
-- workspaces the plan's owner owns. Membership-gated like
-- workspace_entitlement. NULL cap = unlimited.
create or replace function public.channel_pool(p_workspace_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  v_plan text;
begin
  if not (public.is_workspace_member(p_workspace_id) or public.is_app_admin()) then
    raise exception 'Not a member of this workspace.' using errcode = '42501';
  end if;

  v_plan := public.workspace_plan(p_workspace_id);

  return jsonb_build_object(
    'cap', (
      select pl.channels
      from public.plan_limits pl
      where pl.plan in (v_plan, 'free')
      order by (pl.plan = v_plan) desc
      limit 1
    ),
    'used', (
      select count(*)::int
      from public.connected_channels c
      join public.workspaces w on w.id = c.workspace_id
      where w.owner_id = (select owner_id from public.workspaces where id = p_workspace_id)
    )
  );
end $$;

revoke all on function public.channel_pool(uuid) from public, anon;
grant execute on function public.channel_pool(uuid) to authenticated;
