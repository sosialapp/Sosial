-- p26 · Cross-device content library: ideas, templates and studio projects
-- sync between the mobile app (AsyncStorage) and the web app (localStorage)
-- through this one table. One row per (workspace, client_id); last write wins
-- by updated_at; deletes are tombstones (deleted_at) so a removal on one
-- device is not resurrected by the other side's next push.
--
-- Also bumps updated_at automatically on posts + library_items updates so
-- last-write-wins comparisons stay honest (the mobile push upsert does not
-- set updated_at itself).

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id text not null,
  kind text not null check (kind in ('idea', 'template', 'project')),
  title text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, client_id)
);

create index if not exists library_items_workspace_kind_idx
  on public.library_items (workspace_id, kind);

create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_bump_updated_at on public.posts;
create trigger posts_bump_updated_at
  before update on public.posts
  for each row execute function public.bump_updated_at();

drop trigger if exists library_items_bump_updated_at on public.library_items;
create trigger library_items_bump_updated_at
  before update on public.library_items
  for each row execute function public.bump_updated_at();

alter table public.library_items enable row level security;

-- Members read their workspace's library; member writes go through the same
-- client the apps already use (anon key + user JWT), mirroring the posts
-- tables' model. No service-role dependency for sync.
drop policy if exists library_member_read on public.library_items;
create policy library_member_read
  on public.library_items for select
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = library_items.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists library_member_write on public.library_items;
create policy library_member_write
  on public.library_items for all
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = library_items.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = library_items.workspace_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.library_items to authenticated;
