-- p29 · Quota changes (mirror of apps/web/src/lib/billing/plans.ts +
-- src/utils/plans.ts — CHANGE BOTH TOGETHER):
--   - paid plans get UNLIMITED scheduled posts per channel (NULL = unlimited;
--     the p27 triggers already return early on a NULL limit, so no trigger
--     changes are needed)
--   - Team seats go 3/3 → 5 users / 5 workspaces
--   - Business seats go 10/10 → unlimited users / unlimited workspaces
-- Free is untouched.

update public.plan_limits
set scheduled_posts_per_channel = null
where plan = 'solo';

update public.plan_limits
set scheduled_posts_per_channel = null,
    users = 5,
    workspaces = 5
where plan = 'team';

update public.plan_limits
set scheduled_posts_per_channel = null,
    users = null,
    workspaces = null
where plan = 'business';
