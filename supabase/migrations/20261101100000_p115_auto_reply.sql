-- p115: keyword auto-replies for comments and DMs.
--
-- The triggers below only enqueue one `auto_reply` job per new inbound row.
-- Matching + guardrails live in apps/worker/src/autoReply.ts (pure, unit
-- tested), and the actual send reuses the existing reply_comment /
-- send_message jobs so every provider adapter, token refresh and retry path
-- stays in one place.
--
-- Rules are workspace-owned; one auto-reply per inbound comment/message is
-- enforced by auto_reply_events' unique (target_kind, target_id), even when
-- the webhook and the 5-minute sweep both see the same row.

-- ------------------------------------------------------------ queue kind ---
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check check (
  kind in (
    'publish_target','refresh_token','snapshot_analytics','cleanup_media',
    'send_invite','sync_avatars','send_push','delete_post_target',
    'sync_inbox','sync_comments','send_message','reply_comment',
    'meta_subscribe','moderate_comment','auto_reply'
  )
);

-- --------------------------------------------------------------- settings ---
create table if not exists public.auto_reply_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  paused boolean not null default false,
  dry_run boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.auto_reply_settings enable row level security;

drop policy if exists auto_reply_settings_read on public.auto_reply_settings;
create policy auto_reply_settings_read on public.auto_reply_settings
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists auto_reply_settings_write on public.auto_reply_settings;
create policy auto_reply_settings_write on public.auto_reply_settings
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

drop trigger if exists trg_auto_reply_settings_touch on public.auto_reply_settings;
create trigger trg_auto_reply_settings_touch
  before update on public.auto_reply_settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ rules ---
create table if not exists public.auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  -- Log the match without sending. Useful before a rule goes live.
  dry_run boolean not null default false,
  scope text not null check (scope in ('comments', 'messages')),
  -- null = every eligible connected channel in the workspace.
  channel_id uuid references public.connected_channels (id) on delete cascade,
  -- word: keyword appears as a whole word/phrase ("price" matches "what's the
  -- price?" but not "pricing"). exact: the whole message equals the keyword.
  -- contains: raw substring, for people who really want partial matches.
  match_mode text not null default 'word' check (match_mode in ('word', 'contains', 'exact')),
  keywords text[] not null default '{}',
  keyword_mode text not null default 'any' check (keyword_mode in ('any', 'all')),
  reply_text text not null,
  delay_seconds integer not null default 60 check (delay_seconds between 0 and 3600),
  -- Never answer a backlog that a first sync just imported.
  max_age_minutes integer not null default 60 check (max_age_minutes between 1 and 10080),
  daily_cap integer not null default 50 check (daily_cap between 1 and 1000),
  -- Comments only: stops one viral post from producing hundreds of replies.
  per_post_cap integer not null default 20 check (per_post_cap between 1 and 500),
  cooldown_minutes integer not null default 1440 check (cooldown_minutes between 0 and 43200),
  first_reply_only boolean not null default false,
  -- Matching these skips the auto-reply and leaves the item for a human.
  escalate_keywords text[] not null default '{}',
  priority integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auto_reply_rules_ws_idx
  on public.auto_reply_rules (workspace_id, enabled, scope);

alter table public.auto_reply_rules enable row level security;

drop policy if exists auto_reply_rules_read on public.auto_reply_rules;
create policy auto_reply_rules_read on public.auto_reply_rules
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists auto_reply_rules_write on public.auto_reply_rules;
create policy auto_reply_rules_write on public.auto_reply_rules
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

drop trigger if exists trg_auto_reply_rules_touch on public.auto_reply_rules;
create trigger trg_auto_reply_rules_touch
  before update on public.auto_reply_rules
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------- events ---
create table if not exists public.auto_reply_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  rule_id uuid references public.auto_reply_rules (id) on delete set null,
  channel_id uuid not null references public.connected_channels (id) on delete cascade,
  target_kind text not null check (target_kind in ('comment', 'message')),
  target_id uuid not null,
  conversation_id uuid,
  external_post_id text,
  external_id text,
  -- Lower-cased author name for comments, conversation id for DMs; used by the
  -- per-person cooldown and first-reply-only checks.
  author_key text,
  target_preview text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'skipped', 'failed', 'canceled')),
  reason text,
  reply_text text,
  job_id bigint,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (target_kind, target_id)
);

