-- P23 · Per-post homepage cover switch. show_cover_home lets an author hide
-- the thumbnail on the homepage News cards while keeping it on the blog
-- index, the article hero and link previews. Defaults on (current behavior).
alter table public.blog_posts
  add column if not exists show_cover_home boolean not null default true;
