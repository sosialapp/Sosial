-- p108 -- the token watchdog now covers Threads.
--
-- Threads is the one provider whose connect flow cannot extend its own
-- credential. oauth-exchange hands back a 60-day long-lived token and stores
-- no expires_in, so nothing renews it and it simply dies two months after the
-- user connected. p18's watchdog never looked at Threads (its provider list
-- predates it) and its window is an hour, which suits Google/X's hourly
-- access tokens but is far too tight for a token that lives 60 days -- one
-- hour of downtime before expiry would take the channel down for good.
--
-- So Threads is selected on its own rule: a 15-day runway, and a NULL
-- expires_at counts as due. NULL is exactly what a freshly connected Threads
-- channel has, and it is also the truthful "we do not know when this one
-- dies": the first pass rotates it and stamps a real expiry. The worker's own
-- window is deliberately a day wider (16 days, apps/worker/src/threads.ts),
-- so anything this cron calls due is due there too.
--
-- Every other provider keeps the p18 behaviour byte for byte. The cron
-- schedule itself is untouched: p18 already runs this function every 15
-- minutes, and the per-channel-per-hour idempotency key still caps the work.

create or replace function public.enqueue_expiring_tokens()
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
    and (
      -- p18: short-lived access tokens.
      (
        cc.provider in ('tiktok', 'x', 'linkedin', 'pinterest', 'youtube', 'bluesky')
        and ct.expires_at is not null
        and ct.expires_at <= now() + interval '60 minutes'
      )
      -- Threads: 60-day tokens, 15-day runway, unknown expiry counts as due.
      or (
        cc.provider = 'threads'
        and (ct.expires_at is null or ct.expires_at <= now() + interval '15 days')
      )
    )
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- p79 revoked execute from public; keep that intact across the replace.
revoke execute on function public.enqueue_expiring_tokens() from public;
grant execute on function public.enqueue_expiring_tokens() to service_role;