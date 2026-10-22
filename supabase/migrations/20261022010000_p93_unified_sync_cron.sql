-- p93 — Unified sync engine: queue kinds, cron, enqueue RPCs
--
-- Replaces the retired scan pipeline (p92 tore down scan_comments + its cron
-- and enqueuers). Four new job kinds driven by src/sync.ts:
--   sync_inbox / sync_comments — cron every 5 min, per connected Phase-1
--     channel (facebook, instagram, mastodon, x, bluesky), minute-granular
--     idempotency so a hammering cron can't stack duplicates.
--   send_message / reply_comment — user actions, enqueued by edge functions.
-- Plus on-demand sweeps for the refresh buttons (per-workspace-per-minute,
-- so a whole team of refreshers still dedupes to one sweep).

-- ------------------------------------------------------- queue kind check ---
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check check (
  kind in (
    'publish_target','refresh_token','snapshot_analytics','cleanup_media',
    'send_invite','sync_avatars','send_push','delete_post_target',
    'sync_inbox','sync_comments','send_message','reply_comment'
  )
);

-- ---------------------------------------------------------- enqueue fns ---
create or replace function public.enqueue_unified_sync()
returns void
language plpgsql
security definer
set search_path = public as $$
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
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.enqueue_unified_sync_on_demand(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
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
  on conflict (idempotency_key) do nothing;
end;
$$;

-- send_message(payload): { channel_id, conversation_id, text }
create or replace function public.enqueue_send_message(
  p_channel uuid,
  p_conversation uuid,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if p_text is null or length(btrim(p_text)) = 0 or length(btrim(p_text)) > 2000 then
    raise exception 'invalid_message';
  end if;
  insert into public.job_queue (kind, payload, run_at)
  values (
    'send_message',
    jsonb_build_object(
      'channel_id', p_channel,
      'conversation_id', p_conversation,
      'text', btrim(p_text)
    ),
    now()
  );
end;
$$;

-- reply_comment(payload): { channel_id, comment_id, text }
create or replace function public.enqueue_reply_comment(
  p_channel uuid,
  p_comment uuid,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if p_text is null or length(btrim(p_text)) = 0 or length(btrim(p_text)) > 2000 then
    raise exception 'invalid_message';
  end if;
  insert into public.job_queue (kind, payload, run_at)
  values (
    'reply_comment',
    jsonb_build_object(
      'channel_id', p_channel,
      'comment_id', p_comment,
      'text', btrim(p_text)
    ),
    now()
  );
end;
$$;

revoke all on function
  public.enqueue_unified_sync(),
  public.enqueue_unified_sync_on_demand(uuid),
  public.enqueue_send_message(uuid, uuid, text),
  public.enqueue_reply_comment(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function
  public.enqueue_unified_sync(),
  public.enqueue_unified_sync_on_demand(uuid),
  public.enqueue_send_message(uuid, uuid, text),
  public.enqueue_reply_comment(uuid, uuid, text)
to service_role;

-- ---------------------------------------------------------------- cron ---
select cron.schedule(
  'sosial-enqueue-unified-sync',
  '*/5 * * * *',
  $$ select public.enqueue_unified_sync() $$
)
where not exists (
  select 1 from cron.job where jobname = 'sosial-enqueue-unified-sync'
);
