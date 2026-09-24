-- Blog posts carry the pre-serialized BlockNote body next to the JSON model,
-- so the public page server-renders exactly what the editor saved.
alter table public.blog_posts
  add column if not exists body_html text;
