-- p25 · Plan rename: STARTER → SOLO, PRO → TEAM (BUSINESS unchanged).
-- Same prices, same limits — keys and labels only. One subscription row per
-- workspace keeps its plan value mapped onto the new key.

alter table public.subscriptions drop constraint subscriptions_plan_check;

update public.subscriptions set plan = 'solo' where plan = 'starter';
update public.subscriptions set plan = 'team' where plan = 'pro';

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'solo', 'team', 'business'));
