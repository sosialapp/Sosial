-- P34 · Workspace API keys for the public inbound API (Zapier/Make/webhooks)
--
-- One row per key. Only the SHA-256 hash is stored — the plaintext key is
-- shown once at creation and never again. RLS enabled with NO policies
-- (service-role only, like channel_tokens); the /api/keys management routes
-- and /api/v1 verification run through supabaseAdmin() with cookie-role
-- checks instead.

create table workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references profiles (id),
  scopes text[] not null default '{posts:write}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index workspace_api_keys_workspace_idx on workspace_api_keys (workspace_id);

alter table workspace_api_keys enable row level security;
