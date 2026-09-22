-- P12 · Blog CMS: blog_posts table.
--
-- Body reuses the shared Block[] model (see Prose) as jsonb — the admin
-- editor and the marketing pages speak the same shape, no markdown layer.
-- Public reads published rows; app admins (is_app_admin, P11) write.
-- Seed data arrives in P13 (generated, never hand-edited).

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  body jsonb not null default '[]',
  tag text not null default 'Strategy',
  minutes int not null default 5,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table blog_posts enable row level security;

create policy "blog_public_read" on blog_posts for select to anon, authenticated
  using (status = 'published');
create policy "blog_admin_all" on blog_posts for all to authenticated
  using (is_app_admin()) with check (is_app_admin());

create index blog_posts_status_published_idx on blog_posts (status, published_at desc);
