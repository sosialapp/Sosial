-- p84 -- Channels are ONE pool across every team an owner runs.
--
-- Until now enforce_channel_limit counted rows per workspace, so Team plan
-- (3 owned teams) could carry 25 channels EACH (75 total). The cap is now
-- shared: Team plan means 25 connected channels TOTAL across all teams that
-- user owns. Per-channel scheduled-post limits and every other quota stay
-- per workspace.
--
-- Mirror edits that must match this change:
--   supabase/functions/import-channel-token/index.ts (mobile connect gate)
--   apps/web/src/app/api/oauth/start/route.ts        (web connect gate)

create or replace function public.enforce_channel_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select channels into v_limit
    from public.plan_limits where plan = public.workspace_plan(new.workspace_id);
  if v_limit is null then return new; end if;
  -- The pool belongs to the OWNER of the workspace receiving the channel:
  -- every channel row across all workspaces they own counts.
  select count(*) into v_count
    from public.connected_channels c
    join public.workspaces w on w.id = c.workspace_id
    where w.owner_id = (select owner_id from public.workspaces where id = new.workspace_id);
  if v_count >= v_limit then
    raise exception 'CHANNEL_LIMIT: Your plan allows % connected channel% across your teams. Disconnect one or upgrade to add more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $$;

comment on function public.enforce_channel_limit() is
  'Channel cap = one shared pool across every workspace the owner runs.';
