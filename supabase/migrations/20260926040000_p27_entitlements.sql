-- p27 · Entitlement enforcement: canonical plan limits mirrored into the DB
-- (the enforcement source of truth for triggers/RPCs, kept in lockstep with
-- apps/web/src/lib/billing/plans.ts + src/utils/plans.ts), per-channel
-- scheduled-post caps, workspace/user caps, and an AI credit ledger with
-- atomic, idempotent consume/refund.
--
-- Why a DB copy of the limits? Posts, targets, channels and members are
-- inserted by clients under RLS — the only trustworthy gate is a trigger.
-- The TS config remains canonical for UI + the AI edge gate; this table is
-- the enforcement mirror. CHANGE BOTH TOGETHER.

-- --------------------------------------------------------- plan limits ---
create table if not exists public.plan_limits (
  plan text primary key,
  channels integer,
  scheduled_posts_per_channel integer,
  ai_credits integer,
  users integer,
  workspaces integer,
  watermark_required boolean not null default false
);

insert into public.plan_limits
  (plan, channels, scheduled_posts_per_channel, ai_credits, users, workspaces, watermark_required)
values
  ('free',     3,  10,   20,  1,  1,  true),
  ('solo',     6,  50,  500,  1,  1,  false),
  ('team',    25, 100, 1500,  3,  3,  false),
  ('business',100, 250, 5000, 10, 10, false)
on conflict (plan) do update set
  channels = excluded.channels,
  scheduled_posts_per_channel = excluded.scheduled_posts_per_channel,
  ai_credits = excluded.ai_credits,
  users = excluded.users,
  workspaces = excluded.workspaces,
  watermark_required = excluded.watermark_required;

-- The plan actually in force for a workspace: an active/trialing/past-due
-- paid subscription that has not passed its period end, else free.
create or replace function public.workspace_plan(p_workspace_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select case
      when s.plan <> 'free'
        and s.status in ('active', 'trialing', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now())
      then s.plan else 'free'
    end
    from public.subscriptions s
    where s.workspace_id = p_workspace_id
  ), 'free');
$$;

-- ------------------------------------------------------- entitlements ---
-- AI credit ledger. One row per consume attempt; request_id is the
-- idempotency key so a retried generation is never charged twice.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  credits integer not null,
  model text,
  request_id text not null unique,
  status text not null default 'ok'
    check (status in ('ok', 'rejected', 'refunded')),
  month text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_ws_idx
  on public.ai_usage_events (workspace_id, month, created_at desc);

-- usage_counters.ai_credits is the running monthly total (ai_generations is
-- the retired flat counter; kept + backfilled so no history is lost).
alter table public.usage_counters
  add column if not exists ai_credits integer not null default 0;

update public.usage_counters
  set ai_credits = ai_generations
  where ai_credits = 0 and ai_generations > 0;

-- -------------------------------------------------------- AI charging ---
-- Atomically checks the plan allowance and charges credits. Idempotent by
-- request_id. Never goes negative; a blocked charge records a 'rejected'
-- event and returns ok=false with an upgrade-friendly message.
create or replace function public.ai_consume_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_action text,
  p_credits integer,
  p_request_id text,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_limit integer;
  v_used integer;
  v_id uuid;
  v_status text;
