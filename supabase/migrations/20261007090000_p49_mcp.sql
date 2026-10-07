-- P49: MCP support — key expiry, confirmation tokens, tool-call logs.
--
-- workspace_api_keys gains expires_at (null = never) — the Zapier keys stay
-- forever-valid; MCP clients may set an expiry when minting.
-- mcp_confirmations: hashed single-use tokens for the anti-footgun two-step
--   (destructive / imminent actions). 5-minute TTL enforced by the app and
--   swept by the existing worker cleanup pattern (rows are tiny; a cron
--   delete keeps the table empty).
-- mcp_logs: one row per MCP tool call — tool, outcome, latency. No content,
--   no tokens. Correlation via key_id + created_at.

alter table public.workspace_api_keys
  add column if not exists expires_at timestamptz;

create table if not exists public.mcp_confirmations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key_id uuid not null references public.workspace_api_keys (id) on delete cascade,
  tool text not null,
  args_hash text not null,
  token_hash text not null unique,
  summary text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_confirmations_ws_idx
  on public.mcp_confirmations (workspace_id, key_id, created_at desc);

alter table public.mcp_confirmations enable row level security;
-- No policies: only the service role (API route) touches confirmations.

create table if not exists public.mcp_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key_id uuid,
  user_id uuid,
  tool text not null,
  outcome text not null,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mcp_logs_ws_idx
  on public.mcp_logs (workspace_id, created_at desc);

alter table public.mcp_logs enable row level security;
-- No policies: observability rows are service-role only.
