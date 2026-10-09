-- p58 · Media upload lifecycle: R2 multipart, permanent retention, storage quota.
--
-- Builds on p56 (storage_backend). Adds everything the direct-to-R2 upload
-- flow needs:
--
--   media_assets — the spec's five-state lifecycle plus multipart/thumbnail
--     columns. New columns default so legacy rows keep working unchanged.
--   media_uploads — one row per in-flight multipart upload (R2 UploadId +
--     part ETags), so uploads can be listed, resumed or aborted.
--   plan_limits.storage_bytes — permanent-retention goes with a size quota,
--     not a time window. workspace_storage_used() sums ready bytes per plan.
--
-- Legacy rows (storage_backend='supabase') were written by the old client
-- insert path and are unaffected: status stays 'ready' and the new columns
-- are null. Media is now kept forever; nothing here expires it.
--
-- Mirrors apps/web/src/lib/billing/plans.ts + src/utils/plans.ts —
-- CHANGE ALL TOGETHER.

-- ------------------------------------------------ media_assets: columns ---
alter table public.media_assets
  add column if not exists original_filename text,
  add column if not exists thumb_path text,
  add column if not exists upload_id text;

-- Lifecycle: pending (row created, no bytes yet) → uploading (bytes moving)
-- → ready (verified) → failed | deleted (soft-delete tombstone).
alter table public.media_assets
  drop constraint if exists media_assets_status_check;
alter table public.media_assets
  add constraint media_assets_status_check
    check (status in ('pending', 'uploading', 'ready', 'failed', 'deleted'));

-- Workspace library listings read ready rows newest-first.
create index if not exists media_assets_library_idx
  on public.media_assets (workspace_id, created_at desc)
  where status = 'ready';

-- ------------------------------------------------------- media_uploads ---
-- Multipart session state. One row per in-flight upload; deleted on complete
-- or abort. R2 stores the parts until complete/abort, so this is the source
-- of truth for resuming and for the abandoned-part sweep.
create table if not exists public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_assets (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  upload_id text not null,
  part_size bigint not null,
  total_parts integer not null,
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists media_uploads_media_idx
  on public.media_uploads (media_id);
create index if not exists media_uploads_workspace_idx
  on public.media_uploads (workspace_id);

alter table public.media_uploads enable row level security;

-- Members read their workspace's in-flight uploads; all writes go through the
-- edge function on the service role (no insert/update/delete policies).
drop policy if exists media_uploads_member_read on public.media_uploads;
create policy media_uploads_member_read on public.media_uploads
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- --------------------------------------------------- plan storage quota ---
alter table public.plan_limits
  add column if not exists storage_bytes bigint;

update public.plan_limits set storage_bytes = case plan
  when 'free' then 2::bigint * 1024 * 1024 * 1024
  when 'solo' then 25::bigint * 1024 * 1024 * 1024
  when 'team' then 100::bigint * 1024 * 1024 * 1024
  when 'business' then 500::bigint * 1024 * 1024 * 1024
  when 'ultimate' then null
  else 2::bigint * 1024 * 1024 * 1024
end;

-- Ready bytes a workspace is holding. Used by the edge `init` action to reject
-- uploads that would exceed the plan, and by the app to show usage.
create or replace function public.workspace_storage_used(p_workspace_id uuid)
returns bigint
language sql security definer stable set search_path = public as $$
  select coalesce(sum(byte_size), 0)::bigint
    from public.media_assets
   where workspace_id = p_workspace_id
     and status = 'ready';
$$;

-- Storage quota (bytes) for a workspace's plan; null = unlimited.
create or replace function public.workspace_storage_limit(p_workspace_id uuid)
returns bigint
language sql security definer stable set search_path = public as $$
  select storage_bytes
    from public.plan_limits
   where plan = public.workspace_plan(p_workspace_id);
$$;

revoke all on function public.workspace_storage_used(uuid) from public, anon, authenticated;
revoke all on function public.workspace_storage_limit(uuid) from public, anon, authenticated;
grant execute on function public.workspace_storage_used(uuid) to service_role;
grant execute on function public.workspace_storage_limit(uuid) to service_role;
