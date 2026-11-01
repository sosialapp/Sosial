-- P117 · Docs: Auto-replies and Bulk import guides, changelog for 29 Oct and 1 Nov.
--
-- New pages insert only when the slug is free, so a page an admin already
-- wrote in /admin/docs is never overwritten. The changelog entries are
-- prepended once (guarded on the date heading), above the newest entry.

insert into public.docs_pages (section_id, slug, title, description, position, published, icon, body_md)
select s.id, v.slug, v.title, v.description, v.position, true, v.icon, v.body_md
from (values
  ('auto-replies', 'Auto-replies',
   'Answer common comments and DMs automatically with keyword rules, guardrails and a log of every decision.', 2, 'messages',
$md$Auto-replies answer the questions you get over and over. You pick trigger words like "price", write the answer once, and Sosial replies to matching comments and direct messages for you. Every match is logged, including the ones Sosial deliberately skips.

Auto-replies are on paid plans. Owners and admins create and edit rules; other members can see them read-only.

## Where to find it

Open **Community** and pick the **Auto-replies** section, next to **Comments** and **Messages**.

## Supported channels

| Replies to | Channels |
| --- | --- |
| Comments | Facebook, Instagram, Threads, X, Bluesky, Mastodon, YouTube |
| Direct messages | Facebook, Instagram, X, Bluesky, Mastodon |

## Create a rule

1. Select **New rule**, or start from a template (price questions, link requests, a welcome DM).
2. **When someone writes**: choose comments or direct messages, and one channel or all of them.
3. **And it contains**: enter trigger words separated by commas, and whether **any** or **all** of them must appear.
4. **Reply with**: write the answer. Variables fill in for each person (see below).
5. **Guardrails**: set the limits that keep replies sensible.
6. Select **Create rule**.

New rules start as a **dry run**: matches are logged but nothing is sent. Use **Try it** to test a sample message against the same matcher Sosial uses, check the **Activity** log, then select **Go live**.

## How matching works

| Matching | What it does |
| --- | --- |
| Mentions the word | The word or phrase appears on its own. "price" matches "what's the price?" but not "pricing". |
| Contains text | Plain substring. "pric" also matches "pricing". |
| Is exactly | The whole message must equal the keyword. |

If several rules match, the one with the highest priority answers, and only one auto-reply is ever sent per comment or message.

## Variables

Use these in the reply text. A variable with no value becomes empty rather than showing the placeholder.

| Variable | Fills in |
| --- | --- |
| `{{name}}` | The person's display name |
| `{{first_name}}` | The first word of their name |
| `{{handle}}` | Their @handle, or their name when there is none |
| `{{platform}}` | The network, for example Instagram |
| `{{text}}` | The message they sent |

## Guardrails

| Setting | What it does |
| --- | --- |
| Wait | Seconds to wait before sending, so a teammate can answer first |
| Max age | Ignore comments and messages older than this, so a first sync never answers a backlog |
| Daily cap | The most replies the rule sends in a day |
| Per post | The most replies on a single post (comments only) |
| Cooldown | How long before the same person gets another auto-reply |
| Hand to a human when it mentions | Escalation words: a match is skipped and left for your team |
| Only answer the first message in a DM | Replies once per conversation |

The limits are checked again at the moment of sending. If a teammate has replied in the meantime, the auto-reply is cancelled.

## Pause everything

The switches at the top apply to the whole workspace. Turn **Replies on** off to pause every rule, or turn on **Dry run all** to log matches without sending anything.

## The activity log

**Activity** lists every decision: sent, queued, skipped and failed, each with the reason (for example "Your team already replied to this comment" or an escalation word). Filter by status to see what needs a look.
$md$),
  ('bulk-import', 'Bulk import',
   'Turn a Google Sheet or a Notion database into drafts and scheduled posts, validated row by row before anything is created.', 3, 'import',
$md$Bulk import turns a content calendar you already keep into posts. Each row becomes a draft or a scheduled post, and every row is checked before anything is created.

## Where to find it

Open **Post** and pick the **Import** tab, then choose **Google Sheets** or **Notion**.

## Google Sheets

1. Select **Connect Google**. Sosial asks for read-only access to your spreadsheets.
2. Paste the spreadsheet link (or its ID) and select **Open**.
3. Check the **column mapping**. Columns are matched by their header automatically, and you can change any of them.
4. Select **Validate rows**. The report shows which rows are ready and what to fix in the others.
5. Select **Import**.

One row is one post, starting below the header row. A sheet can have up to 2,000 rows.

| Column | Required | Notes |
| --- | --- | --- |
| Content | Yes | The post text |
| Publish date | No | With a date the post is scheduled, without one it's a draft |
| Platform(s) | If you have more than one channel | Network or channel names, separated by commas, for example `instagram, x` |
| Title | No | Defaults to the first line of the content |
| Media URL(s) | No | Public `https://` links, separated by commas or spaces |
| Status | No | Map your values (for example "Ready" or "Idea") to scheduled or draft |
| Tags | No | Separated by commas |

### Dates

These formats work, with an optional time:

- `2026-11-14 09:30` (ISO, with or without a time zone offset)
- `14/11/2026 09:30` or `14.11.2026`
- `2026/11/14`
- `Nov 14, 2026 09:30` or `14 Nov 2026`

Dates without a time zone use the **time zone** you pick under **Options**. For dates like `01/02/2026`, choose **Day/Month/Year** or **Month/Day/Year**; the default reads the day first. Dates in the past are rejected.

## Notion

1. Select **Connect Notion** and choose which databases Sosial may read.
2. Pick a database. If it isn't listed, open it in Notion, then **•••** → **Connections** → add **Sosial**.
3. Map the fields. **Content** is required and can be a text property or the page body. You can also map a title, platform (a select whose values map to your channels), status, publish date, files and tags.
4. Check the preview and import.

Property types Sosial can't use (people, relations, rollups) are skipped with a warning. A select value you haven't mapped is flagged as an error, never guessed.

## Rows that need attention

A row isn't imported when it has no content, a platform that doesn't match a connected channel (or matches more than one), a date that can't be read or is in the past, or a status that says scheduled but has no date. The report gives the row number and the reason.

Some problems are warnings and the row still imports: media that isn't an `https://` link is left out, a status value you haven't mapped imports as a draft, and text over a channel's limit is flagged so you can shorten it in the composer.

## Importing again

Re-importing the same sheet or database skips rows that are already in Sosial, and counts rows that changed at the source since the last import. Disconnecting Google or Notion keeps the posts you imported.
$md$)
) as v(slug, title, description, position, icon, body_md)
join public.docs_sections s on s.slug = 'guides'
on conflict (slug) do nothing;

-- Changelog: newest first, so the new dates go above the first "## " heading.
update public.docs_pages
set body_md = regexp_replace(
  replace(body_md, chr(13), ''),
  '\n## ',
  $new$
## 1 November 2026

- **Auto-replies**: keyword rules answer comments and direct messages for you, with a dry run, caps, cooldowns, escalation words and a log of every decision. On paid plans. See [Auto-replies](/auto-replies).
- **Bulk import**: a new **Import** tab under **Post** turns a Google Sheet or a Notion database into drafts and scheduled posts, checked row by row. See [Bulk import](/bulk-import).
- **Analytics**: refresh follower counts whenever you like; they also update every hour.
- **Languages**: the home page, analytics, auto-replies and import are translated into all seven languages, and the home and pricing pages have their own address per language (for example sosial.app/es).
- **Mobile**: the app opens faster, and the Community channel list shows each channel's profile picture.

## 29 October 2026

- **Studio**: edit designs directly on the canvas, place blocks side by side and size each one, and crop images with the rebuilt crop tool.
- **Threads**: post insights in analytics.
- **Bluesky**: clearer sign-in errors.

## $new$
)
where slug = 'changelog'
  and position('## 1 November 2026' in body_md) = 0;
