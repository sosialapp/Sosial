-- P99 — Threads joins the unified comment sweep.
--
-- Threads has no messaging API, so it must be enqueued for sync_comments
-- only. The provider list becomes per job kind instead of one flat list, so
-- comments-only platforms never queue a sync_inbox job that can only fail.

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
    and (
      (k.kind = 'sync_comments' and c.provider in ('facebook','instagram','mastodon','x','bluesky','threads'))
      or (k.kind = 'sync_inbox' and c.provider in ('facebook','instagram','mastodon','x','bluesky'))
    )
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
    and (
      (k.kind = 'sync_comments' and c.provider in ('facebook','instagram','mastodon','x','bluesky','threads'))
      or (k.kind = 'sync_inbox' and c.provider in ('facebook','instagram','mastodon','x','bluesky'))
    )
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

revoke all on function
  public.enqueue_unified_sync(),
  public.enqueue_unified_sync_on_demand(uuid)
from public, anon, authenticated;
grant execute on function
  public.enqueue_unified_sync(),
  public.enqueue_unified_sync_on_demand(uuid)
to service_role;
