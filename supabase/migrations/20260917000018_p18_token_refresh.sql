-- P18 · Proactive token refresh: enqueue refresh_token jobs for channels
-- whose access token expires within the hour.
--
-- The worker's per-provider ensureToken helpers only rotate inside their
-- 10-minute freshness window, so this runs every 15 minutes: any channel
-- selected here is guaranteed to get a rotation pass before expiry, and
-- already-fresh channels complete as cheap no-ops. Idempotency is one job
-- per channel per hour — re-running the schedule never double-enqueues.
-- Chords with auth-dead refresh secrets are marked 'expired' by the worker
-- (UI prompts a reconnect); publish-time lazy refresh is unchanged.

create or replace function enqueue_expiring_tokens()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'refresh_token',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'refresh_token:' || cc.id::text || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
  from connected_channels cc
  join channel_tokens ct on ct.channel_id = cc.id
  where cc.status = 'connected'
    and cc.provider in ('tiktok', 'x', 'linkedin', 'pinterest', 'youtube', 'bluesky')
    and ct.expires_at is not null
    and ct.expires_at <= now() + interval '60 minutes'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

select cron.schedule('sosial-enqueue-tokens', '*/15 * * * *', 'select public.enqueue_expiring_tokens()');
