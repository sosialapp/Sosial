-- p88_remote_delete: deleting a post in Sosial really deletes it on the network.
--
-- Any posts delete (web UI, mobile, admin) snapshots its sent/queued targets
-- that carry a remote_id, then enqueues one delete_post_target job per target
-- BEFORE the row cascade wipes them. The worker calls the platform's delete
-- endpoint per provider; already-deleted remotes count as success.
--
-- Idempotent by (post_target_id): a retried transaction or double delete can
-- never double-hit the platform (job_queue idempotency_key conflict skips).
--
-- Channels whose tokens were already revoked can't delete remotely; the job
-- fails loudly to the dead-letter so the reason is visible, the post row is
-- still gone (deleting locally always works).

create or replace function public.enqueue_remote_deletes_on_post_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass('pg_temp._post_targets_snapshot') is null then
    create temp table _post_targets_snapshot (
      post_target_id uuid not null
    ) on commit drop;
  end if;
  insert into _post_targets_snapshot (post_target_id)
  select id from public.post_targets
  where post_id = old.id and remote_id is not null and remote_id <> '';
  return old;
end;
$$;

create or replace function public.enqueue_remote_deletes_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass('pg_temp._post_targets_snapshot') is null then
    return null;
  end if;
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select 'delete_post_target',
         jsonb_build_object('post_target_id', s.post_target_id),
         now(),
         'delete_post_target:' || s.post_target_id::text
  from pg_temp._post_targets_snapshot s
  on conflict (idempotency_key) do nothing;
  delete from pg_temp._post_targets_snapshot;
  return null;
end;
$$;

drop trigger if exists trg_posts_remote_del_snapshot on public.posts;
create trigger trg_posts_remote_del_snapshot
  before delete on public.posts
  for each row
  execute function public.enqueue_remote_deletes_on_post_delete();

drop trigger if exists trg_posts_remote_del_enqueue on public.posts;
create trigger trg_posts_remote_del_enqueue
  after delete on public.posts
  for each row
  execute function public.enqueue_remote_deletes_after();

-- Comment scan: hourly, one scan_comments job per run; the worker fan-outs
-- per target internally. enqueue_daily_snapshots() is the pattern to mirror.
create or replace function public.enqueue_comment_scan()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'scan_comments',
    '{}'::jsonb,
    now(),
    'scan_comments:' || to_char(now(), 'YYYY-MM-DD-HH24')
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

-- Bell notifications for platform comments: every workspace member gets one
-- per new comment (single workspace, the community inbox is shared).
create or replace function public.notify_on_platform_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  for m in
    select user_id from public.workspace_members
    where workspace_id = new.workspace_id and status = 'active'
  loop
    insert into public.notifications
      (workspace_id, user_id, kind, title, body, href)
    values
      (new.workspace_id, m.user_id, 'comment',
       coalesce('New comment from ' || nullif(new.author, ''), 'New comment'),
       left(new.message, 200),
       '/community');
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_platform_comment_notify on public.platform_comments;
create trigger trg_platform_comment_notify
  after insert on public.platform_comments
  for each row
  execute function public.notify_on_platform_comment();

-- Widen the queue's kind check for the two new kinds (keeps sync_inbox).
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check check (
  kind in (
    'publish_target','refresh_token','snapshot_analytics','cleanup_media',
    'send_invite','sync_avatars','send_push','reply_comment','sync_inbox',
    'delete_post_target','scan_comments'
  )
);

-- Hourly comment scan (worker picks the job up on its normal loop).
select cron.schedule(
  'sosial-enqueue-comment-scan',
  '15 * * * *',
  $$ select public.enqueue_comment_scan() $$
)
where not exists (
  select 1 from cron.job where jobname = 'sosial-enqueue-comment-scan'
);
