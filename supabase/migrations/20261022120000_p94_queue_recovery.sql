-- p94: queue recovery after a worker restart / stuck provider call.
--
-- claim_job only ever looked at queued rows, so a job that was 'running'
-- when the worker died (or that hung on a provider call without a timeout)
-- stayed running forever: no retry, and every later sweep queued a fresh
-- copy of the same work. Rows older than the lease are now reclaimable.
--
-- complete_job's retry ladder was 2^n minutes up to 64 minutes, longer than
-- the 5 minute sync sweep, so a dead channel accumulated overlapping jobs.
-- Cap it at 8 minutes.

create or replace function public.claim_job(worker_id text)
returns job_queue
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec job_queue%rowtype;
begin
  select * into rec from job_queue
  where (status = 'queued' and run_at <= now())
     or (status = 'running' and locked_at < now() - interval '10 minutes')
  order by run_at, id
  for update skip locked
  limit 1;
  if rec.id is null then
    return null;
  end if;
  update job_queue
  set status = 'running', locked_at = now(), locked_by = worker_id,
      attempts = rec.attempts + 1, updated_at = now()
  where id = rec.id;
  rec.status := 'running';
  rec.attempts := rec.attempts + 1;
  rec.locked_at := now();
  rec.locked_by := worker_id;
  return rec;
end $function$;

create or replace function public.complete_job(job_id bigint, ok boolean, err text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a integer;
  m integer;
  k text;
  pt uuid;
  pid uuid;
  rid text;
  rurl text;
begin
  select attempts, max_attempts, kind,
         nullif(payload->>'post_target_id', '')::uuid
    into a, m, k, pt
  from job_queue
  where id = job_id;
  if not found then
    return;
  end if;

  if ok then
    update job_queue
    set status = 'done', last_error = null,
        locked_at = null, locked_by = null, updated_at = now()
    where id = job_id;
    return;
  end if;

  if a >= m then
    update job_queue
    set status = 'dead', last_error = err,
        locked_at = null, locked_by = null, updated_at = now()
    where id = job_id;

    if k = 'publish_target' and pt is not null then
      select remote_id, remote_url into rid, rurl
      from post_targets
      where id = pt and status in ('queued', 'publishing');
      if found then
        if coalesce(rid, '') <> '' then
          -- It did publish; record success rather than failing a live post.
          perform mark_target_sent(pt, rid, coalesce(rurl, ''));
        else
          update post_targets
          set status = 'failed',
              last_error = coalesce(err, 'publish job ran out of attempts'),
              updated_at = now()
          where id = pt and status in ('queued', 'publishing');
          select post_id into pid from post_targets where id = pt;
          if pid is not null then
            perform rollup_post_status(pid);
          end if;
        end if;
      end if;
    end if;
    return;
  end if;

  update job_queue
  set status = 'queued', last_error = err,
      locked_at = null, locked_by = null,
      run_at = now() + (power(2, least(a, 3))::text || ' minutes')::interval,
      updated_at = now()
  where id = job_id;
end $function$;

-- Free anything stuck running right now so the next poll picks it up.
update public.job_queue
set status = 'queued', locked_at = null, locked_by = null, updated_at = now()
where status = 'running' and locked_at < now() - interval '10 minutes';

-- One pending sync per channel instead of one per 5 minute sweep, and a
-- broken channel (missing permission, unpaid tier) stops being retried every
-- sweep: after a dead letter it waits an hour. Keeps the queue shallow so a
-- Sync press is served in seconds rather than behind a wall of retries.
create or replace function public.enqueue_unified_sync()
returns void
language plpgsql
security definer
set search_path to public as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select k.kind,
         jsonb_build_object('channel_id', c.id),
         now(),
         k.kind::text || ':' || c.id::text || ':' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  from public.connected_channels c
  cross join (values ('sync_inbox'), ('sync_comments')) as k(kind)
  where c.status = 'connected'
    and c.provider in ('facebook','instagram','mastodon','x','bluesky')
    and not exists (
      select 1 from public.job_queue j
      where j.kind = k.kind
        and j.payload->>'channel_id' = c.id::text
        and (
          j.status in ('queued','running')
          or (j.status = 'dead' and j.updated_at > now() - interval '1 hour')
        )
    )
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.enqueue_unified_sync_on_demand(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path to public as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select k.kind,
         jsonb_build_object('channel_id', c.id, 'on_demand', true, 'workspace_id', p_workspace),
         now(),
         k.kind::text || ':od:' || c.id::text || ':' || to_char(now(), 'YYYY-MM-DD-HH24-MI')
  from public.connected_channels c
  cross join (values ('sync_inbox'), ('sync_comments')) as k(kind)
  where c.workspace_id = p_workspace
    and c.status = 'connected'
    and c.provider in ('facebook','instagram','mastodon','x','bluesky')
    and not exists (
      select 1 from public.job_queue j
      where j.kind = k.kind
        and j.payload->>'channel_id' = c.id::text
        and (
          j.status in ('queued','running')
          or (j.status = 'dead' and j.updated_at > now() - interval '1 hour')
        )
    )
  on conflict (idempotency_key) do nothing;
end;
$$;

