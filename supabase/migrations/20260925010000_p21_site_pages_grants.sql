-- P21 · site_pages table privileges. RLS policies (P20) decide *which* rows
-- a role may touch, but Postgres also requires GRANTs before a role may
-- touch the table at all — without these, every admin write fails with
-- "permission denied for table site_pages". Mirrors blog_posts (P14).

grant select on public.site_pages to anon;
grant select, insert, update, delete on public.site_pages to authenticated;