begin
  if p_credits is null or p_credits <= 0 then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Invalid credit amount.');
  end if;
  if p_request_id is null or p_request_id = '' then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Missing request id.');
  end if;

  select ai_credits into v_limit
    from public.plan_limits where plan = public.workspace_plan(p_workspace_id);

  -- Idempotency: claim the request id first.
  insert into public.ai_usage_events
    (workspace_id, user_id, action, credits, model, request_id, month, status)
  values
    (p_workspace_id, p_user_id, p_action, p_credits, p_model, p_request_id, v_month, 'ok')
  on conflict (request_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Duplicate request — replay the prior outcome, never charge again.
    select status into v_status from public.ai_usage_events where request_id = p_request_id;
    select ai_credits into v_used from public.usage_counters
      where workspace_id = p_workspace_id and month = v_month;
    return jsonb_build_object(
      'ok', v_status = 'ok',
      'idempotent', true,
      'used', coalesce(v_used, 0),
      'limit', v_limit,
      'remaining', case when v_limit is null then null else greatest(0, v_limit - coalesce(v_used, 0)) end
    );
  end if;

  select ai_credits into v_used from public.usage_counters
    where workspace_id = p_workspace_id and month = v_month;
  v_used := coalesce(v_used, 0);

  if v_limit is not null and v_used + p_credits > v_limit then
    update public.ai_usage_events set status = 'rejected' where id = v_id;
    return jsonb_build_object(
      'ok', false, 'status', 402, 'used', v_used, 'limit', v_limit,
      'remaining', greatest(0, v_limit - v_used),
      'message', case
        when v_limit = 0 then 'AI is available on paid plans — upgrade to unlock it.'
        when v_limit - v_used <= 0 then 'You have used all ' || v_limit || ' AI credits this month. They reset on the 1st, or upgrade for more.'
        else 'That needs ' || p_credits || ' credits but only ' || greatest(0, v_limit - v_used) || ' remain this month.'
      end
    );
  end if;

  -- Atomic, concurrency-safe charge (guard re-checked in the upsert).
  insert into public.usage_counters (workspace_id, month, ai_credits)
  values (p_workspace_id, v_month, p_credits)
  on conflict (workspace_id, month)
  do update set ai_credits = public.usage_counters.ai_credits + p_credits, updated_at = now()
    where (v_limit is null or public.usage_counters.ai_credits + p_credits <= v_limit)
  returning ai_credits into v_used;

  if v_used is null then
    -- Lost a concurrency race against the limit.
    update public.ai_usage_events set status = 'rejected' where id = v_id;
    select ai_credits into v_used from public.usage_counters
      where workspace_id = p_workspace_id and month = v_month;
    return jsonb_build_object(
      'ok', false, 'status', 402, 'used', coalesce(v_used, 0), 'limit', v_limit,
      'remaining', case when v_limit is null then null else greatest(0, v_limit - coalesce(v_used, 0)) end,
      'message', 'You are out of AI credits for this month. They reset on the 1st, or upgrade for more.'
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'used', v_used, 'limit', v_limit,
    'remaining', case when v_limit is null then null else greatest(0, v_limit - v_used) end
  );
end;
$$;

-- Refund a charge when generation fails before producing output. Idempotent:
-- a second call on an already-refunded event is a no-op.
create or replace function public.ai_refund_credits(p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select id, workspace_id, month, credits, status
    into v
    from public.ai_usage_events
    where request_id = p_request_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Unknown request id.');
  end if;
  if v.status <> 'ok' then
    return jsonb_build_object('ok', true, 'refunded', false);
  end if;
  update public.ai_usage_events set status = 'refunded' where id = v.id;
  update public.usage_counters
    set ai_credits = greatest(0, ai_credits - v.credits), updated_at = now()
    where workspace_id = v.workspace_id and month = v.month;
  return jsonb_build_object('ok', true, 'refunded', true, 'credits', v.credits);
end;
$$;

-- ------------------------------------------------ DB-level limit gates ---
-- Channel cap (backstop for /api/oauth/start).
create or replace function public.enforce_channel_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select channels into v_limit
    from public.plan_limits where plan = public.workspace_plan(new.workspace_id);
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.connected_channels where workspace_id = new.workspace_id;
  if v_count >= v_limit then
    raise exception 'CHANNEL_LIMIT: Your plan allows % connected channel%. Disconnect one or upgrade to add more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists connected_channels_limit on public.connected_channels;
create trigger connected_channels_limit
  before insert on public.connected_channels
  for each row execute function public.enforce_channel_limit();

-- Per-channel scheduled-post cap. A slot is held while a target is not
-- sent/skipped and frees the moment the post publishes.
create or replace function public.enforce_scheduled_post_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
  v_ws uuid;
begin
  select workspace_id into v_ws from public.posts where id = new.post_id;
  select scheduled_posts_per_channel into v_limit
    from public.plan_limits where plan = public.workspace_plan(v_ws);
  if v_limit is null then return new; end if;
  select count(*) into v_count
    from public.post_targets
    where channel_id = new.channel_id and status not in ('sent', 'skipped');
  if v_count >= v_limit then
    raise exception 'POST_LIMIT: This channel already has % scheduled posts — your plan''s limit. Publish or remove one, or upgrade.',
      v_limit
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists post_targets_limit on public.post_targets;
create trigger post_targets_limit
  before insert on public.post_targets
  for each row execute function public.enforce_scheduled_post_limit();

-- Team seat cap (invited + active count; removed does not).
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.status = 'removed' then return new; end if;
  select users into v_limit
    from public.plan_limits where plan = public.workspace_plan(new.workspace_id);
  if v_limit is null then return new; end if;
  select count(*) into v_count
    from public.workspace_members
    where workspace_id = new.workspace_id and status <> 'removed';
  if v_count >= v_limit then
    raise exception 'SEAT_LIMIT: Your plan includes % team member%. Upgrade to add more.',
      v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists workspace_members_seat_limit on public.workspace_members;
create trigger workspace_members_seat_limit
  before insert on public.workspace_members
  for each row execute function public.enforce_seat_limit();

-- Workspace cap, resolved from the user's highest active plan among the
-- workspaces they already own (else free).
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
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now())
    order by case s.plan when 'business' then 3 when 'team' then 2 when 'solo' then 1 else 0 end desc
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

-- The old monthly flat post counter is superseded by the per-channel cap.
drop trigger if exists posts_usage_count on public.posts;

-- ------------------------------------------------------------------ RLS ---
alter table public.plan_limits enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);

drop policy if exists ai_events_member_read on public.ai_usage_events;
create policy ai_events_member_read on public.ai_usage_events for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = ai_usage_events.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

grant select on public.plan_limits, public.ai_usage_events to authenticated;
grant execute on function public.workspace_plan(uuid) to authenticated, service_role;
grant execute on function public.ai_consume_credits(uuid, uuid, text, integer, text, text) to service_role;
grant execute on function public.ai_refund_credits(text) to service_role;
