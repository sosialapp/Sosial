-- p102 -- disconnect revokes, it never deletes.
--
-- `remove-channel-token` used to delete the channel row. post_targets.channel_id
-- is ON DELETE CASCADE, so every post that went out through that account lost
-- its destination row: the post card then showed a sibling target (or a generic
-- provider default) instead of the account it was published to, analytics lost
-- the per-channel history, and "scheduled posts pause until you reconnect" was
-- untrue because those targets were gone.
--
-- Disconnect now sets status='revoked' (the app already treats that as gone:
-- mobile pulls only status='connected', community reads filter revoked). The
-- row stays as history for post cards and stats, and import-channel-token's
-- upsert on (workspace_id, provider, external_id) revives it on reconnect.
--
-- A revoked row is history, not capacity, so the shared channel pool stops
-- counting it everywhere the cap is measured.

create or replace function public.enforce_channel_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_limit integer;
  v_count integer;
begin
  select channels into v_limit
    from public.plan_limits where plan = public.workspace_plan(new.workspace_id);
  if v_limit is null then return new; end if;
  -- The pool belongs to the OWNER of the workspace receiving the channel:
  -- every live channel row across all workspaces they own counts.
  select count(*) into v_count
    from public.connected_channels c
    join public.workspaces w on w.id = c.workspace_id
    where w.owner_id = (select owner_id from public.workspaces where id = new.workspace_id)
      and c.status <> 'revoked';
  if v_count >= v_limit then
    raise exception 'CHANNEL_LIMIT: Your plan allows % connected channel% across your teams. Disconnect one or upgrade to add more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $function$;

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
        and c.status <> 'revoked'
    )
  );
end $$;

revoke all on function public.channel_pool(uuid) from public, anon;
grant execute on function public.channel_pool(uuid) to authenticated;
