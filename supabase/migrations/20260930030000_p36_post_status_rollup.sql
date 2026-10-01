-- P36 · Roll up target completion to posts.status
--
-- Until now mark_target_sent/mark_target_failed only touched post_targets,
-- so published posts stayed 'queued' in every queue UI on every channel.
-- The rollup runs inside both RPCs (the single funnel every publisher —
-- all 10 existing channels plus Telegram — already calls), and only for
-- posts already in the publishing lifecycle: drafts and approvals are
-- never touched.

create or replace function rollup_post_status(p_post_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  cur text;
  total int;
  active int;
  sent int;
  failed int;
begin
  select status into cur from posts where id = p_post_id;
  if cur is null or cur not in ('queued', 'publishing', 'sent', 'partial', 'failed') then
    return;
  end if;
  select count(*),
         count(*) filter (where status in ('queued', 'publishing', 'pending', 'needs_approval')),
         count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'failed')
    into total, active, sent, failed
    from post_targets where post_id = p_post_id;
  -- Nothing to judge, or still working — leave the post alone.
  if total = 0 or active > 0 then
    return;
  end if;
  if failed = 0 then
    update posts set status = 'sent', sent_at = coalesce(sent_at, now()), updated_at = now()
      where id = p_post_id;
  elsif sent = 0 then
    update posts set status = 'failed', updated_at = now() where id = p_post_id;
  else
    update posts set status = 'partial', updated_at = now() where id = p_post_id;
  end if;
end $$;

create or replace function mark_target_sent(target_id uuid, remote_id text, remote_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  post uuid;
begin
  update post_targets
  set status = 'sent', remote_id = mark_target_sent.remote_id,
      remote_url = mark_target_sent.remote_url,
      sent_at = now(), attempts = attempts + 1, last_error = null,
      updated_at = now()
  where id = target_id
  returning post_id into post;
  if post is not null then
    perform rollup_post_status(post);
  end if;
end $$;

create or replace function mark_target_failed(target_id uuid, err text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  post uuid;
begin
  update post_targets
  set status = 'failed', last_error = err,
      attempts = attempts + 1, updated_at = now()
  where id = target_id
  returning post_id into post;
  if post is not null then
    perform rollup_post_status(post);
  end if;
end $$;

revoke all on function rollup_post_status(uuid) from public, anon, authenticated;
grant execute on function rollup_post_status(uuid) to service_role;

-- Backfill: settle every post stuck in the queue whose targets are all done.
select rollup_post_status(id) from posts where status in ('queued', 'publishing');
