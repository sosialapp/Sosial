-- P38 · Channel inbox (Discord read/reply first)
--
-- channel_messages stores inbound platform messages per connected channel.
-- Discord polls it every 5 minutes (pg_cron → sync_inbox jobs → worker);
-- other providers plug the same table later. Replies stay normal posts:
-- the reply reference rides post_targets.options, so the existing queue,
-- scheduler, worker and retry system carry replies with zero new pipeline.

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel_id uuid not null references public.connected_channels (id) on delete cascade,
  provider text not null,
  external_id text not null,
  author_name text,
  author_handle text,
  body text not null default '',
  has_media boolean not null default false,
  external_created_at timestamptz,
  reply_to_external_id text,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (channel_id, external_id)
);
create index if not exists channel_messages_workspace_idx
  on public.channel_messages (workspace_id, created_at desc);

alter table public.channel_messages enable row level security;

drop policy if exists "inbox_member_read" on public.channel_messages;
create policy "inbox_member_read" on public.channel_messages
  for select to authenticated
  using (is_workspace_member(workspace_id));

-- sync_inbox job kind (one job per connected inbox channel per 5 minutes).
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in (
    'publish_target',
    'refresh_token',
    'snapshot_analytics',
    'cleanup_media',
    'send_invite',
    'sync_avatars',
    'send_push',
    'sync_inbox'
  ));

create or replace function enqueue_due_inbox()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
begin
  insert into job_queue (kind, payload, run_at, idempotency_key)
  select 'sync_inbox',
         jsonb_build_object('channel_id', cc.id),
         now(),
         'inbox:' || cc.id::text || ':' || floor(extract(epoch from now()) / 300)::text
  from connected_channels cc
  where cc.status = 'connected'
    and cc.provider = 'discord'
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
begin
  perform cron.schedule('sosial-enqueue-inbox', '*/5 * * * *', 'select public.enqueue_due_inbox()');
exception
  when duplicate_object then null;
end $$;