create index if not exists auto_reply_events_ws_idx
  on public.auto_reply_events (workspace_id, created_at desc);
create index if not exists auto_reply_events_rule_idx
  on public.auto_reply_events (rule_id, created_at desc);
create index if not exists auto_reply_events_channel_idx
  on public.auto_reply_events (channel_id, created_at desc);
create index if not exists auto_reply_events_author_idx
  on public.auto_reply_events (workspace_id, author_key, created_at desc);

alter table public.auto_reply_events enable row level security;

drop policy if exists auto_reply_events_read on public.auto_reply_events;
create policy auto_reply_events_read on public.auto_reply_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- No insert/update policy: the worker (service_role) owns the ledger.

-- ------------------------------------------------------------- enqueue in ---
-- One job per new inbound row. Errors are swallowed: a failed enqueue must
-- never roll back the comment/message the sync just stored.
create or replace function public.enqueue_auto_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    insert into public.job_queue (kind, payload, run_at, idempotency_key)
    values (
      'auto_reply',
      jsonb_build_object('target_kind', TG_ARGV[0], 'target_id', NEW.id),
      now(),
      'auto_reply:' || TG_ARGV[0] || ':' || NEW.id::text
    )
    on conflict (idempotency_key) do nothing;
  exception when others then
    raise warning 'auto_reply enqueue failed for % %: %', TG_ARGV[0], NEW.id, SQLERRM;
  end;
  return NEW;
end;
$$;

drop trigger if exists comments_enqueue_auto_reply on public.comments;
create trigger comments_enqueue_auto_reply
  after insert on public.comments
  for each row
  when (new.is_own = false and new.status = 'new' and new.created_at > now() - interval '7 days')
  execute function public.enqueue_auto_reply('comment');

drop trigger if exists messages_enqueue_auto_reply on public.messages;
create trigger messages_enqueue_auto_reply
  after insert on public.messages
  for each row
  when (new.direction = 'in' and new.sent_at > now() - interval '7 days')
  execute function public.enqueue_auto_reply('message');

-- ------------------------------------------------------------- enqueue out ---
-- Called by the evaluator once a rule has matched. Inserts the existing send
-- job with a delay and records its id on the event, atomically.
create or replace function public.enqueue_auto_reply_send(
  p_event uuid,
  p_kind text,
  p_payload jsonb,
  p_run_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job bigint;
begin
  if p_kind not in ('reply_comment', 'send_message') then
    raise exception 'bad_auto_reply_kind';
  end if;
  if not exists (
    select 1 from public.auto_reply_events
     where id = p_event and status = 'queued'
  ) then
    raise exception 'auto_reply_event_not_queued';
  end if;

  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    p_kind,
    p_payload || jsonb_build_object('auto_event_id', p_event),
    coalesce(p_run_at, now()),
    'auto_send:' || p_event::text
  )
  on conflict (idempotency_key) do update set updated_at = now()
  returning id into v_job;

  update public.auto_reply_events
     set job_id = v_job
   where id = p_event;

  return v_job;
end;
$$;

revoke all on function public.enqueue_auto_reply_send(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_auto_reply_send(uuid, text, jsonb, timestamptz)
  to service_role;

-- ------------------------------------------------------- send-side ledger ---
-- complete_job flips the send job to done/dead; mirror that on the event so
-- the activity log never shows a queued reply that already finished.
create or replace function public.sync_auto_reply_event_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event uuid;
begin
  v_event := nullif(new.payload->>'auto_event_id', '')::uuid;
  if v_event is null then
    return new;
  end if;

  if new.status = 'done' then
    update public.auto_reply_events
       set status = 'sent', sent_at = coalesce(sent_at, now()), reason = null
     where id = v_event and status = 'queued';
  elsif new.status in ('failed', 'dead') then
    update public.auto_reply_events
       set status = 'failed', reason = coalesce(new.last_error, reason, 'send failed')
     where id = v_event and status = 'queued';
  end if;
  return new;
end;
$$;

drop trigger if exists job_queue_auto_reply_status on public.job_queue;
create trigger job_queue_auto_reply_status
  after update of status on public.job_queue
  for each row
  when (new.payload ? 'auto_event_id')
  execute function public.sync_auto_reply_event_status();
