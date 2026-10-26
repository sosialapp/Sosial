-- P106 · Bound the queue's history tables.
--
-- `job_queue` keeps every job forever; the worker only ever claims
-- status = 'queued' (claim_job), so terminal rows ('done', 'dead') are pure
-- history past the point anyone would look at them. `cron.job_run_details` is
-- pg_cron's own per-run log and grows with every tick of every job (the
-- minutely sweeps alone are ~1.5k rows/day); pg_cron never trims it. Both are
-- pruned here so storage does not creep on a small box.

create or replace function prune_job_history(
  p_job_days integer default 30,
  p_cron_days integer default 7
)
returns void
language plpgsql
security definer
set search_path = public, cron as $$
begin
  -- Terminal states only: a job waiting to retry is 'queued' and must survive.
  delete from public.job_queue
  where status in ('done', 'dead')
    and updated_at < now() - make_interval(days => greatest(p_job_days, 1));

  -- pg_cron's run log; safe to trim, the schedules live in cron.job.
  delete from cron.job_run_details
  where end_time < now() - make_interval(days => greatest(p_cron_days, 1));
end $$;

-- Superuser-owned (SECURITY DEFINER) so the cron call can prune pg_cron's log
-- whichever role runs the job; nobody else needs to execute it.
revoke all on function prune_job_history(integer, integer) from public, anon, authenticated;
grant execute on function prune_job_history(integer, integer) to service_role;

-- Daily, clear of the 03:xx...03:4x sweeps.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sosial-prune-job-history') then
    perform cron.schedule(
      'sosial-prune-job-history',
      '25 3 * * *',
      $job$ select prune_job_history(); $job$
    );
  end if;
end $$;