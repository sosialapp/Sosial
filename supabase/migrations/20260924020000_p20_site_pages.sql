-- P20 · CMS-managed marketing page content. site_pages holds an optional
-- BlockNote body per registered page (product, channels, resources, company
-- groups in the footer); public pages render the serialized HTML in a fixed
-- slot when a row exists and fall back to their hardcoded design otherwise.
-- Only registered slugs are editable — the admin UI lists the registry, so
-- no route sprawl is possible.

create table if not exists public.site_pages (
  slug text primary key,
  body jsonb not null default '[]'::jsonb,
  body_html text,
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

drop policy if exists "site_pages_public_read" on public.site_pages;
create policy "site_pages_public_read" on public.site_pages
  for select to anon, authenticated
  using (true);

drop policy if exists "site_pages_admin_all" on public.site_pages;
create policy "site_pages_admin_all" on public.site_pages
  for all to authenticated
  using (is_app_admin()) with check (is_app_admin());
