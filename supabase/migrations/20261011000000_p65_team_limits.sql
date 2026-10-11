-- p65 — Team plan limits (multi-workspace per user)
-- The teams feature: users can own/join multiple workspaces and switch.
-- Caps on teams OWNED per user, by the owner's best active plan:
--   free/solo = 1 (personal workspace only; joining invited teams is
--   governed by the owner's seat limit, not this)
--   team = 3, business = 6, ultimate = unlimited (NULL).
-- p29 previously set team=5/business=NULL; this retunes to the shipped
-- pricing. enforce_workspace_limit (p27/p31) reads plan_limits at insert
-- time, so no trigger changes are needed.

update public.plan_limits set workspaces = 3 where plan = 'team';
update public.plan_limits set workspaces = 6 where plan = 'business';
