-- P60 · Publish notifications, batched per post with handles
--
-- The bell showed one 🚀 row per channel ("Published to X", "Published to
-- Instagram"…) with curly-quoted titles. This rewrites the target-status
-- trigger to keep ONE notification per (user, post): every channel that lands
-- appends its label to the title, so the reader sees
--   "Published to X @acme, Instagram @acme"
-- with the post text as a plain "… is live." body. The web bell reads
-- post_id to render the channel avatar/logo row and the first media thumb.

alter table public.notifications
  add column if not exists post_id uuid references public.posts (id) on delete cascade;

create index if not exists notifications_post_idx on public.notifications (post_id);

create or replace function public.notif_provider_label(p text)
returns text
language sql
immutable
as $$
  select case p
    when 'x' then 'X'
    when 'instagram' then 'Instagram'
    when 'threads' then 'Threads'
    when 'bluesky' then 'Bluesky'
    when 'facebook' then 'Facebook'
    when 'tiktok' then 'TikTok'
    when 'youtube' then 'YouTube'
    when 'linkedin' then 'LinkedIn'
    when 'pinterest' then 'Pinterest'
    when 'mastodon' then 'Mastodon'
    when 'telegram' then 'Telegram'
    when 'discord' then 'Discord'
    when 'wordpress' then 'WordPress'
    when 'devto' then 'DEV'
    when 'hashnode' then 'Hashnode'
    when 'ghost' then 'Ghost'
    when 'vk' then 'VK'
    when 'gmb' then 'Google Business'
    else initcap(p)
  end;
$$;

create or replace function public.notif_on_target_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid := new.workspace_id;
  v_by uuid;
  v_title text;
  v_label text;
  v_existing uuid;
  v_new_title text;
begin
  if new.status not in ('sent', 'failed') or new.status is not distinct from old.status then
    return null;
  end if;
  select created_by into v_by from public.posts where id = new.post_id;
  if v_by is null then return null; end if;
  select coalesce(nullif(title, ''), left(body, 60)) into v_title from public.posts where id = new.post_id;

  -- "X @handle" — handle from the channel row, blank when unset.
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