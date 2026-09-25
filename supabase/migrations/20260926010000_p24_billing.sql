-- p24 · Billing foundation: subscriptions (one row per workspace), monthly
-- usage counters (usage period = calendar month, independent of the billing
-- interval), and processed Stripe event ids for webhook idempotency.
--
-- Canonical intervals are exactly 'monthly' | 'annual'. Plans are exactly
-- 'free' | 'starter' | 'pro' | 'business'. A Pro annual subscription is ONE
-- row: plan='pro', billing_interval='annual' — never separate rows per
-- interval, never "pro_annual" as a plan.

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'business')),
  billing_interval text
    check (billing_interval in ('monthly', 'annual')),
  status text not null default 'free'
    check (status in ('free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month text not null, -- usage period bucket, 'YYYY-MM' (UTC)
  ai_generations integer not null default 0,
  posts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, month)
);

create table if not exists public.billing_events (
  event_id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- Scheduled/sent posts count toward the workspace's monthly post usage the
-- moment they enter the queue (drafts never count).
create or replace function public.billing_count_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'draft' then
    insert into public.usage_counters (workspace_id, month, posts)
    values (new.workspace_id, to_char(now() at time zone 'utc', 'YYYY-MM'), 1)
    on conflict (workspace_id, month)
    do update set posts = public.usage_counters.posts + 1, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_usage_count on public.posts;
create trigger posts_usage_count
  after insert on public.posts
  for each row execute function public.billing_count_post();

-- Atomic monthly AI-usage increment for the edge functions.
create or replace function public.billing_add_ai_generation(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_new integer;
begin
  insert into public.usage_counters (workspace_id, month, ai_generations)
  values (p_workspace_id, v_month, 1)
  on conflict (workspace_id, month)
  do update set ai_generations = public.usage_counters.ai_generations + 1, updated_at = now()
  returning ai_generations into v_new;
  return v_new;
end;
$$;

grant execute on function public.billing_add_ai_generation(uuid) to service_role;

-- Members read their workspace's subscription + usage; all writes happen with
-- the service role (checkout, portal, webhooks, edge functions).
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists subs_member_read on public.subscriptions;
create policy subs_member_read
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = subscriptions.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists usage_member_read on public.usage_counters;
create policy usage_member_read
  on public.usage_counters for select
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = usage_counters.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

grant usage on schema public to anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_counters to authenticated;
