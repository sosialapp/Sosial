-- P54 · Per-provider daily posting limits (anti-abuse)
--
-- Each social network enforces its own ceiling on how much a single account may
-- publish in a rolling 24-hour window. Going over gets the account throttled or
-- the app rate-limited, so we mirror those ceilings in the DB rather than
-- trusting every write path (web composer, mobile, MCP tools, reschedule RPCs,
-- the API route) to remember them.
--
-- Two gates:
--   Gate A — a BEFORE INSERT/UPDATE trigger on post_targets refuses to queue a
--            target once the channel has exhausted its window. This is the
--            friendly, upgrade-free "you're at the limit" the composer shows
--            (friendlyLimit() strips the POST_LIMIT: tag).
--   Gate B — the worker re-checks at publish time and DEFERS (not fails) a job
--            when the window is full, so a genuinely scheduled post is delayed
--            rather than lost. This is the true API-abuse guard.
--
-- The window is ROLLING 24 HOURS (Buffer parity), not a calendar day, so there
-- is no midnight cliff a burst could slip through.

-- ------------------------------------------------ limit configuration ---
-- Per provider, in posts per rolling 24 hours. Seeded from each network's
-- published guidance. Kept in its own table so it is tunable without a deploy.
create table if not exists public.provider_daily_limits (
  provider provider_key primary key,
  max_per_24h integer not null check (max_per_24h > 0)
);

insert into public.provider_daily_limits (provider, max_per_24h) values
  ('facebook',   35),
  ('instagram',  50),
  ('x',          50),   -- 50 unverified / 100 verified — no verified signal, stay safe
  ('linkedin',   50),
  ('pinterest',   5),   -- 5 unverified / 25 verified email
  ('tiktok',     25),
  ('gmb',        50),
  ('youtube',    10),   -- 10 unverified / unlimited verified
  ('mastodon',  100),
  ('threads',   250),
  ('bluesky',   100),
  ('telegram',  100),
  ('discord',   100),
  ('wordpress', 100),
  ('devto',     100),
  ('hashnode',  100),
  ('ghost',     100),
  ('vk',        100)
on conflict (provider) do update set max_per_24h = excluded.max_per_24h;

-- Fallback for any provider not listed above: a generous 100/24h.
create or replace function public.provider_daily_limit(p_provider provider_key)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max_per_24h from public.provider_daily_limits where provider = p_provider),
    100
  );
$$;

-- Cheap counts: how many of this channel's targets are occupying its window.
create index if not exists post_targets_channel_sent_idx
  on public.post_targets (channel_id, sent_at);
create index if not exists post_targets_channel_scheduled_idx
  on public.post_targets (channel_id, scheduled_at);

-- ------------------------------------------------------------- Gate A ---
-- A target inserted/updated into a queue-holding state is refused when the
-- channel has already sent the provider's maximum in the trailing 24 hours.
-- Drafts (pending on a draft post) and terminal states pass through untouched.
create or replace function public.enforce_daily_post_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_sent  integer;
begin
  -- Only live/queued targets occupy the window. Drafts and sent/failed rows
  -- are not a publish attempt.
  if new.status not in ('pending', 'needs_approval', 'queued') then
    return new;
  end if;

  v_limit := public.provider_daily_limit(new.provider);
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_sent
    from public.post_targets
    where channel_id = new.channel_id
      and status = 'sent'
      and sent_at >= now() - interval '24 hours'
      and id <> new.id;

  if v_sent >= v_limit then
    raise exception
      'POST_LIMIT: % allows % posts per 24 hours — this channel has reached that limit. It frees up as earlier posts age out of the window.',
      new.provider, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists post_targets_daily_limit on public.post_targets;
create trigger post_targets_daily_limit
  before insert or update on public.post_targets
  for each row execute function public.enforce_daily_post_limit();

-- ------------------------------------------------------------- Gate B ---
-- Does this channel still have room in its rolling 24h window? Returns the
-- remaining allowance (0 or negative = full).
create or replace function public.channel_daily_remaining(p_channel_id uuid, p_provider provider_key)
returns integer
language sql stable security definer set search_path = public as $$
  select public.provider_daily_limit(p_provider) - (
    select count(*)
    from public.post_targets
    where channel_id = p_channel_id
      and status = 'sent'
      and sent_at >= now() - interval '24 hours'
  );
$$;

-- When the window is full, the instant it next frees up = oldest in-window
-- send + 24h. NULL when nothing is in the window (caller may publish now).
create or replace function public.channel_daily_next_slot(p_channel_id uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(sent_at) + interval '24 hours'
  from public.post_targets
  where channel_id = p_channel_id
    and status = 'sent'
    and sent_at >= now() - interval '24 hours';
$$;

-- Return a running job to the queue at a chosen time WITHOUT burning an
-- attempt or applying exponential backoff — used by Gate B to wait out a full
-- daily window. distinct from complete_job's failure path.
create or replace function public.defer_job(p_job_id bigint, p_run_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.job_queue
  set status = 'queued',
      run_at = p_run_at,
      locked_at = null,
      locked_by = null,
      attempts = greatest(attempts - 1, 0),  -- claim_job incremented it; undo
      updated_at = now()
  where id = p_job_id and status = 'running';
end $$;

revoke all on function public.provider_daily_limit(provider_key) from public, anon;
revoke all on function public.channel_daily_remaining(uuid, provider_key) from public, anon;
revoke all on function public.channel_daily_next_slot(uuid) from public, anon;
revoke all on function public.defer_job(bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.provider_daily_limit(provider_key) to authenticated, service_role;
grant execute on function public.channel_daily_remaining(uuid, provider_key) to authenticated, service_role;
grant execute on function public.channel_daily_next_slot(uuid) to authenticated, service_role;
grant execute on function public.defer_job(bigint, timestamptz) to service_role;
