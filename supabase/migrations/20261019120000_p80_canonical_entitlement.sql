-- P80 · Canonical entitlement: one resolver, one limit table, server-visible.
--
-- The TS price book (apps/web/src/lib/billing/plans.ts, mirrored by
-- src/utils/plans.ts) is documented as canonical and the DB plan_limits table
-- as its "enforcement mirror — CHANGE BOTH TOGETHER". They had drifted:
--
--   plan      column                        DB      canonical (UI)
--   solo      scheduled_posts_per_channel   50      null (unlimited)
--   team      scheduled_posts_per_channel   100     null (unlimited)
--   business  scheduled_posts_per_channel   250     null (unlimited)
--   team      users                          3       5
--   business  users                         10       null (unlimited)
--   business  workspaces                    10       6
--   ultimate  (missing row)                 -       unlimited, no watermark
--
-- So a Solo user was shown "Unlimited scheduled posts" and then blocked at 50.
-- This migration upserts plan_limits to the canonical values (Ultimate included
-- so its unlimited row is explicit rather than accidental).
--
-- It also fixes enforce_workspace_limit(): it resolved the owner's plan from
-- subscriptions with status in (active,trialing,past_due), which excludes a
-- lifetime Ultimate grant (status 'lifetime') and ranked 'ultimate' as 0, so an
-- Ultimate owner fell back to the Free cap of 1 workspace. Both callers now
-- share one owner-based resolver, owner_plan(), and workspace_plan() delegates
-- to it (p74 logic, unchanged behaviour).
--
-- Finally workspace_entitlement() exposes the plan + limits to a member over
-- PostgREST so the mobile app stops trusting its device-local plan.

-- ------------------------------------------------- canonical plan limits ---
insert into public.plan_limits
  (plan, channels, scheduled_posts_per_channel, ai_credits, users, workspaces, watermark_required, storage_bytes)
values
  ('free',      3,  10,   20,  1,    1,    true,  2::bigint   * 1024 * 1024 * 1024),
  ('solo',      6,  null, 500, 1,    1,    false, 25::bigint  * 1024 * 1024 * 1024),
  ('team',     25,  null, 1500, 5,   3,    false, 100::bigint * 1024 * 1024 * 1024),
  ('business', 100, null, 5000, null, 6,   false, 500::bigint * 1024 * 1024 * 1024),
  ('ultimate', null, null, null, null, null, false, null)
on conflict (plan) do update set
  channels = excluded.channels,
  scheduled_posts_per_channel = excluded.scheduled_posts_per_channel,
  ai_credits = excluded.ai_credits,
  users = excluded.users,
  workspaces = excluded.workspaces,
  watermark_required = excluded.watermark_required,
  storage_bytes = excluded.storage_bytes;

-- ------------------------------------------------- one owner resolver ----
-- The owner's best active plan across every team they own. Lifetime Ultimate
-- never expires; past-due keeps a grace period until the period ends.
create or replace function public.owner_plan(p_owner_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select s.plan
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where w.owner_id = p_owner_id
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

-- The plan in force for a workspace = its owner's plan.
create or replace function public.workspace_plan(p_workspace_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select public.owner_plan((select owner_id from public.workspaces where id = p_workspace_id));
$$;

-- Workspace creation is tied to the owner's plan (was: a partial inline copy
-- that missed lifetime Ultimate).
create or replace function public.enforce_workspace_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select workspaces into v_limit
    from public.plan_limits where plan = public.owner_plan(new.owner_id);
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.workspaces where owner_id = new.owner_id;
  if v_count >= v_limit then
    raise exception 'WORKSPACE_LIMIT: Your plan allows % workspace%. Upgrade to create more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $$;

-- --------------------------------------------- entitlement over the API ---
-- Member-readable plan + limits for a workspace, in the shape of the TS
-- PlanLimits interface (camelCase) so clients can consume it directly. This is
-- the server truth the mobile app renders and gates on.
create or replace function public.workspace_entitlement(p_workspace_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  v_plan text;
  v jsonb;
begin
  if not (public.is_workspace_member(p_workspace_id) or public.is_app_admin()) then
    raise exception 'Not a member of this workspace.' using errcode = '42501';
  end if;

  v_plan := public.workspace_plan(p_workspace_id);

  -- Falls back to the Free row if a plan is somehow absent from plan_limits.
  select jsonb_build_object(
    'plan', v_plan,
    'limits', jsonb_build_object(
      'channels', pl.channels,
      'scheduledPostsPerChannel', pl.scheduled_posts_per_channel,
      'aiCredits', pl.ai_credits,
      'users', pl.users,
      'workspaces', pl.workspaces,
      'storageBytes', pl.storage_bytes,
      'watermarkRequired', pl.watermark_required
    )
  ) into v
  from public.plan_limits pl
  where pl.plan in (v_plan, 'free')
  order by (pl.plan = v_plan) desc
  limit 1;

  return v;
end $$;

-- ----------------------------------------------------------------- grants ---
-- owner_plan is an internal helper: revoke the default PUBLIC grant.
revoke all on function public.owner_plan(uuid) from public, anon, authenticated;
grant execute on function public.owner_plan(uuid) to service_role;

-- workspace_entitlement is for signed-in clients only.
revoke all on function public.workspace_entitlement(uuid) from public, anon;
grant execute on function public.workspace_entitlement(uuid) to authenticated, service_role;
