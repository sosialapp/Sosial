-- P15 · Public blog-media bucket (owner-console image uploads).
--
-- Bucket is PUBLIC (blog images render for anonymous readers); writes are
-- app-admin-only via is_app_admin() (P11). Flat random filenames from the
-- editor — no workspace scoping needed (single owner). Same conventions
-- as the P5 post-media bucket.

insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "blog_media_public_read" on storage.objects;
create policy "blog_media_public_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'blog-media');

drop policy if exists "blog_media_admin_insert" on storage.objects;
create policy "blog_media_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-media' and is_app_admin());

drop policy if exists "blog_media_admin_update" on storage.objects;
create policy "blog_media_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'blog-media' and is_app_admin())
  with check (bucket_id = 'blog-media' and is_app_admin());

drop policy if exists "blog_media_admin_delete" on storage.objects;
create policy "blog_media_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'blog-media' and is_app_admin());
