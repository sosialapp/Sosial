-- p122 — Fix p121: connected_channels.provider is the provider_key enum, so
-- analytics_interval_minutes(text, boolean) never matched and both the
-- 15-minute schedule and the analytics screens' refresh failed with
-- "function analytics_interval_minutes(provider_key, boolean) does not exist".
-- Same functions, provider cast to text.

create or replace function public.enqueue_analytics_refresh()
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  m bigint := floor(extract(epoch from now()) / 60);
  n integer := 0;
  k integer := 0;
begin
  -- Full snapshot for channels whose window starts in this 15-minute slot.
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'snapshot:full:' || cc.id::text || ':' || (m / i.full_iv)::text
  from connected_channels cc
  cross join lateral (select analytics_interval_minutes(cc.provider::text, true) as full_iv) i
  where cc.status = 'connected'
    and m % i.full_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;

  -- Followers only for the rest (the full snapshot reads followers too).
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'followers_only', true),
         now(),
         'snapshot:followers:' || cc.id::text || ':' || (m / i.f_iv)::text
  from connected_channels cc
  cross join lateral (
    select analytics_interval_minutes(cc.provider::text, true) as full_iv,
           analytics_interval_minutes(cc.provider::text, false) as f_iv
  ) i
  where cc.status = 'connected'
    and m % i.full_iv >= 15
    and m % i.f_iv < 15
  on conflict (idempotency_key) do nothing;
  get diagnostics k = row_count;
  return n + k;
end $$;

revoke all on function public.enqueue_analytics_refresh() from public, anon, authenticated;
grant execute on function public.enqueue_analytics_refresh() to service_role;

-- Opening or pulling to refresh the analytics screen: followers now (deduped
-- per minute) and the full snapshot in the provider's current window, keyed
-- like the schedule so the two never both run inside one window.
create or replace function public.request_analytics_refresh(p_workspace uuid)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  m bigint := floor(extract(epoch from now()) / 60);
  n integer := 0;
begin
  if p_workspace is null or not is_workspace_member(p_workspace) then
    raise exception 'not_a_member';
  end if;

  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'followers_only', true, 'on_demand', true),
         now(),
         'snapshot:followers:od:' || cc.id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;

  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'snapshot_analytics',
         jsonb_build_object('channel_id', cc.id, 'on_demand', true),
         now(),
         'snapshot:full:' || cc.id::text || ':' || (m / analytics_interval_minutes(cc.provider::text, true))::text
  from connected_channels cc
  where cc.workspace_id = p_workspace
    and cc.status = 'connected'
  on conflict (idempotency_key) do nothing;

  return n;
end $$;

revoke all on function public.request_analytics_refresh(uuid) from public, anon;
grant execute on function public.request_analytics_refresh(uuid) to authenticated, service_role;
