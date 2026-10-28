-- P112 · Docs: Channels and Developers sections.
--
-- The marketing /developers page moves into the docs (the middleware
-- redirects it), and the footer's Channels and Developers links are replaced
-- by one Docs link. The channels table mirrors apps/web/src/content/channels.ts
-- at the time of writing; from here on admins edit it in /admin/docs.

insert into public.docs_sections (slug, title, position) values
  ('channels', 'Channels', 2),
  ('developers', 'Developers', 3)
on conflict (slug) do nothing;

insert into public.docs_pages (section_id, slug, title, description, position, published, body_md)
select s.id, v.slug, v.title, v.description, v.position, true, v.body_md
from (values
  ('channels', 'channels', 'Supported channels',
   'Every network, community and blog Sosial publishes to, with each one''s text and media limits.', 0,
$md$Sosial publishes to 17 channels. Connect any of them from **Channels** in the app, then pick them in the composer. A single post can go to all of them at once, and the composer counts characters against each channel's limit as you type.

## Limits at a glance

| Channel | Text limit | Media |
| --- | --- | --- |
| [Instagram](https://sosial.app/integrations/instagram) | 2,200 characters | Up to 20 images or videos |
| [TikTok](https://sosial.app/integrations/tiktok) | 2,200 characters | — |
| [X](https://sosial.app/integrations/x) | 280 characters | Up to 4 images or 1 video per post |
| [Facebook](https://sosial.app/integrations/facebook) | 63,206 characters | Photo, video, or a link preview |
| [Threads](https://sosial.app/integrations/threads) | 500 characters | Up to 10 items per post |
| [YouTube](https://sosial.app/integrations/youtube) | 5,000 characters | Vertical, up to 3 minutes |
| [LinkedIn](https://sosial.app/integrations/linkedin) | 3,000 characters | Image, video, document or poll |
| [Bluesky](https://sosial.app/integrations/bluesky) | 300 characters | Up to 4 images or 1 video |
| [Mastodon](https://sosial.app/integrations/mastodon) | 500 characters on most servers | Up to 4 images or 1 video |
| [Pinterest](https://sosial.app/integrations/pinterest) | 500 characters | — |
| [Telegram](https://sosial.app/integrations/telegram) | 1,024 characters | Photos, video, documents and albums |
| [Discord](https://sosial.app/integrations/discord) | 2,000 characters per message | Images, video and files in a post |
| [WordPress](https://sosial.app/integrations/wordpress) | Effectively unlimited (100k+ characters) | Featured image and inline images |
| [Dev.to](https://sosial.app/integrations/devto) | Effectively unlimited (100k+ characters) | — |
| [Hashnode](https://sosial.app/integrations/hashnode) | Effectively unlimited (100k+ characters) | — |
| [Ghost](https://sosial.app/integrations/ghost) | Effectively unlimited (100k+ characters) | Feature image and inline images |
| [VK](https://sosial.app/integrations/vk) | 16,384 characters | Photos, video and links with previews |

Select a channel name for its full guide: what works there, common mistakes and FAQs.

## Social networks

Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest connect with the network's own sign-in. Instagram and Threads go through a Facebook Page or a professional account, see [Connecting accounts](/connecting-accounts).

## Messaging and communities

Telegram posts to a channel through a bot, and Discord posts to the specific channel a bot or webhook is set to. VK posts to a community or to your profile.

## Blogs

WordPress, Dev.to, Hashnode and Ghost publish long-form articles. They connect with an API key or application password instead of a sign-in, and support a canonical URL so a republished article doesn't compete with your own blog in search.

> **Tip:** a post that's perfect on LinkedIn is usually too long for X. Write the long version once, then shorten it per channel in the composer.
$md$),
  ('developers', 'api', 'REST API',
   'Schedule and publish posts from Zapier, Make or your own code with one API key.', 0,
$md$The Sosial API is a small REST surface authenticated with a workspace API key. Anything that can send an HTTPS request (Zapier, Make, n8n, a cron job, your own backend) can draft, schedule and publish posts through the same queue the app uses, with the same limits and plan quotas.

## Get a key

1. Open **Team** in your workspace (owners and admins only) and scroll to **API keys**.
2. Name the key after the integration that will use it, for example `Zapier`, and select **Create key**.
3. Copy the key now. It's shown once and never displayed again; afterwards only its prefix is listed so you can tell keys apart.

Keys post with owner permissions and belong to one workspace. Create one per integration, so a leaked key costs you one automation: revoke it and everything else keeps running.

## Authentication

The base URL is `https://sosial.app`. Every request carries the key as a bearer token:

```text
Authorization: Bearer sos_live_...
```

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/v1/me` | Auth check. Returns your workspace id, name and plan. |
| GET | `/api/v1/posts?status=sent&limit=20` | Newest posts first, optionally filtered by status. |
| POST | `/api/v1/posts` | Create a post. |

## Create a post

`text` and `channels` are required. One call targets every connected account of each listed channel. Leave out `scheduled_at` for a draft, send `"mode": "now"` to queue it straight away, or send an ISO `scheduled_at` at least 5 minutes ahead to schedule it.

```bash
curl -X POST https://sosial.app/api/v1/posts \
  -H "Authorization: Bearer sos_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Morning Brew #42 is live, link in bio.",
    "channels": ["instagram", "tiktok", "x"],
    "scheduled_at": "2026-10-05T09:00:00Z",
    "timezone": "Asia/Kuala_Lumpur",
    "media_urls": ["https://example.com/cover.jpg"],
    "idempotency_key": "brew-42"
  }'
```

Retries are safe: send the same `idempotency_key` and a duplicate returns the original post instead of posting twice.

## List posts

```bash
curl "https://sosial.app/api/v1/posts?status=sent&limit=10" \
  -H "Authorization: Bearer sos_live_..."
```

## Zapier

1. Create an API key named `Zapier` on the **Team** page.
2. Add a **Webhooks by Zapier** step that POSTs to `https://sosial.app/api/v1/posts` with the `Authorization: Bearer <key>` header and your JSON body. Map the trigger's text, image URL and publish time into `text`, `media_urls` and `scheduled_at`.
3. To trigger on "when Sosial publishes", poll `/api/v1/posts?status=sent` with a **Schedule** step plus a **Webhooks GET**.

## Make

Add an HTTP **Make a request** module: POST, same URL and bearer header as above. To watch for published posts, schedule a scenario that GETs `/api/v1/posts?status=sent` and filters on `created_at` newer than the last run.

## Limits

- API posts count against the same plan quotas as the app. A full workspace answers `402`, never a silent drop.
- Media is capped at 5 files of 25 MB each, fetched server-side from `https` URLs.
- Schedules need the same 5-minute lead the composer enforces.
- Channels must already be connected. Unknown or disconnected channels come back `400`, naming which one.

For AI agents, see the [MCP server](/mcp).
$md$),
  ('developers', 'mcp', 'MCP server',
   'Let AI agents like Claude or Cursor draft and schedule posts, with scoped keys and confirmations.', 1,
$md$AI agents such as Claude, Cursor or any MCP-compatible client can work in a Sosial workspace through the Model Context Protocol: create and edit posts, schedule and unschedule them, list channels and media, and read the queue. The same validation, plan limits and approval rules apply as in the app.

## Connection details

| Setting | Value |
| --- | --- |
| Endpoint | `https://sosial.app/api/mcp` |
| Transport | MCP Streamable HTTP, stateless |
| Auth | Workspace API key as `Authorization: Bearer <key>` |

## Create a key

Open **Team → AI & Developer — MCP** and create a key with the permissions the agent needs. Like REST API keys, MCP keys are shown once, can be revoked at any time and belong to one workspace. Deleting posts is off by default.

## Scopes

| Scope | Allows |
| --- | --- |
| `posts:read` | `get_post`, `get_scheduled_posts` |
| `posts:write` | `create_post` (drafts), `update_post` |
| `posts:schedule` | `schedule_post`, `unschedule_post` (includes `posts:write`) |
| `posts:delete` | `delete_post` (off by default) |
| `channels:read` | `get_channels`, `get_channel_status` |
| `media:read` | `get_media` |
| `comments:read` | `list_comments` |
| `comments:write` | `reply_to_comment` (includes `comments:read`) |

A call without the right scope returns `insufficient_scope`.

## Tools

| Tool | Notes |
| --- | --- |
| `create_post` | `content` and `channel_ids`, optional `title`, `scheduled_at`, `timezone`, `idempotency_key`. Without `scheduled_at` it's a draft. |
| `update_post` | Edit the title, content or time of a draft or queued post. |
| `schedule_post` | ISO 8601 time at least 5 minutes ahead. |
| `unschedule_post` | Turns a queued post back into a draft. |
| `delete_post` | Deletes a post. |
| `get_post` | Status, per-channel targets and media summary. |
| `get_scheduled_posts` | Filter by time window and channel, up to 50 per page. |
| `get_channels` / `get_channel_status` | Connected channels only, never tokens. |
| `get_media` | Uploaded media metadata. |
| `list_comments` | Comments across the workspace's channels, newest first. |
| `reply_to_comment` | Replies publicly as the connected channel. |

## Confirmation

Destructive or public actions (deleting, unscheduling, replying to a comment, editing a post that goes out within 30 minutes) don't run on the first call. They return `confirmation_required` with a summary and a `confirmation_token` valid for 5 minutes. The agent repeats the call with that token once you've agreed, so an agent can't post or delete anything by accident.
$md$)
) as v(section_slug, slug, title, description, position, body_md)
join public.docs_sections s on s.slug = v.section_slug
on conflict (slug) do nothing;

-- The P111 starter page listed only some networks. Point it at the full list,
-- unless an admin has already edited it (any admin save sets updated_by).
update public.docs_pages
set body_md = replace(
  replace(body_md, chr(13), ''),
  $old$- X (Twitter)
- Instagram and Threads (through a Facebook Page or a professional account)
- Facebook Pages
- TikTok
- LinkedIn
- YouTube
- Pinterest
- Bluesky and Mastodon$old$,
  $new$Social networks (X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Pinterest, Bluesky and Mastodon), messaging and community channels (Telegram, Discord, VK) and blogs (WordPress, Dev.to, Hashnode, Ghost). See [Supported channels](/channels) for each one's limits.$new$
)
where slug = 'connecting-accounts' and updated_by is null;
