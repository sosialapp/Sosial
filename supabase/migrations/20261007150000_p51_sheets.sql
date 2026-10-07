-- P51: Google Sheets content source.
--
-- sheets_connections: one Google account per workspace for Sheets imports
--   (reconnect swaps it). Tokens in Vault; only secret ids here. RLS on,
--   no policies — service-role routes only (channel_tokens pattern).
-- sheets_imports: chunked/resumable import jobs with the column mapping,
--   date options and progress; the UI polls the row.
-- post_sources (p50) is reused with source_type='sheets'; the unique
--   (workspace, source, source_id, external_row_id) constraint is the
--   idempotency key. Rows are keyed r<rowNumber> + content hash — sheet
--   shifts surface as "changed", never silent duplicates.

create table if not exists public.sheets_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  access_secret_id uuid not null,
  refresh_secret_id uuid not null,
  expires_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

alter table public.sheets_connections enable row level security;

create table if not exists public.sheets_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_title text not null default '',
  sheet_title text not null default '',
  mapping jsonb not null default '{}',
  options jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  progress_total integer not null default 0,
  progress_done integer not null default 0,
  result jsonb not null default '{}',
  cursor integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sheets_imports enable row level security;

drop policy if exists sheets_imports_member_read on public.sheets_imports;
create policy sheets_imports_member_read on public.sheets_imports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create index if not exists sheets_imports_ws_idx
  on public.sheets_imports (workspace_id, created_at desc);
