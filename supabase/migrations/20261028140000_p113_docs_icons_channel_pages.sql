-- P113 · Docs: icons, sub-pages, one page per channel, changelog.
--
-- docs_pages.icon: 'brand:<provider>' for a network logo, otherwise a name from the
-- docs icon set (apps/web/src/components/docs/DocsIcon.tsx). parent_id nests
-- a page one level under another page of the same section; the sidebar shows
-- it under a chevron. The Channels section becomes "OAuth Channels" with a
-- page per network, generated from apps/web/src/content/channels.ts plus each
-- network's real connect flow. Also corrects the earlier starter text, which
-- said Instagram connects through a Facebook Page (it uses Instagram login).

alter table public.docs_pages add column if not exists icon text not null default '';
alter table public.docs_pages add column if not exists parent_id uuid references public.docs_pages (id) on delete set null;
create index if not exists docs_pages_parent_idx on public.docs_pages (parent_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'docs_pages_not_own_parent') then
    alter table public.docs_pages add constraint docs_pages_not_own_parent check (parent_id is null or parent_id <> id);
  end if;
end $$;

update public.docs_sections set title = 'OAuth Channels' where slug = 'channels' and title = 'Channels';

update public.docs_pages set icon = 'rocket' where slug = 'introduction' and icon = '';
update public.docs_pages set icon = 'plug' where slug = 'connecting-accounts' and icon = '';
update public.docs_pages set icon = 'calendar-clock' where slug = 'scheduling-posts' and icon = '';
update public.docs_pages set icon = 'globe' where slug = 'channels' and icon = '';
update public.docs_pages set icon = 'code' where slug = 'api' and icon = '';
update public.docs_pages set icon = 'bot' where slug = 'mcp' and icon = '';

