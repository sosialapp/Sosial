-- P78 · Publish safety: no silently-stuck targets, no duplicate posts.
--
-- Two defects seen live (target 8ef0cd4a… re-published a 2-segment Threads
-- thread ~10×, then sat 'queued' forever):
--
-- 1) job_queue.idempotency_key is unique and enqueue_due_posts() inserts with
--    `on conflict do nothing`. Once a publish job reached 'dead' its row kept
--    that key for good, so every later enqueue — including the retry button —
--    was silently dropped and the target never published again.
-- 2) complete_job() flipped a job to 'dead' without touching its target, so a
--    job that died before the try-block (bundle/Gate-B errors) left the target
--    'queued' with nothing to drive it.
--
-- Fixes: dead/failed jobs are re-queued (bounded by requeue_count) so retries
-- work again; a dying publish job terminalises its target (sent if a remote id
-- exists, else failed so the user sees it and can retry); the bundle exposes
-- the stored remote id so a retry completes an already-published target
-- instead of posting it a second time; mark_target_progress() lets adapters
-- persist the remote id the moment it exists, shrinking the duplicate window.

-- ---------------------------------------------------------------- schema ---
alter table public.job_queue
  add column if not exists requeue_count integer not null default 0;

-- ------------------------------------------------------- terminal state ---
-- Finish a job: ok=true → done; attempts exhausted → dead (and a publish
-- target is terminalised so it is never left silently queued); else requeue
-- with exponential backoff (2^attempts minutes, capped at 2^6).
create or replace function public.complete_job(job_id bigint, ok boolean, err text default null)
returns void
language plpgsql security definer set search_path = public as $$
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
      run_at = now() + (power(2, least(a, 6))::text || ' minutes')::interval,
      updated_at = now()
  where id = job_id;
end $$;

-- ------------------------------------------------------------- enqueue ----
-- Minutely enqueue: due queued targets become publish_target jobs.
-- A dead/failed job row is re-queued (up to 3 times) so the retry button and
-- post-death recovery work; after that it stays terminal and the worker's
-- complete_job has already terminalised the target.
create or replace function public.enqueue_due_posts()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'publish_target',
         jsonb_build_object('post_target_id', pt.id),
         now(),
         'publish_target:' || pt.id::text
  from post_targets pt
  join posts p on p.id = pt.post_id
  where pt.status = 'queued'
    and (pt.scheduled_at is null or pt.scheduled_at <= now())
    and (p.scheduled_at is null or p.scheduled_at <= now())
    -- draft/approval/failed posts never auto-fire; sent/partial allow retries
    and p.status in ('queued', 'publishing', 'partial', 'sent')
  on conflict (idempotency_key) do update
    set status = 'queued',
        attempts = 0,
        requeue_count = job_queue.requeue_count + 1,
        run_at = now(),
        last_error = null,
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where job_queue.status in ('dead', 'failed')
      and job_queue.requeue_count < 3;
  get diagnostics n = row_count;
  return n;
end $$;

-- ------------------------------------------------------------ progress ----
-- Record the created remote object without settling the target. Adapters call
-- this the moment a post exists so a retry can complete instead of re-post.
create or replace function public.mark_target_progress(target_id uuid, remote_id text, remote_url text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update post_targets
  set remote_id = mark_target_progress.remote_id,
      remote_url = coalesce(nullif(mark_target_progress.remote_url, ''), remote_url),
      updated_at = now()
  where id = target_id
    and status in ('queued', 'publishing')
    and coalesce(remote_id, '') = '';
end $$;

-- --------------------------------------------------------------- bundle ---
-- Same bundle, now exposing the stored remote id so the worker can settle a
-- target that published on a prior attempt.
create or replace function get_publish_bundle(target_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  out jsonb;
begin
  select jsonb_build_object(
    'target', jsonb_build_object(
      'id', pt.id, 'provider', pt.provider, 'caption', pt.caption,
      'options', pt.options, 'idempotency_key', pt.idempotency_key,
      'status', pt.status, 'remote_id', pt.remote_id, 'remote_url', pt.remote_url
    ),
    'post', jsonb_build_object(
      'id', p.id, 'title', p.title, 'body', p.body, 'workspace_id', p.workspace_id
    ),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'storage_path', ma.storage_path, 'kind', ma.kind,
          'mime_type', ma.mime_type, 'position', pm.position
        )
        order by pm.position
      )
      from post_media pm
      join media_assets ma on ma.id = pm.media_id
      where pm.post_id = p.id
    ), '[]'::jsonb),
    'channel', jsonb_build_object(
      'id', cc.id, 'provider', cc.provider, 'external_id', cc.external_id,
      'instance_url', cc.instance_url, 'metadata', cc.metadata
    ),
    'secrets', jsonb_build_object(
      'access_secret_id', ct.access_token_secret_id,
      'refresh_secret_id', ct.refresh_token_secret_id,
      'expires_at', ct.expires_at
    )
  )
  into out
  from post_targets pt
  join posts p on p.id = pt.post_id
  join connected_channels cc on cc.id = pt.channel_id
  left join channel_tokens ct on ct.channel_id = cc.id
  where pt.id = target_id;
  return out;
end $$;

-- ---------------------------------------------------------------- repair ---
-- Clear the backlog of targets the old logic left behind, once.
do $$
declare
  pids uuid[];
  pid uuid;
begin
  -- Published but never recorded as sent.
  select array_agg(distinct pt.post_id) into pids
  from post_targets pt
  where pt.status in ('queued', 'publishing') and coalesce(pt.remote_id, '') <> '';
  if pids is not null then
    update post_targets
    set status = 'sent', sent_at = coalesce(sent_at, now()), last_error = null, updated_at = now()
    where post_id = any(pids) and status in ('queued', 'publishing') and coalesce(remote_id, '') <> '';
    foreach pid in array pids loop
      perform rollup_post_status(pid);
    end loop;
  end if;

  -- Dead publish job with nothing published: surface it as failed.
  pids := null;
  select array_agg(distinct pt.post_id) into pids
  from post_targets pt
  where pt.status = 'queued' and coalesce(pt.remote_id, '') = ''
    and exists (
      select 1 from job_queue j
      where j.idempotency_key = 'publish_target:' || pt.id::text and j.status = 'dead'
    );
  if pids is not null then
    update post_targets pt
    set status = 'failed',
        last_error = coalesce(pt.last_error, 'publish job ran out of attempts'),
        updated_at = now()
    where pt.post_id = any(pids) and pt.status = 'queued' and coalesce(pt.remote_id, '') = ''
      and exists (
        select 1 from job_queue j
        where j.idempotency_key = 'publish_target:' || pt.id::text and j.status = 'dead'
      );
    foreach pid in array pids loop
      perform rollup_post_status(pid);
    end loop;
  end if;
end $$;

-- --------------------------------------------------------------- grants ---
-- (Queue RPC privileges are tightened in p79.)
revoke all on function public.mark_target_progress(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mark_target_progress(uuid, text, text) to service_role;
