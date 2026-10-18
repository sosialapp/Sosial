-- P76 · Fix notif_on_target_status() workspace lookup (regression from P60)
--
-- P48 created notif_on_target_status() reading new.workspace_id, but
-- post_targets carries no workspace_id column (rows join via posts). P53
-- repaired it by resolving the workspace through the parent post; P60 then
-- rewrote the same trigger for batched publish notifications and
-- reintroduced the read of new.workspace_id.
--
-- The 42703 raised inside the function rolled back every mark_target_sent /
-- mark_target_failed RPC: the channel post actually published, but the target
-- never flipped off 'queued', the publish_target job retried to its attempt
-- cap (re-publishing each time) and then died, and the post sat in the queue
-- forever. This restores P60's behaviour (one notification per user+post,
-- provider labels, post_id for the bell) with the workspace resolved from
-- posts.

create or replace function public.notif_on_target_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_by uuid;
  v_title text;
  v_label text;
  v_existing uuid;
begin
  if new.status not in ('sent', 'failed') or new.status is not distinct from old.status then
    return null;
  end if;
  -- post_targets carries no workspace_id: resolve through the post.
  select workspace_id, created_by into v_ws, v_by from public.posts where id = new.post_id;
  if v_ws is null or v_by is null then return null; end if;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;

  -- "X @handle", handle from the channel row, blank when unset.
  select coalesce(
    nullif(public.notif_provider_label(new.provider::text), '')
      || case when coalesce(c.handle, '') <> '' then ' @' || ltrim(c.handle, '@') else '' end,
    new.provider::text)
  into v_label
  from public.connected_channels c
  where c.id = new.channel_id;

  if new.status = 'sent' then
    -- One notification per (user, post): append this channel to the title.
    select id into v_existing
    from public.notifications
    where workspace_id = v_ws and user_id = v_by
      and kind = 'target_sent' and post_id = new.post_id
    order by created_at desc
    limit 1;

    if v_existing is not null then
      update public.notifications
      set title = title || ', ' || coalesce(v_label, new.provider::text),
          read_at = null
      where id = v_existing;
    else
      insert into public.notifications (workspace_id, user_id, kind, post_id, title, body, href)
      values (
        v_ws, v_by, 'target_sent', new.post_id,
        'Published to ' || coalesce(v_label, new.provider::text),
        coalesce(v_title, 'Untitled') || ' is live.',
        '/post?filter=sent'
      );
    end if;
  else
    -- Failures stay per-channel: each carries its own retry error.
    insert into public.notifications (workspace_id, user_id, kind, post_id, title, body, href)
    values (
      v_ws, v_by, 'target_failed', new.post_id,
      'Could not publish to ' || coalesce(v_label, new.provider::text),
      coalesce(left(new.last_error, 200), 'Open the post to retry.'),
      '/post?filter=failed'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notif_target_status on public.post_targets;
create trigger notif_target_status
  after update of status on public.post_targets
  for each row
  when (new.status in ('sent', 'failed'))
  execute function public.notif_on_target_status();
