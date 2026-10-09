-- P62 · Notify the workspace when a channel's auth dies.
--
-- The worker's refresh job already marks dead channels 'expired' with a
-- last_error — silently. The user finds out only when a publish fails. This
-- adds notify_channel_expired(workspace, channel, provider, reason), callable
-- by service_role (the worker), which inserts a bell notification for the
-- workspace owner + admins. Idempotent per (channel, day): the hourly refresh
-- cron re-discovers a dead channel every hour, and a dedupe window keeps the
-- bell from filling with 24 identical rows; a new failure day re-alerts.

create or replace function public.notify_channel_expired(
  p_workspace_id uuid,
  p_channel_id uuid,
  p_provider text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
begin
  -- One row per channel per day (UTC): re-alerts daily while dead, not hourly.
  if exists (
    select 1 from public.notifications
    where kind = 'channel_expired'
      and href = '/channels?expired=' || p_channel_id::text
      and created_at >= date_trunc('day', now())
  ) then
    return;
  end if;

  for v_admin_id in
    select user_id from public.notif_admins(p_workspace_id)
  loop
    insert into public.notifications (workspace_id, user_id, kind, title, body, href)
    values (
      p_workspace_id,
      v_admin_id,
      'channel_expired',
      (case p_provider
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
        else initcap(p_provider)
      end) || ' needs reconnecting',
      coalesce(nullif(p_reason, ''), 'The connection expired — scheduled posts to this channel will fail until you reconnect it.'),
      '/channels?expired=' || p_channel_id::text
    );
  end loop;
end;
$$;

revoke all on function public.notify_channel_expired(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.notify_channel_expired(uuid, uuid, text, text) to service_role;