-- One page per channel, after the "Supported channels" overview (position 0).
insert into public.docs_pages (section_id, slug, title, description, position, published, icon, body_md)
select s.id, v.slug, v.title, v.description, v.position, true, v.icon, v.body_md
from (values
  ('instagram', 'Instagram', 'Reels, carousels and stories that reward the first three seconds.', 1, 'brand:instagram',
$md$Instagram is a visual-first feed where reach is driven by watch time and saves, not by how many hashtags you stack. Sosial schedules your Reels and carousels alongside every other channel so a single idea can ship as a 9:16 video here and a text post elsewhere.

## Connect Instagram

Instagram connects with your **Instagram login**, no Facebook Page needed. It has to be a **professional account** (Business or Creator); personal accounts can't be published to by any app.

1. Open **Channels** and select **Instagram → Connect**.
2. Sign in to Instagram and approve publishing, comments and messages.
3. You're back in Sosial with the account listed. Repeat for each account.

If you only have a personal account, switch it in the Instagram app under **Settings → Account type and tools → Switch to professional account**. It's free.

## Limits

| Limit | Value |
| --- | --- |
| Caption limit | 2,200 characters |
| Carousel | Up to 20 images or videos |
| Reels length | Up to 3 minutes |
| Hashtags | 30 max: fewer, more specific wins |

The composer checks these as you type, so a post that's too long for Instagram is flagged before it's scheduled.

## What works on Instagram

- Reels and short vertical video
- Carousels that teach one idea per slide
- Behind-the-scenes and product close-ups

## Tips

### Write the first line for the collapsed caption

Only the first ~125 characters show before "more". Put the hook there, then use line breaks to control the truncation.

### Front-load the visual hook

Keep the opening frame of a Reel readable at thumbnail size: large subject, high contrast, on-screen text under six words.

### Batch carousels from one blog post

Turn each section heading into a slide, and the closing slide into a soft call to action. One article becomes a week of carousels.

## Avoid

- Reusing a 16:9 landscape upload. It letterboxes and loses reach.
- Copy-pasting the same caption to Instagram and X, where the tone should differ.
- Hashtag blocks of 30 generic tags that read as spam.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('facebook', 'Facebook', 'The widest caption limit, and the most forgiving scheduling window.', 2, 'brand:facebook',
$md$Facebook Pages still reach the largest broad-interest audience of any channel, and the 63,206-character caption limit makes it the one place a full article reads naturally. Sosial publishes to your Page on schedule.

## Connect Facebook

Facebook connects with your **Facebook login**, then you pick the **Pages** to add. Sosial publishes as the Page, using the Page's own token.

1. Open **Channels** and select **Facebook → Connect**.
2. Sign in to Facebook and approve the Pages you manage.
3. Back in Sosial, pick the Pages to add.

You need a role on the Page that allows posting content. If a Page is missing, ask a Page admin to give you one. If you manage many Pages and some don't fit in the list, connect them one at a time.

## Limits

| Limit | Value |
| --- | --- |
| Caption limit | 63,206 characters |
| Media | Photo, video, or a link preview |
| Best length | 40–80 words for engagement, longer for storytelling |
| Peak times | Weekday mornings and early afternoon |

The composer checks these as you type, so a post that's too long for Facebook is flagged before it's scheduled.

## What works on Facebook

- Longer storytelling posts
- Community questions
- Event and launch announcements

## Tips

### Use the first two lines as a hook

Facebook truncates after roughly 250 characters on mobile. Earn the "See more" tap.

### Ask one specific question

A concrete question ("which of these two covers works better?") gets far more comments than "thoughts?".

### Post native media, not a bare link

Native images and video out-reach link posts. Put the link in the first comment if you need the click.

## Avoid

- Cross-posting an X-length post that reads as an afterthought.
- Engagement-bait phrasing that the algorithm suppresses.
- Posting a link with no context. Facebook down-ranks it.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('threads', 'Threads', 'Conversational posts where a reply can out-reach the original.', 3, 'brand:threads',
$md$Threads favours plain, conversational text and rewards replies. It has no hashtag culture, so reach comes from a strong opening line and being genuinely worth answering.

## Connect Threads

Threads connects with your **Threads login**.

1. Open **Channels** and select **Threads → Connect**.
2. Sign in to Threads and approve publishing and replies.
3. The profile appears in your channel list.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 500 characters |
| Media | Up to 10 items per post |
| Links | Included in the 500-character count |
| Culture | Hashtags do very little. Skip them |

The composer checks these as you type, so a post that's too long for Threads is flagged before it's scheduled.

## What works on Threads

- Opinions and questions
- Casual product updates
- Chains that continue a thought

## Tips

### Write like a message, not a billboard

Lowercase, direct, first person. Threads reads more like a group chat than a broadcast network.

### Leave a gap for replies

A post that fully closes its own argument gives nobody a reason to answer. End with the open question.

### Chain long ideas deliberately

Use a chain when an idea genuinely needs it, and keep each link short. 500 characters is a hard stop.

## Avoid

- Pasting a wall of hashtags from an Instagram caption.
- Posting an identical copy of an X post with no tonal change.
- Long chains where the second post is weaker than the first.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('tiktok', 'TikTok', 'Native-feeling vertical video, scheduled without the app.', 4, 'brand:tiktok',
$md$TikTok rewards content that looks like it belongs on TikTok. Sosial queues your vertical videos with their captions and publishes them on schedule, so you can batch a week of clips in one sitting.

## Connect TikTok

TikTok connects with your **TikTok login**.

1. Open **Channels** and select **TikTok → Connect**.
2. Sign in to TikTok and approve the permissions.
3. The account appears in your channel list.

Every TikTok post asks **who can see it**. TikTok requires you to choose this yourself, so Sosial never picks a default. Posts without an audience aren't queued.

## Limits

| Limit | Value |
| --- | --- |
| Caption limit | 2,200 characters |
| Aspect ratio | 9:16, 1080×1920 |
| Ideal length | 15–60 seconds for completion rate |
| Hashtags | 3–5 relevant tags beat 20 generic ones |

The composer checks these as you type, so a post that's too long for TikTok is flagged before it's scheduled.

## What works on TikTok

- 9:16 video under 60 seconds
- Trend-led clips
- Educational series with a recurring hook

## Tips

### Say the hook in the first second

TikTok decides distribution on early retention. Start mid-sentence if it earns attention faster.

### Design for sound-off and sound-on

Burn in captions so the clip works muted, and pick a trending audio so it works unmuted too.

### Schedule a series, not a one-off

Three clips a week on the same theme compounds far faster than a single viral attempt.

## Avoid

- Re-uploading a watermarked video from another platform.
- Long intros before the hook. Most viewers have already scrolled.
- Posting the same clip to Reels and TikTok with the identical caption and no re-cut.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('x', 'X', 'Threads that hold attention, written and scheduled in one pass.', 5, 'brand:x',
$md$X is the fastest channel to test an idea and the least forgiving of a rambling opener. Sosial lets you write a thread as a single piece, with a live character count per post, then schedule it across your other channels.

## Connect X

X connects with your **X login**. Because X charges apps for its posting API, connecting X needs a **paid Sosial plan**. Upgrade under **Billing** first.

1. Open **Channels** and select **X → Connect**.
2. Sign in to X and approve posting.
3. The account appears in your channel list.

If X rejects a post, the notification quotes X's own reason and whether the media upload or the post failed.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 280 characters |
| Threads | No hard cap: keep each post self-contained |
| Media | Up to 4 images or 1 video per post |
| Links | The card no longer counts toward the limit |

The composer checks these as you type, so a post that's too long for X is flagged before it's scheduled.

## What works on X

- Threads that build an argument
- Timely commentary
- Product and build-in-public updates

## Tips

### One idea per post

A thread works when each post could stand alone. If a post needs the next one to make sense, cut it shorter.

### No throat-clearing

Delete "Let me explain", "A thread 🧵", and the rest. State the claim first.

### Keep promotional posts under 200 characters

Short posts with a single clear link consistently outperform dense ones on X.

## Avoid

- Splitting a paragraph mid-sentence across two posts.
- Threads with no payoff. The last post should land the point, not trail off.
- Scheduling a time-sensitive take for tomorrow.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('youtube', 'YouTube', 'Long-form and Shorts from the same queue.', 6, 'brand:youtube',
$md$YouTube is two products in one: a search engine for long-form video and a vertical feed for Shorts. Sosial schedules both, with the title and description fields where discoverability actually happens.

## Connect YouTube

YouTube connects with your **Google account**.

1. Open **Channels** and select **YouTube → Connect**.
2. Choose the Google account that owns the channel and approve uploads.
3. The channel appears in your channel list.

## Limits

| Limit | Value |
| --- | --- |
| Description limit | 5,000 characters |
| Title limit | 100 characters |
| Shorts | Vertical, up to 3 minutes |
| Tags | 500 characters total, low impact |

The composer checks these as you type, so a post that's too long for YouTube is flagged before it's scheduled.

## What works on YouTube

- Tutorials and reviews
- Shorts from vertical clips
- Evergreen search-driven content

## Tips

### Put keywords in the title, naturally

The title is the single strongest ranking signal. Name the thing people would search for.

### First two lines of the description matter most

Write a genuine summary, then the timestamps, then the links.

### Cut vertical clips from long-form

One 10-minute video can yield five Shorts. Schedule them across the following fortnight.

## Avoid

- Uploading landscape video as a Short. It will letterbox.
- Keyword-stuffed titles that read as spam to humans.
- Leaving the description empty when it is free search real estate.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('linkedin', 'LinkedIn', 'First two lines decide whether a post gets read.', 7, 'brand:linkedin',
$md$LinkedIn collapses posts after roughly two lines on mobile, so the opening sentences do nearly all the work. The 3,000-character limit is generous. The constraint is attention, not space.

## Connect LinkedIn

LinkedIn connects with your **LinkedIn login**.

1. Open **Channels** and select **LinkedIn → Connect**.
2. Sign in to LinkedIn and approve posting.
3. Your profile appears in your channel list.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 3,000 characters |
| Preview cutoff | ~140 characters before "see more" |
| Media | Image, video, document or poll |
| Links | Put them in the first comment to protect reach |

The composer checks these as you type, so a post that's too long for LinkedIn is flagged before it's scheduled.

## What works on LinkedIn

- Lessons and case studies
- Hiring and company news
- Industry analysis

## Tips

### Open with a specific claim

"We cut onboarding from 14 days to 3" beats "Onboarding is important". Specificity earns the tap.

### Break every paragraph after one or two lines

Short paragraphs read as scannable on mobile and give the post rhythm.

### Ask for one thing at the end

A single clear question or invitation outperforms three competing calls to action.

## Avoid

- Burying the point under a warm-up paragraph.
- Hashtag stuffing: three relevant tags is the ceiling.
- Reposting an Instagram caption with emoji-heavy formatting.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('pinterest', 'Pinterest', 'Evergreen discovery where a pin keeps working for months.', 8, 'brand:pinterest',
$md$Pinterest behaves like a visual search engine. A single vertical pin can drive traffic for a year, which makes it the highest-leverage channel for anything instructional or product-led.

## Connect Pinterest

Pinterest connects with your **Pinterest login**.

1. Open **Channels** and select **Pinterest → Connect**.
2. Sign in to Pinterest and approve pins and boards.
3. When you post, pick the **board** each pin goes to.

## Limits

| Limit | Value |
| --- | --- |
| Description limit | 500 characters |
| Title limit | 100 characters |
| Image ratio | 2:3 vertical, 1000×1500 |
| Lifespan | Months, not hours |

The composer checks these as you type, so a post that's too long for Pinterest is flagged before it's scheduled.

## What works on Pinterest

- How-to graphics
- Product imagery
- Seasonal and evergreen content

## Tips

### Design at 2:3, not 9:16

Vertical is right, but Pinterest's ratio is 2:3. A 9:16 Story graphic gets cropped.

### Write the description like a search query

Describe what the pin shows using the words people would type. That is what gets indexed.

### Re-pin your own best work seasonally

Reschedule a proven pin ahead of the season it fits and it earns traffic again.

## Avoid

- Uploading landscape or square images. They get cropped or ignored.
- Keyword-free descriptions that give the indexer nothing to work with.
- Treating Pinterest like a fast-moving feed and giving up after a week.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('mastodon', 'Mastodon', 'Community-first posting, with content warnings done properly.', 9, 'brand:mastodon',
$md$Mastodon is a federated network of independent servers. Etiquette carries more weight here than reach mechanics: use alt text, use content warnings, and do not treat it as a broadcast channel.

## Connect Mastodon

Mastodon has no central login. Type your **username or your server** (for example `fosstodon.org`); your server registers Sosial itself, so there are no app keys to create.

1. Open **Channels** and select **Mastodon**.
2. Enter your username or server, then select **Connect Mastodon**.
3. Sign in on your server's page and approve.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 500 characters on most servers |
| Media | Up to 4 images or 1 video |
| Culture | Content warnings and alt text are expected |
| Reach | Hashtags genuinely help discovery here |

The composer checks these as you type, so a post that's too long for Mastodon is flagged before it's scheduled.

## What works on Mastodon

- Technical communities
- Open-source and research updates
- Longer-form discussion

## Tips

### Use content warnings for sensitive topics

A content warning is a courtesy, not a downgrade. It keeps your post welcome in more timelines.

### Use two or three real hashtags

Unlike most networks, well-chosen hashtags materially improve discovery on Mastodon.

### Engage with replies properly

Boosts and replies matter more than follower count. A conversational account grows fastest.

## Avoid

- Assuming one server speaks for the whole network.
- Auto-cross-posting identical marketing copy from X.
- Posting images without alt text.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('bluesky', 'Bluesky', 'Short, honest posts with a feed you can actually influence.', 10, 'brand:bluesky',
$md$Bluesky is an open network with a 300-character limit and custom feeds rather than one algorithmic timeline. Using the right feed-friendly language matters more than timing.

## Connect Bluesky

Bluesky doesn't use a sign-in page. You connect with your **handle** and an **app password**, a separate password that you can revoke at any time.

1. In Bluesky, open **Settings → App passwords** and create one.
2. In Sosial, open **Channels → Bluesky**.
3. Enter your handle (your name alone works, Sosial adds `.bsky.social`) and paste the app password.
4. Select **Connect Bluesky**.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 300 characters |
| Media | Up to 4 images or 1 video |
| Links | Count toward the limit; a card is generated |
| Culture | Alt text on images is expected |

The composer checks these as you type, so a post that's too long for Bluesky is flagged before it's scheduled.

## What works on Bluesky

- Short takes
- Developer and researcher audiences
- Linking to long-form work

## Tips

### Add alt text to every image

It is a strong norm on Bluesky and makes posts accessible. It also shows up in search.

### Post smaller and more often

300 characters suits a quick observation. Save the essay for Threads or LinkedIn.

### Write for feeds, not a clock

Chronological and custom feeds mean consistency beats timing far more than it does elsewhere.

## Avoid

- Threads longer than three or four posts.
- Ignoring alt text. It reads as careless to a technical audience.
- Cross-posting marketing copy verbatim from X.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('telegram', 'Telegram', 'Channels and groups that reach subscribers without an algorithm in the way.', 11, 'brand:telegram',
$md$Telegram delivers to everyone who opted in, no ranking, no reach throttling. Sosial connects your bot to a channel or group and queues messages with formatting and media intact, so an announcement lands the moment you schedule it.

## Connect Telegram

Telegram posts through a **bot** that you own.

1. Message **@BotFather** in Telegram, create a bot and copy its token.
2. Add the bot to your channel or group as an **admin**.
3. In Sosial, open **Channels → Telegram**, paste the bot token and the destination: `@mychannel`, or a numeric id like `-1001234567890`.
4. Select **Connect**.

## Limits

| Limit | Value |
| --- | --- |
| Message limit | 1,024 characters |
| Media | Photos, video, documents and albums |
| Formatting | Bold, italic, links and monospace via Markdown |
| Delivery | Chronological, no feed algorithm |

The composer checks these as you type, so a post that's too long for Telegram is flagged before it's scheduled.

## What works on Telegram

- Product and release announcements
- Community updates for a channel
- Time-sensitive drops

## Tips

### Write for the notification, not the archive

The first line is what shows in a push. Lead with the news, not the preamble.

### Use formatting to make it scannable

Bold the key line and put details on their own lines. A wall of plain text gets skimmed and closed.

### Keep the cadence predictable

Subscribers stay for a reason. A steady rhythm of useful posts beats occasional bursts nobody expected.

## Avoid

- Treating a channel like a broadcast billboard and posting every hour.
- Long blocks of text with no line breaks on mobile.
- Broken links that Telegram previews but the reader cannot open.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('discord', 'Discord', 'Announcements and updates that land in the right server channel.', 12, 'brand:discord',
$md$Discord is where communities talk in real time, and announcements work best when they read like they came from a member, not a machine. Sosial posts scheduled updates to the channel you pick, so launches, changelogs and events arrive on cue.

## Connect Discord

Discord posts through a **bot** that you invite to your server.

1. Create an app in the **Discord Developer Portal**, open **Bot** and copy the token.
2. Invite the bot to your server with **Send Messages** and **Read Message History**.
3. In Sosial, open **Channels → Discord**, paste the token and list your servers.
4. Pick the channel or thread to post to, then connect.

## Limits

| Limit | Value |
| --- | --- |
| Message limit | 2,000 characters per message |
| Media | Images, video and files in a post |
| Markdown | Bold, italics, code blocks and links |
| Where it posts | The specific channel the bot is set to |

The composer checks these as you type, so a post that's too long for Discord is flagged before it's scheduled.

## What works on Discord

- Server announcements
- Events and changelogs
- Community engagement prompts

## Tips

### Post to the right channel

An announcement belongs in #announcements, not #general. Route each message to the channel that fits.

### Use code blocks for updates

A short changelog in a code block stays aligned and reads as a clear list of what changed.

### Tag roles sparingly

A role ping pulls attention once. Reaching for it every post teaches the server to mute you.

## Avoid

- Posting to the wrong channel and burying the message in conversation.
- Overusing @everyone until members mute the server.
- Walls of text where a short bold headline plus a link would do.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('vk', 'VK', 'Reach Russian-speaking audiences on the network they use daily.', 13, 'brand:vk',
$md$VK is one of the largest social networks in the Russian-speaking world. Sosial posts to your community or profile through the VK API, so scheduled updates, links and media publish exactly when you plan them.

## Connect VK

VK posts to a **community** (group or public page). Posting to a personal profile is restricted by VK.

1. In VK, open your community → **Manage → Working with API → Access tokens** and create a key with **wall** and **photos** rights.
2. In Sosial, open **Channels → VK**.
3. Enter the community link, short name or numeric id, and paste the access key.
4. Select **Connect**.

## Limits

| Limit | Value |
| --- | --- |
| Post limit | 16,384 characters |
| Media | Photos, video and links with previews |
| Where it posts | A community (group or public page) or your profile |
| Auth | VK OAuth access token |

The composer checks these as you type, so a post that's too long for VK is flagged before it's scheduled.

## What works on VK

- Russian-speaking audiences
- Community updates
- Links and media posts

## Tips

### Post from the community, not your profile

Community posts carry the page identity and build a following rather than a personal timeline.

### Let the link make its own preview

VK renders a rich card for shared links. Paste the URL on its own line so it expands cleanly.

### Attach media for reach

Posts with an image stop the scroll in a way plain text cannot.

## Avoid

- Publishing from a personal profile when you meant the community.
- Expired access tokens after a password change on the VK account.
- Pasting a raw URL inside a sentence, which stops it previewing.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('wordpress', 'WordPress', 'Push posts from the calendar straight to your self-hosted site.', 14, 'brand:wordpress',
$md$Your blog is still the home base your social posts point back to. Sosial connects to a WordPress site over its REST API and publishes scheduled posts with their title, body and featured image, so the article ships when you planned it.

## Connect WordPress

WordPress has no central login: each site creates its own **application password** (WordPress 5.6 or later).

1. In WordPress, open **Users → Profile → Application Passwords** and create one.
2. In Sosial, open **Channels → WordPress**.
3. Enter your site URL, your WordPress username and the application password.
4. Select **Connect**.

## Limits

| Limit | Value |
| --- | --- |
| Content limit | Effectively unlimited (100k+ characters) |
| Auth | Application password over the WordPress REST API |
| Media | Featured image and inline images |
| Status | Publish now, or schedule from Sosial |

The composer checks these as you type, so a post that's too long for WordPress is flagged before it's scheduled.

## What works on WordPress

- Long-form articles
- SEO-driven content
- Scheduled publishing without logging in

## Tips

### Set a featured image every time

It becomes the thumbnail on the blog and the preview card when the post is shared.

### Write the excerpt yourself

A hand-written excerpt controls how the post reads in search results and social previews.

### Cross-post the summary, not the article

Send a short teaser to social channels and link back, rather than pasting the whole piece.

## Avoid

- Revoking the application password so the connection silently fails.
- Publishing without a featured image and getting a blank preview card.
- Using a draft that is still half-written as a scheduled post.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('devto', 'Dev.to', 'Developer articles, published where engineers actually read.', 15, 'brand:devto',
$md$Dev.to is a blogging community built for technical writing. Sosial connects through the Dev.to API to publish your scheduled articles with tags, a cover image and canonical links, so the post appears in feeds and search on schedule.

## Connect Dev.to

Dev.to connects with an **API key**.

1. On dev.to, open **Settings → Extensions** and generate an API key.
2. In Sosial, open **Channels → Dev.to** and paste the key.
3. Select **Connect**.

## Limits

| Limit | Value |
| --- | --- |
| Content limit | Effectively unlimited (100k+ characters) |
| Auth | Dev.to API key |
| Tags | Up to 4 tags per post |
| Canonical | Point back to your own blog to avoid duplicate SEO |

The composer checks these as you type, so a post that's too long for Dev.to is flagged before it's scheduled.

## What works on Dev.to

- Tutorials and deep dives
- Release notes for developer tools
- Technical opinion pieces

## Tips

### Pick four precise tags

Tags drive discovery on Dev.to. Choose the ones a developer would actually follow over broad vanity tags.

### Set the canonical URL

If the piece also lives on your blog, set the canonical link so search engines credit the original.

### Lead with the problem

Open with the bug or the goal, not the backstory. Developers skim until they find the part that helps.

## Avoid

- Tag stuffing with unrelated tags that bury the post.
- Publishing without a canonical URL and splitting SEO across two copies.
- Code samples without language hints, which render flat.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('hashnode', 'Hashnode', 'Cross-post engineering writing to your own Hashnode blog.', 16, 'brand:hashnode',
$md$Hashnode gives developers a personal blog with a strong built-in community. Sosial publishes through the Hashnode GraphQL API, so a scheduled article lands on your publication with its tags and cover image at the time you set.

## Connect Hashnode

Hashnode connects with a **personal access token**. Only **Hashnode Pro** publications can be connected; upgrade from your blog dashboard under **Billing** first.

1. On hashnode.com, open **Settings → Developer** and generate a token.
2. In Sosial, open **Channels → Hashnode**, paste the token and select **List my publications**.
3. Pick the publication, then connect.

## Limits

| Limit | Value |
| --- | --- |
| Content limit | Effectively unlimited (100k+ characters) |
| Auth | Hashnode API token (Pro accounts) |
| Tags | Up to 5 tags per post |
| Canonical | Supported, for republished pieces |

The composer checks these as you type, so a post that's too long for Hashnode is flagged before it's scheduled.

## What works on Hashnode

- Personal engineering blogs
- Cross-posting from your own site
- Community-led technical writing

## Tips

### Choose a focused publication

Posting to a themed publication beats a personal blog with no through-line for discovery.

### Reuse your canonical URL

Republishing from your own blog? Set the original URL so credit stays where it belongs.

### Front-load a real example

A short, concrete code snippet early beats an abstract introduction every time.

## Avoid

- Using an API token from a free account, where publishing is not available.
- Forgetting tags and losing the discovery that comes with them.
- Republishing without a canonical URL and confusing search.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$),
  ('ghost', 'Ghost', 'Newsletters and blog posts published from the same calendar.', 17, 'brand:ghost',
$md$Ghost pairs a clean blog with a newsletter. Sosial connects over the Ghost Admin API to create and schedule posts, title, body, tags and feature image, and can send them to your subscribers as an email at the same moment.

## Connect Ghost

Ghost has no central login: each site issues its own **Admin API key**.

1. In Ghost Admin, open **Settings → Integrations**, add a custom integration and copy the Admin API key (`id:secret`).
2. In Sosial, open **Channels → Ghost**.
3. Enter your Ghost site URL and paste the key.
4. Select **Connect**.

## Limits

| Limit | Value |
| --- | --- |
| Content limit | Effectively unlimited (100k+ characters) |
| Auth | Ghost Admin API key |
| Delivery | Web post, email to subscribers, or both |
| Media | Feature image and inline images |

The composer checks these as you type, so a post that's too long for Ghost is flagged before it's scheduled.

## What works on Ghost

- Newsletters
- Membership blogs
- Long-form publishing with email delivery

## Tips

### Decide web, email or both

Not every post deserves an inbox. Send to email when it matters, publish quietly to the web when it does not.

### Write a subject-line-first headline

The headline is the email subject, so write it to earn the open, not just the click.

### One idea per send

Focused emails hold attention. Save the roundups for a recurring digest.

## Avoid

- Blasting every update to email and burning out subscribers.
- Publishing without a feature image and getting a plain link card.
- Rotating the Admin API key without updating the connection.

More on [connecting accounts](/connecting-accounts) and [scheduling posts](/scheduling-posts).
$md$)
) as v(slug, title, description, position, icon, body_md)
join public.docs_sections s on s.slug = 'channels'
on conflict (slug) do nothing;


-- Changelog, last in Getting started.
insert into public.docs_pages (section_id, slug, title, description, position, published, icon, body_md)
select s.id, 'changelog', 'Changelog', 'What changed in Sosial, newest first.', 1, true, 'history',
$md$Changes ship to the web app and the mobile app together unless noted.

## 28 October 2026

- **First-run tour** on the web and in the mobile app walks you through the main screens. Dismissing it is remembered.
- **TikTok**: posts now follow TikTok's content sharing rules. You choose who can see each post (there's no default), drafts without an audience aren't queued, and failed posts show TikTok's own error message.
- **Inbox**: mark comment threads as resolved or ignored, on the web and on mobile.
- **Analytics**: a comment report with CSV export.
- **Notifications**: delete everything from the bell in one go.

## 27 October 2026

- **Bluesky**: publishing keeps working after a session expires; Sosial signs in again with your saved app password.
- **Legal**: plain-language Terms of Use and Privacy Policy covering every channel, the inbox, approvals, notifications and AI.

## 26 October 2026

- **X**: when X rejects a post, the error says whether the media upload or the post failed, and quotes X's reason.
- **Billing**: plans shown as pricing cards on the web Billing page and the mobile Subscription page.
- **Blog and Library**: redesigned with topic tiles, sticky filters and a reading layout.

## 24 October 2026

- **Channels**: disconnecting a channel keeps its post history; **Delete data** erases it.
- **MCP**: new tools to read and reply to comments, with their own scopes. Only writes ask for confirmation.
- **Community**: comments grouped by post as chat bubbles, with your replies on the right.
- **Redesign** of the community inbox, calendar, team, posts, dashboard and analytics on web and mobile.
- **Post cards**: a single photo or video keeps its own shape (vertical, square or wide).

## 23 October 2026

- **Facebook**: every Page your login can reach is listed when you connect.
- **Analytics**: follower counts are captured when a channel connects, and only live channels are counted.

## 22 October 2026

- **Inbox**: each comment thread shows the post it belongs to, and replies appear as soon as they're sent.
- **Calendar**: rebuilt on the brand's own colours.
$md$
from public.docs_sections s where s.slug = 'getting-started'
on conflict (slug) do nothing;


-- Corrections to earlier starter text, only where no admin has edited it.
update public.docs_pages
set body_md = replace(
  replace(body_md, chr(13), ''),
  $old$## Facebook, Instagram and Threads

Instagram professional accounts are linked through the Facebook Page they belong to. When you connect Facebook, Sosial asks which Pages to add. Pick every Page whose Instagram account you also want to post to.$old$,
  $new$## Instagram, Facebook and Threads

Each of the three connects with its own login. Instagram needs a professional (Business or Creator) account, Facebook adds the Pages you pick, and Threads uses your Threads profile. See [Instagram](/instagram), [Facebook](/facebook) and [Threads](/threads) for the steps.$new$
)
where slug = 'connecting-accounts' and updated_by is null;

update public.docs_pages
set body_md = replace(
  replace(body_md, chr(13), ''),
  $old$Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest connect with the network's own sign-in. Instagram and Threads go through a Facebook Page or a professional account, see [Connecting accounts](/connecting-accounts).$old$,
  $new$Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn and Pinterest connect with the network's own sign-in. Mastodon signs in on your own server, and Bluesky uses an app password. Each channel has its own page in this section with the exact steps.$new$
)
where slug = 'channels' and updated_by is null;
