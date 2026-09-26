-- p30 · Custom CMS pages: metadata, scheduling and redirects.
--
-- site_pages gains the fields /admin/pages edits for every page:
--   title / meta_title / meta_description — custom pages render them; the
--     registry keeps its designed heroes (title still recorded for the list)
--   published_at — display date; a future date schedules the page (hidden
--     until due, like a draft)
--   status draft|published — drafts (and scheduled-future rows) are invisible
--     to the public API; the editor still loads them for admins
--   show_in_footer — custom pages opt into the footer Resources column
--   is_custom — true for admin-created slugs (renamable + deletable);
--     registry slugs stay code-owned
-- site_redirects keeps renamed slugs working with a 301.
--
-- Public read is tightened to live rows only so drafts are truly private.
-- Admins keep full access through the is_app_admin() policy.

alter table public.site_pages
  add column if not exists title text,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists published_at timestamptz,
  add column if not exists status text not null default 'published',
  add column if not exists show_in_footer boolean not null default false,
  add column if not exists is_custom boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_pages_status_check'
  ) then
    alter table public.site_pages
      add constraint site_pages_status_check check (status in ('draft', 'published'));
  end if;
end $$;

create table if not exists public.site_redirects (
  from_slug text primary key,
  to_slug text not null,
  created_at timestamptz not null default now()
);

alter table public.site_redirects enable row level security;

drop policy if exists "site_redirects_public_read" on public.site_redirects;
create policy "site_redirects_public_read" on public.site_redirects
  for select to anon, authenticated using (true);

drop policy if exists "site_redirects_admin_all" on public.site_redirects;
create policy "site_redirects_admin_all" on public.site_redirects
  for all to authenticated
  using (is_app_admin()) with check (is_app_admin());

-- Drafts and scheduled-future rows disappear from the public API.
drop policy if exists "site_pages_public_read" on public.site_pages;
create policy "site_pages_public_read" on public.site_pages
  for select to anon, authenticated
  using (
    status = 'published'
    and (published_at is null or published_at <= now())
  );

grant select on public.site_redirects to anon;
grant select, insert, update, delete on public.site_redirects to authenticated;
