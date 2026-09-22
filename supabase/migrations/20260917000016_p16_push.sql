-- P16 · Push notifications: device token registry + send_push job kind.
--
-- push_tokens maps each device's Expo push token to its owner (one row per
-- token; re-installs upsert). Users manage their own rows; app admins read
-- the broadcast audience. The worker prunes dead tokens from Expo receipts
-- (DeviceNotRegistered → DELETE).
-- job_queue.kind gains 'send_push' (same drop/re-add pattern as P10).

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references workspaces (id) on delete set null,
  expo_token text not null unique,
  platform text not null default '' check (platform in ('', 'ios', 'android')),
  created_at timestamptz not null default now()
);
alter table push_tokens enable row level security;

create policy "push_owner_all" on push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_admin_read" on push_tokens for select to authenticated
  using (is_app_admin());

create index push_tokens_user_idx on push_tokens (user_id);

alter table job_queue drop constraint if exists job_queue_kind_check;
alter table job_queue add constraint job_queue_kind_check check (
  kind in ('publish_target', 'refresh_token', 'snapshot_analytics', 'cleanup_media', 'send_invite', 'sync_avatars', 'send_push')
);
