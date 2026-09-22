-- P11 · App-owner console foundation: global admin gate + user reports inbox.
--
-- team_role (owner/admin/member) is workspace-scoped; the owner console needs
-- a global check, so app_admins + is_app_admin() live outside workspaces.
-- app_admins has NO policies (service_role only, like channel_tokens);
-- is_app_admin() (SECURITY DEFINER) is the only read path.
-- Bootstrap the first admin by hand after push:
--   insert into app_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
--
-- reports carry their own email snapshot (profiles may change; the inbox must
-- show who wrote in). Members file under their own id; only app admins
-- read/triage. updated_at is client-maintained (admin UI sets it on save).

create table app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app_admins enable row level security;

create or replace function is_app_admin()
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;
revoke all on function is_app_admin() from public;
grant execute on function is_app_admin() to authenticated;

create table reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  kind text not null default 'bug' check (kind in ('bug', 'idea', 'billing', 'other')),
  subject text not null default '',
  body text not null,
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'closed')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table reports enable row level security;

create policy "reports_member_insert" on reports for insert to authenticated
  with check (user_id = auth.uid());
create policy "reports_admin_read" on reports for select to authenticated
  using (is_app_admin());
create policy "reports_admin_update" on reports for update to authenticated
  using (is_app_admin()) with check (is_app_admin());

create index reports_status_created_idx on reports (status, created_at desc);
