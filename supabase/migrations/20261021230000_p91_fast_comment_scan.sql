-- p91 — Faster comment scans + on-demand scan trigger
--
-- 1. enqueue_comment_scan(): the idempotency key was hour-granular
--    (scan_comments:YYYY-MM-DD-HH24), which dedupes to one scan per hour
--    no matter how often the cron fires. Minute granularity keeps the
--    same-run dedup while letting a */5 cron actually scan every 5 minutes.
-- 2. enqueue_comment_scan_on_demand(p_actor): a user-triggered scan (the
--    Community refresh button) with a per-actor-per-minute idempotency key,
--    so hammering the button cannot flood the queue (max 1 on-demand scan
--    per user per minute; the 5-minute cron covers everyone regardless).

create or replace function public.enqueue_comment_scan()
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'scan_comments',
    '{}'::jsonb,
    now(),
    'scan_comments:' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.enqueue_comment_scan_on_demand(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'scan_comments',
    jsonb_build_object('on_demand', true, 'actor', p_actor),
    now(),
    'scan_comments:od:' || p_actor::text || ':' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.enqueue_comment_scan() from public, anon, authenticated;
revoke all on function public.enqueue_comment_scan_on_demand(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_comment_scan() to service_role;
grant execute on function public.enqueue_comment_scan_on_demand(uuid) to service_role;
