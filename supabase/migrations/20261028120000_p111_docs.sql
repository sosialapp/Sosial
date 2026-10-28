-- P111 · Public docs (docs.sosial.app).
--
-- docs_sections groups pages in the sidebar; docs_pages holds a markdown body
-- per page. Both sort by `position`. Anyone may read sections and published
-- pages; only app admins (is_app_admin, P11) see drafts or write anything.
-- The web API re-checks is_app_admin() before every write, these policies are
-- the backstop.

create table if not exists public.docs_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.docs_pages (
  id uuid primary key default gen_random_uuid(),
  -- restrict: deleting a section that still has pages fails loudly instead of
  -- silently dropping its pages.
  section_id uuid not null references public.docs_sections (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  body_md text not null default '',
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists docs_pages_section_position_idx on public.docs_pages (section_id, position);

-- Stamp every write with the time and the acting user (null for service_role
-- and migrations, which have no auth.uid()).
create or replace function public.docs_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists docs_sections_touch on public.docs_sections;
create trigger docs_sections_touch before insert or update on public.docs_sections
  for each row execute function public.docs_touch();
drop trigger if exists docs_pages_touch on public.docs_pages;
create trigger docs_pages_touch before insert or update on public.docs_pages
  for each row execute function public.docs_touch();

alter table public.docs_sections enable row level security;
alter table public.docs_pages enable row level security;

drop policy if exists "docs_sections_public_read" on public.docs_sections;
create policy "docs_sections_public_read" on public.docs_sections
  for select to anon, authenticated
  using (true);

drop policy if exists "docs_sections_admin_all" on public.docs_sections;
create policy "docs_sections_admin_all" on public.docs_sections
  for all to authenticated
  using (is_app_admin()) with check (is_app_admin());

drop policy if exists "docs_pages_public_read" on public.docs_pages;
create policy "docs_pages_public_read" on public.docs_pages
  for select to anon, authenticated
  using (published);

drop policy if exists "docs_pages_admin_all" on public.docs_pages;
create policy "docs_pages_admin_all" on public.docs_pages
  for all to authenticated
  using (is_app_admin()) with check (is_app_admin());

-- Starter content so the site is never empty. Editable from /admin/docs.
insert into public.docs_sections (slug, title, position) values
  ('getting-started', 'Getting started', 0),
  ('guides', 'Guides', 1)
on conflict (slug) do nothing;

insert into public.docs_pages (section_id, slug, title, description, position, published, body_md)
select s.id, v.slug, v.title, v.description, v.position, true, v.body_md
from (values
  ('getting-started', 'introduction', 'Getting started',
   'What Sosial is, and the three steps from sign-up to your first scheduled post.', 0,
$md$Sosial is a social media scheduler. You write a post once, pick the channels it goes to, and Sosial publishes it at the time you choose, on the web at [sosial.app](https://sosial.app) and in the mobile app.

## Create your account

1. Go to [sosial.app/login](https://sosial.app/login) and sign up with your email, or continue with Google.
2. Confirm your email if asked. You land on your **Dashboard**.
3. A personal team called **My team** is created for you. Everything you connect and schedule belongs to that team, so teammates you invite later see the same channels and calendar.

## The three steps

| Step | Where | What happens |
| --- | --- | --- |
| Connect | **Channels** | Link the accounts you post to |
| Write | **Composer** | Write once, tailor per channel |
| Schedule | **Calendar** / **Queue** | Pick a time, Sosial publishes it |

## What's next

- [Connecting accounts](/connecting-accounts) walks through linking each network.
- [Scheduling posts](/scheduling-posts) covers the composer, the calendar and the queue.

> **Tip:** the mobile app and the web app share the same account. A post scheduled on your phone shows up on the web calendar, and the other way round.
$md$),
  ('guides', 'connecting-accounts', 'Connecting accounts',
   'Link X, Instagram, TikTok, Facebook, LinkedIn, YouTube and more so Sosial can publish for you.', 0,
$md$Before Sosial can publish anything it needs permission to post to your accounts. You grant that once per account from the **Channels** page.

## Connect a channel

1. Open **Channels** in the dock.
2. Pick a network and select **Connect**.
3. Sign in to that network if asked and approve the permissions Sosial requests.
4. You're sent back to Sosial and the account appears in the list.

You can connect several accounts on the same network, for example two Instagram accounts or a personal and a company LinkedIn page.

## Supported networks

- X (Twitter)
- Instagram and Threads (through a Facebook Page or a professional account)
- Facebook Pages
- TikTok
- LinkedIn
- YouTube
- Pinterest
- Bluesky and Mastodon

## Facebook, Instagram and Threads

Instagram professional accounts are linked through the Facebook Page they belong to. When you connect Facebook, Sosial asks which Pages to add. Pick every Page whose Instagram account you also want to post to.

## Reconnecting

Networks expire access from time to time, or when you change your password. When that happens, connect the same account again from **Channels** and approve the permissions. Your scheduled posts are kept.

## Disconnecting

Open the account on **Channels** and choose **Disconnect**. Posts already published stay on the network, and their history stays in Sosial.
$md$),
  ('guides', 'scheduling-posts', 'Scheduling posts',
   'Write a post once, send it to several channels and choose exactly when it goes out.', 1,
$md$## Write a post

1. Open **Composer**, or select **New** from anywhere in the app.
2. Choose the channels the post goes to.
3. Write your text and add photos or a video. The preview shows how the post looks on each channel.

## Pick a time

- **Post now** publishes straight away.
- **Schedule** lets you pick a date and time. Times use your own time zone.

## See what's planned

The **Calendar** shows every scheduled and published post by day, week or month. The **Queue** lists upcoming posts in the order they go out.

## When a post fails

If a network rejects a post, for example because the connection expired or a video is too long, the post is marked as failed and you get a notification with the network's reason. Fix the issue (often a reconnect on **Channels**) and schedule it again.

## Publishing through the API

Developers can create posts with the REST API:

```bash
curl https://sosial.app/api/v1/posts \
  -H "Authorization: Bearer $SOSIAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the API", "channels": ["instagram", "tiktok"]}'
```

Create an API key on the **Team** page.
$md$)
) as v(section_slug, slug, title, description, position, body_md)
join public.docs_sections s on s.slug = v.section_slug
on conflict (slug) do nothing;
