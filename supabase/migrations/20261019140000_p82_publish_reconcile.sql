-- P82 · Publish reconciliation + snappier enqueue.
--
-- Live defects this closes:
--
-- 1) Posts with NO targets sat 'queued' forever. A failed media upload during
--    create leaves the post row inserted but its targets never written, so
--    enqueue_due_posts (which joins post_targets) never sees them and
--    rollup_post_status bails early on total = 0. They cluttered the Queue tab
--    as permanently-publishing ghosts. → sweep_publish_state() fails a past-due
--    queued/publishing post that has no targets at all.
--
-- 2) A worker that dies mid-job left its job 'running' with locked_at forever
--    (claim_job never reclaims, complete_job never runs): the target stayed
--    queued with a locked job no replica could take. → reclaim_stale_jobs()
--    requeues running jobs whose lock is older than the grace window, or kills
--    the exhausted ones so complete_job's terminalisation logic can run.
--
-- 3) A settled-but-unrolled post (all its targets terminal) could stay mid-flight
--    because the rollup only ran inside mark_target_*. → the sweep re-runs
--    rollup_post_status() for every queued/publishing post each minute.
--
-- 4) Publish latency: the enqueue cron ran every 60s and the worker idled up to
--    60s, so a "Post now" could wait ~2 minutes before the first API call. The
--    trigger below enqueues the job the moment a target becomes queued (with
--    run_at = its due time), and infra/docker-compose.services.yml lowers the
--    worker's idle ceiling, so publish starts within seconds.

-- --------------------------------------------- reclaim worker-dead jobs ---
-- A job is 'running' only while a worker holds its lock. If the lock is older
-- than the grace window the worker is gone; nothing else can ever clear it.
create or replace function public.reclaim_stale_jobs(p_older_than interval default '15 minutes')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  m integer := 0;
begin
  -- Exhausted: give up (complete_job already terminalised its publish target
  -- when it went dead; this is the crash-before-complete path).
  update job_queue
  set status = 'dead',
      last_error = coalesce(last_error, 'worker vanished mid-job'),
      locked_at = null, locked_by = null, updated_at = now()
  where status = 'running'
    and locked_at is not null
    and locked_at < now() - p_older_than
    and attempts >= max_attempts;
  get diagnostics n = row_count;

  -- Everything else: put it back so a live worker picks it up again.
  update job_queue
  set status = 'queued', run_at = now(),
      locked_at = null, locked_by = null, updated_at = now()
  where status = 'running'
    and locked_at is not null
    and locked_at < now() - p_older_than;
  get diagnostics m = row_count;

  return n + m;
end $$;

-- ------------------------------------------- reconcile stuck publish state ---
create or replace function public.sweep_publish_state()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  pid uuid;
begin
  -- 1) Present, past-date posts that can never publish (zero targets).
  update posts
  set status = 'failed', updated_at = now()
  where status in ('queued', 'publishing')
    and scheduled_at is not null
    and scheduled_at <= now() - interval '1 minute'
    and not exists (select 1 from post_targets pt where pt.post_id = posts.id);
  get diagnostics n = row_count;

  -- 2) Targets the worker claimed but never settled (crashed after the lock,
  --    before mark_target_*): no live job and stale. Sent if a remote id
  --    landed, else failed so the user sees it and can retry.
  update post_targets pt
  set status = case when coalesce(pt.remote_id, '') <> '' then 'sent' else 'failed' end,
      sent_at = case when coalesce(pt.remote_id, '') <> '' then coalesce(pt.sent_at, now()) else pt.sent_at end,
      last_error = case when coalesce(pt.remote_id, '') = ''
                        then coalesce(pt.last_error, 'publish stalled, no worker settled it')
                        else null end,
      updated_at = now()
  where pt.status = 'publishing'
    and pt.updated_at < now() - interval '10 minutes'
    and not exists (
      select 1 from job_queue j
      where j.idempotency_key = 'publish_target:' || pt.id::text
        and j.status in ('queued', 'running')
    );

  -- 3) Roll the target outcome up to any post still mid-flight.
  for pid in select id from posts where status in ('queued', 'publishing') loop
    perform rollup_post_status(pid);
  end loop;

  return n;
end $$;

-- --------------------------------------- instant enqueue on queue action ---
-- The minutely cron is a safety net; waiting up to a minute for the first
-- publish of a "Post now" (or for the scheduled instant) is the latency users
-- actually feel. A target that becomes 'queued' gets its job written in the
-- same transaction, with run_at = its due time (now for "post now"), so the
-- fast worker poll picks it up within seconds. Future-dated targets get a job
-- with a future run_at, so scheduled posts also fire on time, not up to a
-- minute late.
create or replace function public.enqueue_target_job()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'queued' and coalesce(new.remote_id, '') = '' then
    insert into job_queue (kind, payload, run_at, idempotency_key)
    values (
      'publish_target',
      jsonb_build_object('post_target_id', new.id),
      greatest(now(), coalesce(new.scheduled_at, now())),
      'publish_target:' || new.id::text
    )
    on conflict (idempotency_key) do update
      set status = 'queued',
          attempts = 0,
          run_at = greatest(now(), coalesce(new.scheduled_at, now())),
          last_error = null,
          locked_at = null,
          locked_by = null,
          updated_at = now()
      where job_queue.status in ('queued', 'running', 'dead', 'failed');
  end if;
  return null;
end $$;

drop trigger if exists trg_post_targets_enqueue on post_targets;
create trigger trg_post_targets_enqueue
  after insert or update of status, scheduled_at on post_targets
  for each row execute function public.enqueue_target_job();

-- ------------------------------------------------------------ scheduling ---
-- pg_cron inserts a new row per schedule() call (it does not upsert by name),
-- so drop any existing job with these names first to stay re-run safe.
do $$
declare
  j bigint;
  names text[] := array['sosial-enqueue-due', 'sosial-publish-sweep', 'sosial-reclaim-jobs'];
begin
  for j in select jobid from cron.job where jobname = any(names) loop
    perform cron.unschedule(j);
  end loop;
end $$;

-- Safety-net enqueue (the trigger above does the real-time work), plus the
-- stuck-state reconciliation + worker-dead job reclaim, once a minute.
select cron.schedule('sosial-enqueue-due', '* * * * *', 'select public.enqueue_due_posts()');
select cron.schedule('sosial-publish-sweep', '* * * * *', 'select public.sweep_publish_state()');
select cron.schedule('sosial-reclaim-jobs', '* * * * *', 'select public.reclaim_stale_jobs()');

-- ----------------------------------------------------------------- grants ---
revoke all on function public.reclaim_stale_jobs(interval) from public, anon, authenticated;
revoke all on function public.sweep_publish_state() from public, anon, authenticated;
grant execute on function public.reclaim_stale_jobs(interval) to service_role;
grant execute on function public.sweep_publish_state() to service_role;

-- --------------------------------------------------------------- backfill ---
-- Run once now so the existing backlog clears without waiting for cron.
select public.reclaim_stale_jobs();
select public.sweep_publish_state();
