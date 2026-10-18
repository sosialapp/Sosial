-- p74 · The plan follows the OWNER, never the team. A workspace's plan is the
-- owner's best active subscription across every team that owner owns (this
-- team is in that set, since the owner owns it).
-- Mirror of apps/web/src/lib/billing/entitlement.ts, CHANGE TOGETHER.
-- Team CREATION stays tied to each user's own plan (enforce_workspace_limit,
-- already owner-based, unchanged).
--
-- INVARIANT: a subscription must never travel with a team. This resolver alone
-- cannot re-limit a transferred team, because the paid row sits ON the
-- workspace being handed over and so joins the new owner's set. Any future
-- team-transfer feature MUST first move the subscription row to a workspace
-- the previous owner still owns (creating one if needed), or delete it.

create or replace function public.workspace_plan(p_workspace_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select s.plan
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where w.owner_id = (select owner_id from public.workspaces where id = p_workspace_id)
      and s.plan <> 'free'
      and (
        (s.status in ('active', 'trialing', 'past_due')
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.plan = 'ultimate' and s.status = 'lifetime')
      )
    order by case s.plan
      when 'ultimate' then 4 when 'business' then 3
      when 'team' then 2 when 'solo' then 1 else 0 end desc
    limit 1
  ), 'free');
$$;
