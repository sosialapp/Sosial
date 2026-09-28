-- p31 · Ultimate lifetime plan (mirror of apps/web/src/lib/billing/plans.ts
-- + src/utils/plans.ts — CHANGE ALL TOGETHER):
--   - plan_limits gets the ultimate row: every quota NULL (= unlimited),
--     watermark off. The p27 triggers already return early on NULL limits.
--   - subscriptions constraints admit plan 'ultimate' + status 'lifetime'.
--   - workspace_plan() honors a lifetime grant (no period end to outlive).
--   - the workspace-cap rank puts ultimate on top.
-- Ultimate is sold as a one-time $1 Stripe payment (no subscription); the
-- webhook grants status='lifetime'. It is never advertised on public pricing
-- — only the in-app profile plan sections offer it, admins only.

insert into public.plan_limits
  (plan, channels, scheduled_posts_per_channel, ai_credits, users, workspaces, watermark_required)
values
  ('ultimate', null, null, null, null, null, false)
on conflict (plan) do update set
  channels = excluded.channels,
  scheduled_posts_per_channel = excluded.scheduled_posts_per_channel,
  ai_credits = excluded.ai_credits,
  users = excluded.users,
  workspaces = excluded.workspaces,
  watermark_required = excluded.watermark_required;

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'solo', 'team', 'business', 'ultimate'));

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'lifetime'));

create or replace function public.workspace_plan(p_workspace_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select case
      when s.plan = 'ultimate' and s.status = 'lifetime'
      then 'ultimate'
      when s.plan <> 'free'
        and s.status in ('active', 'trialing', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now())
      then s.plan else 'free'
    end
    from public.subscriptions s
    where s.workspace_id = p_workspace_id
  ), 'free');
$$;

-- Workspace cap rank: ultimate outranks everything (its own workspaces
-- limit is NULL anyway, but the rank picks whose limits apply).
create or replace function public.enforce_workspace_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  select coalesce((
    select s.plan
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where w.owner_id = new.owner_id
      and s.plan <> 'free'
      and (
        (s.status in ('active', 'trialing', 'past_due')
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.plan = 'ultimate' and s.status = 'lifetime')
      )
    order by case s.plan when 'ultimate' then 4 when 'business' then 3 when 'team' then 2 when 'solo' then 1 else 0 end desc
    limit 1
  ), 'free') into v_plan;

  select workspaces into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.workspaces where owner_id = new.owner_id;
  if v_count >= v_limit then
    raise exception 'WORKSPACE_LIMIT: Your plan allows % workspace%. Upgrade to create more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists workspaces_limit on public.workspaces;
create trigger workspaces_limit
  before insert on public.workspaces
  for each row execute function public.enforce_workspace_limit();
