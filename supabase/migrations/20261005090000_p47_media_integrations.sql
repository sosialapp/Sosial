-- p47 · media_integrations — user-scoped cloud state for composer media
-- sources (Drive/Photos, Dropbox, Canva). Secrets live in Vault (same trust
-- model as channel_tokens); the table holds only secret *ids* + metadata, so
-- RLS-guarded reads never expose tokens.

create table if not exists media_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'dropbox', 'canva')),
  access_secret_id uuid not null,
  refresh_secret_id uuid not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table media_integrations enable row level security;

create policy "own integrations select"
  on media_integrations for select
  using (auth.uid() = user_id);

create policy "own integrations write"
  on media_integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
