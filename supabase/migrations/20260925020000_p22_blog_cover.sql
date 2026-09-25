-- P22 · Blog cover thumbnails. cover_url holds the public blog-media URL
-- chosen in the admin editor; rendered on the blog index cards, the article
-- hero and the OpenGraph/Twitter metadata.
alter table public.blog_posts
  add column if not exists cover_url text,
  add column if not exists cover_alt text;
