-- p103: fire scheduled posts at their exact instant.
--
-- A scheduled target only reached the queue when sosial-enqueue-due ran (once
-- a minute) and then waited for the worker's next claim poll, so a 09:00 slot
-- could publish minutes late. The trigger below parks the job the moment a
-- target is queued, with run_at = its scheduled instant, so the worker picks
-- it up the second it is due. enqueue_due_posts stays as the safety net for
-- rows queued before this migration and for any missed trigger.

create or replace function public.sync_publish_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_key text;
  v_post_status text;
  v_post_at timestamptz;
  v_at timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from job_queue
    where idempotency_key = 'publish_target:' || old.id::text
      and status = 'queued';
    return old;
  end if;

  v_key := 'publish_target:' || new.id::text;

  -- Only a queued target belongs in the publish queue. Draft, approval and
  -- finished targets drop their pending job so a cancelled post never fires.
  if new.status <> 'queued' then
    delete from job_queue where idempotency_key = v_key and status = 'queued';
    return new;
  end if;

  select status, scheduled_at into v_post_status, v_post_at
  from posts where id = new.post_id;

  if v_post_status is null
     or v_post_status not in ('queued', 'publishing', 'partial', 'sent') then
    delete from job_queue where idempotency_key = v_key and status = 'queued';
    return new;
  end if;

  -- Target time wins, the post carries the earliest slot of the group.
  v_at := coalesce(new.scheduled_at, v_post_at, now());

  insert into job_queue (kind, payload, run_at, idempotency_key)
  values ('publish_target', jsonb_build_object('post_target_id', new.id), v_at, v_key)
  on conflict (idempotency_key) do update
    set run_at = excluded.run_at,
        -- A queued job only moves; a finished/failed one is a deliberate
        -- re-queue (retry button, publish now) and starts clean.
        status = case
          when job_queue.status in ('done', 'failed', 'dead') then 'queued'
          else job_queue.status
        end,
        attempts = case
          when job_queue.status in ('done', 'failed', 'dead') then 0
          else job_queue.attempts
        end,
        requeue_count = case
          when job_queue.status in ('done', 'failed', 'dead')
            then job_queue.requeue_count + 1
          else job_queue.requeue_count
        end,
        locked_at = case
          when job_queue.status in ('done', 'failed', 'dead') then null
          else job_queue.locked_at
        end,
        locked_by = case
          when job_queue.status in ('done', 'failed', 'dead') then null
          else job_queue.locked_by
        end,
        last_error = case
          when job_queue.status in ('done', 'failed', 'dead') then null
          else job_queue.last_error
        end,
        updated_at = now()
    where job_queue.status in ('queued', 'done', 'failed', 'dead');

  return new;
end $function$;

drop trigger if exists trg_post_targets_queue_job on post_targets;
create trigger trg_post_targets_queue_job
  after insert or update or delete on post_targets
  for each row execute function public.sync_publish_job();

revoke all on function public.sync_publish_job() from public, anon, authenticated;

-- Backfill: park the job for anything already queued for a future slot.
insert into job_queue (kind, payload, run_at, idempotency_key)
select 'publish_target',
       jsonb_build_object('post_target_id', pt.id),
       coalesce(pt.scheduled_at, p.scheduled_at, now()),
       'publish_target:' || pt.id::text
from post_targets pt
join posts p on p.id = pt.post_id
where pt.status = 'queued'
  and p.status in ('queued', 'publishing', 'partial', 'sent')
  and coalesce(pt.scheduled_at, p.scheduled_at) > now()
on conflict (idempotency_key) do nothing;
