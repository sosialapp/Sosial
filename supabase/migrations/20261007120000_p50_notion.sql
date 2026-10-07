-- P50: Notion content source.
--
-- notion_connections: one OAuth connection per (workspace, Notion workspace).
--   Access token lives in Vault (same trust model as channel tokens); the
--   table stores only the secret id + metadata. RLS on, no policies:
--   service-role routes only (same pattern as channel_tokens).
-- post_sources: dedupe ledger for imported content. Unique constraint
--   (workspace_id, source_type, source_id, external_row_id) is the enforced
--   idempotency key (Notion page id now, sheet row key in Phase 3).
--   content_hash powers "already imported / changed" reporting on re-import.
-- notion_imports: import jobs with progress + mapping config, so large
--   imports run chunked/resumable and the UI can read progress state.

create table if not exists public.notion_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  notion_workspace_id text not null,
  notion_workspace_name text not null default '',
  bot_id text,
  access_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, notion_workspace_id)
);

alter table public.notion_connections enable row level security;

create index if not exists notion_connections_ws_idx
  on public.notion_connections (workspace_id);

create table if not exists public.post_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  source_type text not null check (source_type in ('notion', 'sheets')),
  source_id text not null,
  external_row_id text not null,
  content_hash text not null default '',
  created_at timestamptz not null default now(),
  unique (workspace_id, source_type, source_id, external_row_id)
);

alter table public.post_sources enable row level security;

drop policy if exists post_sources_member_read on public.post_sources;
create policy post_sources_member_read on public.post_sources
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create index if not exists post_sources_lookup_idx
  on public.post_sources (workspace_id, source_type, source_id);

create table if not exists public.notion_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  database_id text not null,
  database_title text not null default '',
  mapping jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  progress_total integer not null default 0,
  progress_done integer not null default 0,
  result jsonb not null default '{}',
  cursor text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notion_imports enable row level security;

drop policy if exists notion_imports_member_read on public.notion_imports;
create policy notion_imports_member_read on public.notion_imports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create index if not exists notion_imports_ws_idx
  on public.notion_imports (workspace_id, created_at desc);
